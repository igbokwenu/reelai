import "server-only";

import type {
  Artifact,
  BrandSource,
  Project,
  ProjectProduct,
} from "@prisma/client";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import { applyLogoDominantColor } from "@/lib/brand/logo-palette";
import { researchWebsite } from "@/lib/brand/website-research";
import { readLocalObject } from "@/lib/oss";
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
  products: ProjectProduct[];
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
      products: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const contexts = await collectBrandContexts(project);
  await applyResearchedIdentity(project, contexts);
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

async function applyResearchedIdentity(
  project: ProjectWithContext,
  contexts: SourceContext[],
) {
  const websiteSource = project.sources.find(
    (source) => source.type === "WEBSITE",
  );
  const metadata = websiteSource?.metadata as {
    businessNameInferred?: unknown;
    projectNameInferred?: unknown;
  } | null;
  const domainLabel = project.websiteUrl
    ? (new URL(project.websiteUrl).hostname
        .replace(/^www\./, "")
        .split(".")[0] ?? "")
    : "";
  const normalized = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const legacyInferredBusiness =
    Boolean(domainLabel) &&
    normalized(project.businessName) === normalized(domainLabel);
  const businessWasInferred =
    metadata?.businessNameInferred === true || legacyInferredBusiness;
  const projectWasInferred =
    metadata?.projectNameInferred === true ||
    normalized(project.name) === `${normalized(project.businessName)}reel`;
  if (!businessWasInferred && !projectWasInferred) return;

  const websiteText =
    contexts.find((context) => context.kind === "WEBSITE")?.text ?? "";
  const siteName = websiteText.match(/^Site name:\s*(.+)$/m)?.[1]?.trim();
  const title = websiteText.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
  const candidate = (siteName ?? title?.split(/\s+[|–—-]\s+/)[0] ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (candidate.length < 2 || candidate.length > 80) return;

  const businessName = businessWasInferred ? candidate : project.businessName;
  const name = projectWasInferred ? `${businessName} reel` : project.name;
  await prisma.project.update({
    where: { id: project.id },
    data: { businessName, name },
  });
  project.businessName = businessName;
  project.name = name;
  const intake = contexts.find((context) => context.kind === "INTAKE");
  if (intake) {
    intake.text = intake.text
      .replace(/^Business:.*$/m, `Business: ${businessName}`)
      .replace(/^Project:.*$/m, `Project: ${name}`);
  }
}

export function getBrandKitGenerationError(error: unknown) {
  if (error instanceof ZodError) {
    return `Brand Kit response schema mismatch: ${formatZodIssues(error)}. Try regenerating.`;
  }

  return sanitizeQwenError(error);
}

function formatZodIssues(error: ZodError) {
  return error.issues
    .slice(0, 4)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path} ${issue.message}`;
    })
    .join("; ");
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
        project.targetAudience
          ? `Target audience: ${project.targetAudience}`
          : null,
        project.offer ? `Offer: ${project.offer}` : null,
        getCreativeDirection(project.sources)
          ? `User direction: ${getCreativeDirection(project.sources)}`
          : null,
        `Requested style: ${project.style}`,
        `Requested length: ${project.videoLengthSec}s`,
        `Output mode: ${project.outputMode}`,
        project.products.length > 0
          ? `Products: ${project.products
              .map(
                (product, index) =>
                  `${index + 1}. ${product.name}${product.details ? ` — ${product.details}` : ""}${product.websiteUrl ? ` (${product.websiteUrl})` : ""}`,
              )
              .join(" | ")}`
          : null,
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
      if (source.url && source.type === "WEBSITE") {
        const research = await researchWebsite(source.url);
        await appendWebsiteVisualContexts(
          contexts,
          source.id,
          research?.visualUrls ?? [],
        );
      }
      continue;
    }

    if (source.url) {
      const research = await researchWebsite(source.url);
      const extractedText = research?.text ?? null;

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
        await appendWebsiteVisualContexts(
          contexts,
          source.id,
          research?.visualUrls ?? [],
        );
      } else {
        contexts.push({
          id: source.id,
          label: source.url,
          kind: "WEBSITE_UNAVAILABLE",
          text: "The website could not be retrieved. Do not infer website copy, visual assets, colors, products, or claims from the URL alone.",
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

    if (artifact.mimeType.startsWith("image/")) {
      const imageUrl = await artifactImageUrl(artifact);

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

  if (
    project.websiteUrl &&
    !contexts.some((context) => context.label === project.websiteUrl)
  ) {
    const research = await researchWebsite(project.websiteUrl);
    const extractedText = research?.text ?? null;

    if (extractedText) {
      contexts.push({
        id: "project-website",
        label: project.websiteUrl,
        kind: "WEBSITE",
        text: extractedText,
      });
      await appendWebsiteVisualContexts(
        contexts,
        "project-website",
        research?.visualUrls ?? [],
      );
    }
  }

  return contexts;
}

async function appendWebsiteVisualContexts(
  contexts: SourceContext[],
  sourceId: string,
  visuals: { url: string; label: string }[],
) {
  for (const [index, visual] of visuals.slice(0, 3).entries()) {
    try {
      const analysis = await analyzeVisualAssetWithQwen({
        imageUrl: visual.url,
        label: visual.label,
      });
      contexts.push({
        id: `${sourceId}-visual-${index + 1}`,
        label: visual.url,
        kind: "WEBSITE_VISION",
        text: analysis.summary,
      });
    } catch {
      // Text/CSS evidence remains usable when a remote image blocks model access.
    }
  }
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

async function artifactImageUrl(artifact: Artifact) {
  if (
    artifact.publicUrl?.startsWith("http://") ||
    artifact.publicUrl?.startsWith("https://")
  ) {
    return artifact.publicUrl;
  }

  try {
    const body = await readLocalObject(artifact.ossKey);
    return `data:${artifact.mimeType};base64,${body.toString("base64")}`;
  } catch {
    return artifact.publicUrl ? absoluteUrl(artifact.publicUrl) : null;
  }
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
- Target audience: ${project.targetAudience?.trim() || "Unknown"}
- Offer: ${project.offer?.trim() || "Not supplied; infer a cautious brand positioning from sources instead of inventing a product claim."}
- User direction: ${getCreativeDirectionFromContexts(contexts) ?? "None; determine the most useful positioning from website evidence."}
- Style: ${project.style}
- Target duration: ${project.videoLengthSec}s

Source context:
${sourceBlocks}

Rules:
- Use only the supplied source context and project intake.
- Cite every important brand fact using sourceCitations.sourceId.
- Keep claims conservative. If support is weak, mark confidence "low" and add a policy risk.
- If no offer is supplied, do not invent one. Describe brand positioning from website/source context.
- Prefer colors evidenced by CSS/HTML candidates or visual analysis. Use neutral fallback colors only when neither source establishes a palette.
- When a LOGO_VISION source includes DOMINANT_LOGO_COLOR, treat it as the primary Working palette color and build supporting colors around it.
- Treat WEBSITE_VISION sources as direct evidence for logos, product appearance, typography, and visual language.
- lockedStyle must be concise style language later agents can reuse for concepts, keyframes, and video prompts.
- Return only JSON that matches the schema.`;
}

