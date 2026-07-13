import "server-only";

import type { Artifact, BrandKit, BrandSource, CreativeConcept, Project } from "@prisma/client";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import {
  buildGroundingInstructions,
  findConceptGroundingViolations,
  getGroundingCapabilities,
  hardenImagePrompt,
  type GroundingCapabilities,
} from "@/lib/brand/grounding";
import { QWEN_STRUCTURED_MODEL, sanitizeQwenError } from "@/lib/qwen/client";
import { generateImageWithQwen } from "@/lib/qwen/image";
import { generateStructuredWithQwen } from "@/lib/qwen/structured";
import { reviewGeneratedPreviewGrounding } from "@/lib/qwen/vision";
import {
  creativeConceptsSchema,
  creativeConceptsJsonSchema,
  parseCreativeConceptsOutput,
  parseStoryboardOutput,
  storyboardJsonSchema,
  storyboardSchema,
  type PolicyWarning,
  type StoryboardOutput,
} from "@/lib/schemas/agent";
import { deleteStoredObject, storeObject } from "@/lib/oss";

export const QWEN_PREVIEW_IMAGE_MODEL = "wan2.7-image-pro";

type BrandProject = Project & {
  brandKit: BrandKit | null;
  concepts: CreativeConcept[];
  artifacts: Artifact[];
  sources: BrandSource[];
};

export async function generateConceptsForProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { brandKit: true, concepts: true, artifacts: true, sources: true },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (!project.brandKit) {
    throw new Error("Generate a Brand Kit before creative concepts.");
  }

  const result = await generateStructuredWithQwen({
    operation: "creative_director_concepts",
    schema: creativeConceptsSchema,
    schemaName: "reel_ai_creative_concepts",
    jsonSchema: creativeConceptsJsonSchema,
    model: QWEN_STRUCTURED_MODEL,
    parse: parseCreativeConceptsOutput,
    system: conceptSystemPrompt,
    user: buildConceptPrompt(project),
  });
  const grounding = getGroundingCapabilities(project.sources, project.brandKit);
  const violations = findConceptGroundingViolations(
    result.data.concepts,
    grounding,
  );
  if (violations.length > 0) {
    throw new Error(
      `Creative grounding check failed: ${violations.slice(0, 3).join(" ")} Regenerate with grounded directions or upload the referenced brand materials.`,
    );
  }
  const artifacts = await Promise.all(
    result.data.concepts.map((concept, index) =>
      createPreviewFrameArtifact({
        project,
        conceptTitle: concept.title,
        prompt: concept.previewPrompt,
        grounding,
        index,
      }),
    ),
  );

  await cleanupReplacedConceptPreviews(project);
  await prisma.creativeConcept.deleteMany({ where: { projectId } });

  const concepts = await Promise.all(
    result.data.concepts.map((concept, index) =>
      prisma.creativeConcept.create({
        data: {
          projectId,
          title: concept.title,
          hook: concept.hook,
          strategy: concept.strategy,
          narrativeArc: concept.narrativeArc,
          visualStyle: concept.visualStyle,
          estimatedScenes: concept.estimatedScenes,
          estimatedDuration: concept.estimatedDurationSec,
          previewPrompt: concept.previewPrompt,
          previewArtifactId: artifacts[index]?.id ?? null,
          rationale: concept.rationale,
          selected: false,
        },
      }),
    ),
  );

  return {
    concepts,
    model: result.model,
    providerRequestId: result.providerRequestId,
    elapsedMs: result.elapsedMs,
    usage: result.usage,
  };
}

async function cleanupReplacedConceptPreviews(project: BrandProject) {
  const previewIds = project.concepts
    .map((concept) => concept.previewArtifactId)
    .filter((id): id is string => Boolean(id));
  if (previewIds.length === 0) return;

  const previews = project.artifacts.filter((artifact) =>
    previewIds.includes(artifact.id),
  );
  const cleanup = await Promise.allSettled(
    previews.map((artifact) => deleteStoredObject(artifact.ossKey)),
  );
  const failed = cleanup.filter((result) => result.status === "rejected").length;
  if (failed > 0) {
    console.warn("Replaced concept preview cleanup was incomplete", {
      projectId: project.id,
      failed,
    });
  }
  await prisma.artifact.deleteMany({ where: { id: { in: previewIds } } });
}

