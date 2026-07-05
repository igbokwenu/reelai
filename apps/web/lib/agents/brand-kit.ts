import "server-only";

import type { Artifact, BrandSource, Project } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { QWEN_STRUCTURED_MODEL, sanitizeQwenError } from "@/lib/qwen/client";
import { generateStructuredWithQwen } from "@/lib/qwen/structured";
import { analyzeVisualAssetWithQwen } from "@/lib/qwen/vision";
import {
  brandKitOutputSchema,
  parseBrandKitOutput,
  type BrandKitOutput,
} from "@/lib/schemas/brand-kit";

type ProjectWithContext = Project & {
  sources: BrandSource[];
  artifacts: Artifact[];
};

type SourceContext = {
  id: string;
  label: string;
  kind: string;
  text: string;
};

export async function generateBrandKitForProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      sources: { orderBy: { createdAt: "asc" } },
      artifacts: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const contexts = await collectBrandContexts(project);
  const result = await generateStructuredWithQwen({
    operation: "brand_kit_generation",
    schema: brandKitOutputSchema,
    schemaName: "reel_ai_brand_kit",
    model: QWEN_STRUCTURED_MODEL,
    parse: parseBrandKitOutput,
    system: brandKitSystemPrompt,
    user: buildBrandKitPrompt(project, contexts),
  });
  const output = enrichBrandKitFromProject(result.data, project, contexts);
  const brandKit = await saveBrandKit(project.id, output);

  return {
    brandKit,
    output,
    model: result.model,
    providerRequestId: result.providerRequestId,
    elapsedMs: result.elapsedMs,
    usage: result.usage,
  };
}

export function getBrandKitGenerationError(error: unknown) {
  return sanitizeQwenError(error);
}

async function collectBrandContexts(project: ProjectWithContext) {
  const artifactById = new Map(
    project.artifacts.map((artifact) => [artifact.id, artifact]),
  );
  const contexts: SourceContext[] = [
    {
      id: "project-intake",
      label: "Project intake",
      kind: "INTAKE",
      text: [
        `Business: ${project.businessName}`,
        `Project: ${project.name}`,
        project.websiteUrl ? `Website: ${project.websiteUrl}` : null,
        project.targetAudience ? `Target audience: ${project.targetAudience}` : null,
        project.offer ? `Offer: ${project.offer}` : null,
        `Requested style: ${project.style}`,
        `Requested length: ${project.videoLengthSec}s`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  for (const source of project.sources) {
    if (source.extractedText) {
      contexts.push({
        id: source.id,
        label: source.url ?? source.type,
        kind: source.type,
        text: source.extractedText,
      });
      continue;
    }

    if (source.url) {
      const extractedText = await extractWebsiteText(source.url);

      if (extractedText) {
        await prisma.brandSource.update({
          where: { id: source.id },
          data: { extractedText },
        });
        contexts.push({
          id: source.id,
          label: source.url,
          kind: source.type,
          text: extractedText,
        });
      }

      continue;
    }

    if (!source.artifactId) {
      continue;
    }

    const artifact = artifactById.get(source.artifactId);

    if (!artifact) {
      continue;
    }

    if (artifact.mimeType.startsWith("image/") && artifact.publicUrl) {
      const imageUrl = absoluteUrl(artifact.publicUrl);

      if (!imageUrl) {
        continue;
      }

      try {
        const analysis = await analyzeVisualAssetWithQwen({
          imageUrl,
          label: String(
            (artifact.metadata as { originalName?: unknown } | null)
              ?.originalName ?? source.type,
          ),
        });
        contexts.push({
          id: source.id,
          label: String(
            (artifact.metadata as { originalName?: unknown } | null)
              ?.originalName ?? source.type,
          ),
          kind: `${source.type}_VISION`,
          text: analysis.summary,
        });
      } catch {
        contexts.push({
          id: source.id,
          label: source.type,
          kind: "VISUAL_ASSET",
          text: "Visual asset was uploaded but could not be analyzed in this run.",
        });
      }
    } else {
      contexts.push({
        id: source.id,
        label: String(
          (artifact.metadata as { originalName?: unknown } | null)
            ?.originalName ?? source.type,
        ),
        kind: source.type,
        text: `Uploaded ${artifact.mimeType} asset is available as durable artifact ${artifact.id}.`,
      });
    }
  }

  if (project.websiteUrl && !contexts.some((context) => context.label === project.websiteUrl)) {
    const extractedText = await extractWebsiteText(project.websiteUrl);

    if (extractedText) {
      contexts.push({
        id: "project-website",
        label: project.websiteUrl,
        kind: "WEBSITE",
        text: extractedText,
      });
    }
  }

  return contexts;
}

async function extractWebsiteText(url: string) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "ReelAI-BrandKitBot/0.1",
      },
    });

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return null;
    }

    const raw = await response.text();
    return normalizeText(
      raw
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ).slice(0, 6000);
  } catch {
    return null;
  }
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function absoluteUrl(publicUrl: string) {
  if (publicUrl.startsWith("http://") || publicUrl.startsWith("https://")) {
    return publicUrl;
  }

  const appUrl = process.env.PUBLIC_APP_URL;

  if (!appUrl || appUrl.toLowerCase().includes("placeholder")) {
    return null;
  }

  return new URL(publicUrl, appUrl).toString();
}