const brandKitSystemPrompt =
  "You are Reel AI's Brand Research Agent. You convert business intake, website text extracted by the backend, and uploaded visual asset analysis into a verified Brand Kit for ad generation. You are concise, source-grounded, and cautious about claims.";

function getCreativeDirection(sources: BrandSource[]) {
  for (const source of sources) {
    const metadata = source.metadata as { creativeDirection?: unknown } | null;
    if (
      typeof metadata?.creativeDirection === "string" &&
      metadata.creativeDirection.trim()
    ) {
      return metadata.creativeDirection.trim();
    }
  }
  return null;
}

function getCreativeDirectionFromContexts(contexts: SourceContext[]) {
  const match = contexts
    .find((context) => context.kind === "INTAKE")
    ?.text.match(/User direction: (.+)/);
  return match?.[1]?.trim() || null;
}

function enrichBrandKitFromProject(
  brandKit: BrandKitOutput,
  project: Project,
  contexts: SourceContext[],
) {
  const primarySourceId =
    contexts.find((context) => context.kind === "WEBSITE")?.id ??
    contexts[0]?.id ??
    "project-intake";
  const positioning = getProjectPositioning(project, contexts);
  const audience =
    project.targetAudience?.trim() ||
    brandKit.audience ||
    "customers described in the supplied sources";
  const business = project.businessName;
  const normalizedAudience = audience.replace(/[.!?]+$/, "");
  const hasFallbackSummary = brandKit.summary.startsWith(
    "Brand summary was not provided.",
  );
  const hasUploadedVisualEvidence = contexts.some((context) =>
    /^(LOGO|PRODUCT_IMAGE|REFERENCE_AD|UPLOAD)_VISION$/.test(context.kind),
  );
  const policyRisks = [...brandKit.policyRisks];
  if (!hasUploadedVisualEvidence) {
    policyRisks.unshift({
      risk: "No uploaded brand or product visuals are available for exact reproduction.",
      severity: "medium" as const,
      mitigation:
        "Use unbranded lifestyle scenes. Do not manufacture logos, app screens, packaging, badges, uniforms, or product details.",
    });
  }

  return brandKitOutputSchema.parse({
    ...brandKit,
    summary: hasFallbackSummary
      ? `${business} serves ${normalizedAudience}. ${positioning} Creative work should remain source-grounded and avoid presenting unverified product or brand visuals as authentic.`
      : brandKit.summary,
    audience: normalizedAudience,
    valueProps: replaceFallbackValueProps(
      brandKit.valueProps,
      positioning,
      business,
      Boolean(project.offer?.trim()),
    ),
    claims: replaceFallbackClaims(
      brandKit.claims,
      positioning,
      Boolean(project.offer?.trim()),
    ),
    sourceCitations: replaceFallbackCitations(
      brandKit.sourceCitations,
      primarySourceId,
      contexts,
    ),
    policyRisks: policyRisks.slice(0, 8),
    palette: applyLogoDominantColor(brandKit.palette, contexts),
    visualMotifs: sanitizeVisualMotifs(
      brandKit.visualMotifs,
      hasUploadedVisualEvidence,
    ),
    lockedStyle:
      brandKit.lockedStyle ===
      "Clean vertical ad style with restrained captions."
        ? "Realistic documentary-style vertical imagery with natural light, authentic home environments, unbranded wardrobe, human connection, and restrained captions added in post."
        : brandKit.lockedStyle,
  });
}