export async function selectConcept(projectId: string, conceptId: string) {
  const concept = await prisma.creativeConcept.findFirst({
    where: { id: conceptId, projectId },
  });

  if (!concept) {
    throw new Error("Concept not found");
  }

  await prisma.$transaction([
    prisma.creativeConcept.updateMany({
      where: { projectId },
      data: { selected: false },
    }),
    prisma.creativeConcept.update({
      where: { id: conceptId },
      data: { selected: true },
    }),
  ]);

  return prisma.creativeConcept.findUniqueOrThrow({ where: { id: conceptId } });
}

export async function generateStoryboardForProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      brandKit: true,
      concepts: { orderBy: { createdAt: "asc" } },
      sources: true,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (!project.brandKit) {
    throw new Error("Generate a Brand Kit before storyboard planning.");
  }

  const selectedConcept = project.concepts.find((concept) => concept.selected);

  if (!selectedConcept) {
    throw new Error("Select one creative concept before generating a storyboard.");
  }

  const result = await generateStructuredWithQwen({
    operation: "storyboard_generation",
    schema: storyboardSchema,
    schemaName: "reel_ai_storyboard",
    jsonSchema: storyboardJsonSchema,
    model: QWEN_STRUCTURED_MODEL,
    parse: parseStoryboardOutput,
    system: storyboardSystemPrompt,
    user: buildStoryboardPrompt(project, selectedConcept),
  });
  const storyboardGrounding = getGroundingCapabilities(
    project.sources,
    project.brandKit,
  );
  const storyboardViolations = findConceptGroundingViolations(
    [result.data],
    storyboardGrounding,
  );
  if (storyboardViolations.length > 0) {
    throw new Error(
      `Storyboard grounding check failed: ${storyboardViolations.slice(0, 3).join(" ")} Revise the direction or upload the referenced brand materials.`,
    );
  }
  const storyboard = await saveStoryboard({
    projectId,
    conceptId: selectedConcept.id,
    brandKit: project.brandKit,
    output: result.data,
  });
  const warnings = reviewStoryboardClaims(project.brandKit, result.data);

  await prisma.generationJob.create({
    data: {
      projectId,
      type: "POLICY_REVIEW",
      status: "COMPLETE",
      model: QWEN_STRUCTURED_MODEL,
      input: {
        operation: "storyboard_claim_policy_review",
        storyboardId: storyboard.id,
      },
      output: { warnings },
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });

  return {
    storyboard,
    warnings,
    model: result.model,
    providerRequestId: result.providerRequestId,
    elapsedMs: result.elapsedMs,
    usage: result.usage,
  };
}