async function saveBrandKit(projectId: string, brandKit: BrandKitOutput) {
  return prisma.brandKit.upsert({
    where: { projectId },
    update: {
      summary: brandKit.summary,
      valueProps: brandKit.valueProps,
      audience: brandKit.audience,
      tone: brandKit.tone,
      palette: brandKit.palette,
      visualMotifs: brandKit.visualMotifs,
      claims: brandKit.claims,
      policyRisks: brandKit.policyRisks,
      sourceCitations: brandKit.sourceCitations,
      lockedStyle: brandKit.lockedStyle,
    },
    create: {
      projectId,
      summary: brandKit.summary,
      valueProps: brandKit.valueProps,
      audience: brandKit.audience,
      tone: brandKit.tone,
      palette: brandKit.palette,
      visualMotifs: brandKit.visualMotifs,
      claims: brandKit.claims,
      policyRisks: brandKit.policyRisks,
      sourceCitations: brandKit.sourceCitations,
      lockedStyle: brandKit.lockedStyle,
    },
  });
}

function buildBrandKitPrompt(project: Project, contexts: SourceContext[]) {
  const sourceBlocks = contexts
    .map(
      (context) =>
        `<source id="${context.id}" kind="${context.kind}" label="${context.label}">\n${context.text.slice(0, 7000)}\n</source>`,
    )
    .join("\n\n");

  return `Create a useful, production-ready Brand Kit for a short-form ad studio.

Project:
- Name: ${project.name}
- Business: ${project.businessName}
- Target audience: ${project.targetAudience ?? "Unknown"}
- Offer: ${project.offer ?? "Not supplied; infer a cautious brand positioning from sources instead of inventing a product claim."}
- Style: ${project.style}
- Target duration: ${project.videoLengthSec}s

Source context:
${sourceBlocks}

Rules:
- Use only the supplied source context and project intake.
- Cite every important brand fact using sourceCitations.sourceId.
- Keep claims conservative. If support is weak, mark confidence "low" and add a policy risk.
- If no offer is supplied, do not invent one. Describe brand positioning from website/source context.
- Include practical colors. Use neutral fallback colors only when sources do not establish a palette.
- lockedStyle must be concise style language later agents can reuse for concepts, keyframes, and video prompts.
- Return only JSON that matches the schema.`;
}

const brandKitSystemPrompt =
  "You are Reel AI's Brand Research Agent. You convert business intake, website text extracted by the backend, and uploaded visual asset analysis into a verified Brand Kit for ad generation. You are concise, source-grounded, and cautious about claims.";

function enrichBrandKitFromProject(
  brandKit: BrandKitOutput,
  project: Project,
  contexts: SourceContext[],
) {
  const sourceIds = contexts.map((context) => context.id);
  const primarySourceId = sourceIds[0] ?? "project-intake";
  const positioning = getProjectPositioning(project, contexts);
  const audience = project.targetAudience ?? "the intended audience";
  const business = project.businessName;
  const hasFallbackSummary = brandKit.summary.startsWith(
    "Brand summary was not provided.",
  );

  return brandKitOutputSchema.parse({
    ...brandKit,
    summary: hasFallbackSummary
      ? `${business} is positioned for ${audience} around ${positioning}. The Brand Kit should keep the reel source-grounded, practical, and focused on clear short-form ad storytelling rather than unsupported performance claims.`
      : brandKit.summary,
    audience: brandKit.audience ?? audience,
    valueProps: replaceFallbackValueProps(
      brandKit.valueProps,
      positioning,
      business,
      Boolean(project.offer),
    ),
    claims: replaceFallbackClaims(
      brandKit.claims,
      positioning,
      Boolean(project.offer),
    ),
    sourceCitations: replaceFallbackCitations(
      brandKit.sourceCitations,
      primarySourceId,
      contexts,
    ),
  });
}

function replaceFallbackValueProps(
  valueProps: BrandKitOutput["valueProps"],
  positioning: string,
  business: string,
  hasOffer: boolean,
) {
  if (valueProps[0]?.label !== "Clear offer") {
    return valueProps;
  }

  return [
    {
      label: hasOffer ? "Clear offer" : "Clear positioning",
      detail: `${business} should lead with ${positioning}, using simple ad copy that a viewer can understand in the first few seconds.`,
    },
    {
      label: "Source-grounded trust",
      detail:
        "Use the supplied website and intake details as the proof base for claims, avoiding exaggerated outcomes.",
    },
  ];
}

function replaceFallbackClaims(
  claims: BrandKitOutput["claims"],
  positioning: string,
  hasOffer: boolean,
) {
  if (claims[0]?.claim !== "Use only source-grounded claims in ad copy.") {
    return claims;
  }

  return [
    {
      claim: positioning,
      support: hasOffer
        ? "Project intake supplied this as the offer."
        : "Available source context supports this cautious brand positioning.",
      confidence: hasOffer ? ("high" as const) : ("medium" as const),
    },
  ];
}

function replaceFallbackCitations(
  citations: BrandKitOutput["sourceCitations"],
  primarySourceId: string,
  contexts: SourceContext[],
) {
  if (citations[0]?.note !== "Fallback citation for normalized Brand Kit fields.") {
    return citations;
  }

  const source = contexts.find((context) => context.id === primarySourceId);

  return [
    {
      sourceId: primarySourceId,
      label: source?.label ?? "Project intake",
      note: "Used as the source for the business, audience, and offer positioning.",
    },
  ];
}

function getProjectPositioning(project: Project, contexts: SourceContext[]) {
  if (project.offer) {
    return project.offer;
  }

  const websiteContext = contexts.find((context) => context.kind === "WEBSITE");
  const contextText = normalizeText(websiteContext?.text ?? contexts[0]?.text ?? "");

  if (contextText.length > 40) {
    return contextText.slice(0, 160);
  }

  if (project.websiteUrl) {
    return `the brand presence at ${project.websiteUrl}`;
  }

  return `${project.businessName}'s supplied brand context`;
}