function sanitizeVisualMotifs(
  motifs: string[],
  hasUploadedVisualEvidence: boolean,
) {
  if (hasUploadedVisualEvidence) return motifs;
  const safe = motifs.filter(
    (motif) =>
      !/\b(product|app|interface|screen|logo|packag|uniform|badge)\b/i.test(
        motif,
      ),
  );
  return [
    ...new Set([
      ...safe,
      "authentic human connection",
      "natural home environment",
    ]),
  ].slice(0, 8);
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
      detail: `${business} should lead with this source-backed positioning: ${truncateText(positioning, 190)}`,
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
      claim: truncateText(positioning, 220),
      support: truncateText(
        hasOffer
          ? "Project intake supplied this as the offer."
          : "Available source context supports this cautious brand positioning.",
        260,
      ),
      confidence: hasOffer ? ("high" as const) : ("medium" as const),
    },
  ];
}

function replaceFallbackCitations(
  citations: BrandKitOutput["sourceCitations"],
  primarySourceId: string,
  contexts: SourceContext[],
) {
  if (
    citations[0]?.note !== "Fallback citation for normalized Brand Kit fields."
  ) {
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
  const contextText = websiteContext?.text ?? "";
  const description = contextText.match(/^Description:\s*(.+)$/m)?.[1]?.trim();
  if (description && description.length > 30) {
    return ensureSentence(truncateText(description, 260));
  }

  const visibleContent = contextText
    .match(/^Visible content:\s*(.+)$/m)?.[1]
    ?.trim();
  if (visibleContent && visibleContent.length > 40) {
    return ensureSentence(truncateText(visibleContent, 260));
  }

  if (project.websiteUrl) {
    return `The available website establishes the brand presence at ${project.websiteUrl}, but did not provide enough clean copy for a more specific positioning statement.`;
  }

  return `${project.businessName}'s supplied brand context`;
}

function ensureSentence(value: string) {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function truncateText(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}