export function getCreativeGenerationError(error: unknown) {
  if (error instanceof ZodError) {
    return `Creative output schema mismatch: ${formatZodIssues(error)}. Try regenerating.`;
  }

  if (
    error instanceof Error &&
    /^(Creative|Storyboard) grounding check failed:/.test(error.message)
  ) {
    return error.message;
  }

  const safe = sanitizeQwenError(error);

  if (safe.includes("Brand Kit")) {
    return safe.replace("Brand Kit", "creative output");
  }

  return safe;
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

async function saveStoryboard({
  projectId,
  conceptId,
  brandKit,
  output,
}: {
  projectId: string;
  conceptId: string;
  brandKit: BrandKit;
  output: StoryboardOutput;
}) {
  const existing = await prisma.storyboard.findUnique({
    where: { projectId },
    select: { id: true },
  });

  if (existing) {
    await prisma.scene.deleteMany({ where: { storyboardId: existing.id } });
  }

  const storyboard = await prisma.storyboard.upsert({
    where: { projectId },
    update: {
      conceptId,
      title: output.title,
      script: output.script,
      bgmEnabled: output.bgm.enabled,
      bgmPrompt: `${output.bgm.preset}: ${output.bgm.prompt}`,
      status: "DRAFT",
      scenes: {
        create: output.scenes.map((scene, index) => ({
          index: index + 1,
          durationSec: scene.durationSec,
          captionText: scene.captionText,
          voiceoverText: scene.voiceoverText,
          startFramePrompt: scene.startFramePrompt,
          endFramePrompt: scene.endFramePrompt,
          videoMotionPrompt: scene.videoMotionPrompt,
          continuityNotes: scene.continuityNotes,
          lockedStyleLanguage: brandKit.lockedStyle,
        })),
      },
    },
    create: {
      projectId,
      conceptId,
      title: output.title,
      script: output.script,
      bgmEnabled: output.bgm.enabled,
      bgmPrompt: `${output.bgm.preset}: ${output.bgm.prompt}`,
      status: "DRAFT",
      scenes: {
        create: output.scenes.map((scene, index) => ({
          index: index + 1,
          durationSec: scene.durationSec,
          captionText: scene.captionText,
          voiceoverText: scene.voiceoverText,
          startFramePrompt: scene.startFramePrompt,
          endFramePrompt: scene.endFramePrompt,
          videoMotionPrompt: scene.videoMotionPrompt,
          continuityNotes: scene.continuityNotes,
          lockedStyleLanguage: brandKit.lockedStyle,
        })),
      },
    },
    include: { scenes: { orderBy: { index: "asc" } } },
  });

  return storyboard;
}

async function createPreviewFrameArtifact({
  project,
  conceptTitle,
  prompt,
  index,
  grounding,
}: {
  project: BrandProject;
  conceptTitle: string;
  prompt: string;
  index: number;
  grounding: GroundingCapabilities;
}) {
  const groundedPrompt = hardenImagePrompt(prompt, grounding);
  const generated = await tryGenerateProviderPreview(groundedPrompt, grounding);
  const stored = generated
    ? await storeObject({
        projectId: project.id,
        fileName: `concept-preview-${index + 1}.png`,
        mimeType: "image/png",
        body: generated.body,
      })
    : await storeObject({
        projectId: project.id,
        fileName: `concept-preview-${index + 1}.svg`,
        mimeType: "image/svg+xml",
        body: Buffer.from(
          buildPreviewSvg({
            title: conceptTitle,
            businessName: project.businessName,
            prompt: groundedPrompt,
            index,
          }),
        ),
      });

  return prisma.artifact.create({
    data: {
      projectId: project.id,
      type: "IMAGE",
      ossKey: stored.key,
      publicUrl: stored.publicUrl,
      mimeType: generated?.mimeType ?? "image/svg+xml",
      width: 720,
      height: 1280,
      metadata: {
        operation: "concept_preview_frame",
        model: QWEN_PREVIEW_IMAGE_MODEL,
        prompt: groundedPrompt,
        groundingMode: grounding.hasUploadedVisuals
          ? "reference-limited"
          : "website-only-restricted",
        groundingReview: generated?.groundingReview ?? "Provider preview unavailable or rejected by visual grounding review.",
        storageMode: stored.storageMode,
        providerImageUrl: generated?.imageUrl ?? null,
        providerRequestId: generated?.providerRequestId ?? null,
        providerFallback: generated
          ? null
          : "Local durable preview used when live image generation is not configured.",
      },
    },
  });
}

async function tryGenerateProviderPreview(
  prompt: string,
  grounding: GroundingCapabilities,
) {
  try {
    const generated = await generateImageWithQwen({
      operation: "concept_preview_frame",
      model: QWEN_PREVIEW_IMAGE_MODEL,
      prompt,
    });
    const review = await reviewGeneratedPreviewGrounding({
      imageUrl: generated.imageUrl,
      restrictions: buildGroundingInstructions(grounding),
    });
    if (!review.passed) {
      return null;
    }
    const response = await fetch(generated.imageUrl);

    if (!response.ok) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();

    return {
      body: Buffer.from(arrayBuffer),
      mimeType: response.headers.get("content-type") ?? "image/png",
      imageUrl: generated.imageUrl,
      providerRequestId: generated.providerRequestId,
      groundingReview: review.summary,
    };
  } catch {
    return null;
  }
}

function reviewStoryboardClaims(
  brandKit: BrandKit,
  storyboard: StoryboardOutput,
): PolicyWarning[] {
  const copy = `${storyboard.title} ${storyboard.script} ${storyboard.scenes
    .map((scene) => `${scene.captionText} ${scene.voiceoverText}`)
    .join(" ")}`;
  const warnings: PolicyWarning[] = [];
  const riskyTerms = [
    "guaranteed",
    "cure",
    "risk-free",
    "instant results",
    "best in the world",
  ];

  for (const term of riskyTerms) {
    if (copy.toLowerCase().includes(term)) {
      warnings.push({
        severity: term === "cure" ? "blocker" : "warning",
        sceneIndex: null,
        message: `Storyboard copy uses "${term}", which may need evidence or softer phrasing.`,
        mitigation: "Rewrite the line with source-backed, non-guaranteed language.",
      });
    }
  }

  const policyRisks = Array.isArray(brandKit.policyRisks)
    ? brandKit.policyRisks
    : [];

  for (const risk of policyRisks.slice(0, 4)) {
    warnings.push({
      severity: "info",
      sceneIndex: null,
      message: stringifyRisk(risk),
      mitigation:
        "Review storyboard captions and voiceover against this Brand Kit policy note before generation.",
    });
  }

  return warnings.length > 0
    ? warnings
    : [
        {
          severity: "info",
          sceneIndex: null,
          message: "No obvious claim or policy blockers were found in this storyboard pass.",
          mitigation: "Human approval is still required before spending on generation.",
        },
      ];
}

function stringifyRisk(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.risk ?? record.reason ?? record.category ?? record.issue ?? "Brand Kit policy note");
  }

  return "Brand Kit policy note";
}

