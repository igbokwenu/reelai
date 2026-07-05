import "server-only";

import type { Artifact, BrandKit, CreativeConcept, Project } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { QWEN_STRUCTURED_MODEL, sanitizeQwenError } from "@/lib/qwen/client";
import { generateImageWithQwen } from "@/lib/qwen/image";
import { generateStructuredWithQwen } from "@/lib/qwen/structured";
import {
  creativeConceptsSchema,
  parseCreativeConceptsOutput,
  parseStoryboardOutput,
  storyboardSchema,
  type PolicyWarning,
  type StoryboardOutput,
} from "@/lib/schemas/agent";
import { storeObject } from "@/lib/oss";

export const QWEN_PREVIEW_IMAGE_MODEL = "wan2.7-image-pro";

type BrandProject = Project & {
  brandKit: BrandKit | null;
  concepts: CreativeConcept[];
  artifacts: Artifact[];
};

export async function generateConceptsForProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { brandKit: true, concepts: true, artifacts: true },
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
    model: QWEN_STRUCTURED_MODEL,
    parse: parseCreativeConceptsOutput,
    system: conceptSystemPrompt,
    user: buildConceptPrompt(project),
  });
  const artifacts = await Promise.all(
    result.data.concepts.map((concept, index) =>
      createPreviewFrameArtifact({
        project,
        conceptTitle: concept.title,
        prompt: concept.previewPrompt,
        index,
      }),
    ),
  );

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
    model: QWEN_STRUCTURED_MODEL,
    parse: parseStoryboardOutput,
    system: storyboardSystemPrompt,
    user: buildStoryboardPrompt(project, selectedConcept),
  });
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
  const safe = sanitizeQwenError(error);

  if (safe.includes("Brand Kit")) {
    return safe.replace("Brand Kit", "creative output");
  }

  return safe;
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
}: {
  project: BrandProject;
  conceptTitle: string;
  prompt: string;
  index: number;
}) {
  const generated = await tryGenerateProviderPreview(prompt);
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
            prompt,
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
        prompt,
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

async function tryGenerateProviderPreview(prompt: string) {
  try {
    const generated = await generateImageWithQwen({
      operation: "concept_preview_frame",
      model: QWEN_PREVIEW_IMAGE_MODEL,
      prompt,
    });
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

  return `Pitch exactly three genuinely different creative strategies for a short-form vertical ad.

Business: ${project.businessName}
Project: ${project.name}
Audience: ${project.targetAudience ?? brandKit?.audience ?? "Not specified"}
Offer: ${project.offer ?? "Not specified"}
Video target: ${project.videoLengthSec}s, ${project.style}

Brand Kit:
Summary: ${brandKit?.summary}
Tone: ${brandKit?.tone}
Locked style: ${brandKit?.lockedStyle}
Value props: ${JSON.stringify(brandKit?.valueProps)}
Claims: ${JSON.stringify(brandKit?.claims)}
Policy risks: ${JSON.stringify(brandKit?.policyRisks)}

Requirements:
- Return exactly three concepts.
- Make them different strategies, not three hook variants.
- Keep estimated scenes between 2 and 4 and duration between 15 and 30 seconds.
- Preview prompts must be 9:16 frame prompts suitable for ${QWEN_PREVIEW_IMAGE_MODEL}.
- Avoid unsupported claims and regulated-category promises.`;
}

function buildStoryboardPrompt(
  project: Project & { brandKit: BrandKit | null },
  concept: CreativeConcept,
) {
  const brandKit = project.brandKit;

  return `Expand the selected concept into an editable MVP storyboard for a 9:16 reel.

Business: ${project.businessName}
Audience: ${project.targetAudience ?? brandKit?.audience ?? "Not specified"}
Offer: ${project.offer ?? "Not specified"}
Target length: 15 to 30 seconds.

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

Requirements:
- Use 2 to 4 scenes total.
- Total duration must be 15 to 30 seconds.
- Voiceover text must be 600 characters or less per scene.
- Each scene needs caption, voiceover, start/end frame prompts, motion prompt, and continuity notes.
- Prompts must keep visual continuity and respect the locked brand style.
- Do not create unsupported performance, medical, financial, or legal claims.`;
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