function buildConceptPrompt(project: BrandProject) {
  const brandKit = project.brandKit;
  const grounding = getGroundingCapabilities(project.sources, brandKit!);
  const websiteEvidence = project.sources
    .filter((source) => source.type === "WEBSITE" && source.extractedText)
    .map((source) => summarizeWebsiteEvidence(source.extractedText!))
    .join("\n");

  return `Pitch exactly three genuinely different creative strategies for a short-form vertical ad.

Business: ${project.businessName}
Project: ${project.name}
Audience: ${project.targetAudience?.trim() || brandKit?.audience || "Not specified"}
Offer: ${project.offer?.trim() || "Not specified"}
Video target: ${project.videoLengthSec}s, ${project.style}

Brand Kit:
Summary: ${brandKit?.summary}
Tone: ${brandKit?.tone}
Locked style: ${brandKit?.lockedStyle}
Value props: ${JSON.stringify(brandKit?.valueProps)}
Claims: ${JSON.stringify(brandKit?.claims)}
Policy risks: ${JSON.stringify(brandKit?.policyRisks)}
Palette: ${JSON.stringify(brandKit?.palette)}
Visual motifs: ${JSON.stringify(brandKit?.visualMotifs)}

Verified website evidence:
${websiteEvidence || "No clean website text was retained. Do not infer additional service or product details."}

Requirements:
- Return exactly three concepts.
- Make them different strategies, not three hook variants.
- Each concept must be a complete creative direction, not a storyboard scene.
- strategy must describe the ad strategy in one or two substantive sentences.
- narrativeArc must describe the beginning, middle, and ending beat.
- rationale must explain why this direction can work for this brand and audience.
- Do not leave strategy, narrativeArc, previewPrompt, or rationale blank or generic.
- Keep estimated scenes between 2 and 4 and duration between 15 and 30 seconds.
- Preview prompts must be 9:16 frame prompts suitable for ${QWEN_PREVIEW_IMAGE_MODEL}.
- Use the brand palette colors and visual motifs in your visual direction.
- Avoid unsupported claims and regulated-category promises.
- ${buildGroundingInstructions(grounding)}
- Do not describe an end card with a logo or brand name. End-card typography is composed later, not generated inside preview imagery.`;
}

function summarizeWebsiteEvidence(text: string) {
  const description = text.match(/^Description:\s*(.+)$/m)?.[1]?.trim();
  const siteName = text.match(/^Site name:\s*(.+)$/m)?.[1]?.trim();
  const visible = text.match(/^Visible content:\s*(.+)$/m)?.[1]?.trim();
  return [
    siteName ? `Brand name: ${siteName}` : null,
    description ? `Website description: ${description}` : null,
    visible ? `Website copy excerpt: ${visible.slice(0, 900)}` : null,
  ].filter(Boolean).join("\n");
}

function buildStoryboardPrompt(
  project: Project & { brandKit: BrandKit | null; sources: BrandSource[] },
  concept: CreativeConcept,
) {
  const brandKit = project.brandKit;
  const grounding = getGroundingCapabilities(project.sources, brandKit!);

  return `Expand the selected concept into an editable MVP storyboard for a 9:16 reel.

Business: ${project.businessName}
Audience: ${project.targetAudience?.trim() || brandKit?.audience || "Not specified"}
Offer: ${project.offer?.trim() || "Not specified"}
Target length: ${project.videoLengthSec}s
Style: ${project.style}

Selected concept:
Title: ${concept.title}
Hook: ${concept.hook}
Strategy: ${concept.strategy}
Narrative arc: ${concept.narrativeArc}
Visual style: ${concept.visualStyle}
Rationale: ${concept.rationale}

Brand Kit:
Tone: ${brandKit?.tone}
Locked style: ${brandKit?.lockedStyle}
Value props: ${JSON.stringify(brandKit?.valueProps)}
Claims: ${JSON.stringify(brandKit?.claims)}
Policy risks: ${JSON.stringify(brandKit?.policyRisks)}
Palette: ${JSON.stringify(brandKit?.palette)}
Visual motifs: ${JSON.stringify(brandKit?.visualMotifs)}

Requirements:
- Use 2 to 4 scenes total.
- Total duration must be 15 to 30 seconds.
- The storyboard must clearly execute the selected concept's strategy, narrative arc, and visual style.
- Do not drift into a different concept, a generic ad, or a list of disconnected scenes.
- Voiceover text must be 600 characters or less per scene.
- Each scene needs caption, voiceover, start/end frame prompts, motion prompt, and continuity notes.
- startFramePrompt, endFramePrompt, videoMotionPrompt, and continuityNotes must be specific, visual, and production-ready.
- Do not leave any required field blank or generic.
- Prompts must keep visual continuity and respect the locked brand style.
- Use the brand palette colors and visual motifs in scene descriptions.
- Match the ${project.style === "THREE_D_ANIMATION" ? "3D animation" : "realistic"} visual style.
- Do not create unsupported performance, medical, financial, or legal claims.
- ${buildGroundingInstructions(grounding)}
- Captions and logos are composited later; never ask image or video generation to draw readable text or brand marks.`;
}

const conceptSystemPrompt = `You are Reel AI's Creative Director Agent. You pitch divergent, brand-safe ad strategies for business reels. Return strict JSON only.`;

const storyboardSystemPrompt = `You are Reel AI's Storyboard Agent. You create compact, editable, continuity-aware scene plans for QwenCloud image-to-video production. Return strict JSON only.`;

function buildPreviewSvg({
  title,
  businessName,
  prompt,
  index,
}: {
  title: string;
  businessName: string;
  prompt: string;
  index: number;
}) {
  const palettes = [
    ["#0C0F0E", "#B6FF4D", "#F5F0E8"],
    ["#101010", "#FFB84D", "#EAF7FF"],
    ["#111214", "#7CF7D4", "#F4E8FF"],
  ];
  const [bg, accent, text] = palettes[index % palettes.length]!;
  const safeTitle = escapeXml(title);
  const safeBusiness = escapeXml(businessName);
  const safePrompt = escapeXml(prompt.slice(0, 220));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280" role="img" aria-label="${safeTitle}">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${bg}"/>
      <stop offset="1" stop-color="#2B2D2F"/>
    </linearGradient>
  </defs>
  <rect width="720" height="1280" fill="url(#g)"/>
  <rect x="52" y="72" width="616" height="1136" rx="28" fill="#000" opacity="0.22" stroke="${accent}" stroke-opacity="0.55"/>
  <circle cx="568" cy="210" r="92" fill="${accent}" opacity="0.18"/>
  <rect x="94" y="188" width="214" height="46" rx="8" fill="${accent}"/>
  <text x="114" y="219" fill="#101010" font-size="22" font-weight="700" font-family="Inter, Arial, sans-serif">CONCEPT ${index + 1}</text>
  <text x="94" y="338" fill="${text}" font-size="48" font-weight="800" font-family="Inter, Arial, sans-serif">
    ${wrapSvgText(safeTitle, 17, 4)
      .map((line, lineIndex) => `<tspan x="94" dy="${lineIndex === 0 ? 0 : 58}">${line}</tspan>`)
      .join("")}
  </text>
  <text x="94" y="620" fill="${accent}" font-size="26" font-weight="700" font-family="Inter, Arial, sans-serif">${safeBusiness}</text>
  <text x="94" y="710" fill="#D7DBD4" font-size="25" font-family="Inter, Arial, sans-serif">
    ${wrapSvgText(safePrompt, 32, 8)
      .map((line, lineIndex) => `<tspan x="94" dy="${lineIndex === 0 ? 0 : 36}">${line}</tspan>`)
      .join("")}
  </text>
  <text x="94" y="1136" fill="#AEB4AD" font-size="18" font-family="Inter, Arial, sans-serif">Preview frame prompt stored as durable artifact</text>
</svg>`;
}

function wrapSvgText(value: string, maxChars: number, maxLines: number) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (`${current} ${word}`.trim().length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }

    if (lines.length === maxLines) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  return lines;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
