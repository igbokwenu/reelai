import "server-only";

import type {
  Artifact,
  BrandKit,
  BrandSource,
  CreativeConcept,
  Prisma,
  Project,
  ProjectProduct,
} from "@prisma/client";
import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import {
  buildGroundingInstructions,
  buildGroundingRecoveryInstructions,
  findConceptGroundingViolations,
  getGroundingCapabilities,
  hardenImagePrompt,
  omittedGroundingCapabilities,
  recoverGroundedCreativeOutput,
  safeVisualMotifs,
  type GroundingCapabilities,
  type GroundingRecoverySummary,
} from "@/lib/brand/grounding";
import { QWEN_STRUCTURED_MODEL, sanitizeQwenError } from "@/lib/qwen/client";
import { generateImageWithQwen } from "@/lib/qwen/image";
import { generateStructuredWithQwen } from "@/lib/qwen/structured";
import { reviewGeneratedPreviewGrounding } from "@/lib/qwen/vision";
import {
  creativeConceptRegenerationJsonSchema,
  creativeConceptRegenerationSchema,
  creativeConceptsSchema,
  creativeConceptsJsonSchema,
  parseCreativeConceptRegenerationOutput,
  parseCreativeConceptsOutput,
  parseStoryboardOutput,
  productShowcaseCreativeConceptRegenerationJsonSchema,
  productShowcaseCreativeConceptRegenerationSchema,
  productShowcaseCreativeConceptsJsonSchema,
  productShowcaseCreativeConceptsSchema,
  productShowcaseStoryboardJsonSchema,
  productShowcaseStoryboardSchema,
  storyboardJsonSchema,
  storyboardSchema,
  type PolicyWarning,
  type StoryboardOutput,
} from "@/lib/schemas/agent";
import { deleteStoredObject, storeObject } from "@/lib/oss";
import {
  buildShowcaseMotionGuardrailBrief,
  findShowcaseConceptViolations,
  findShowcaseStoryboardViolations,
} from "@/lib/product-showcase/guardrails";
import {
  normalizeShowcaseSceneCount,
  storyboardTimingIssue,
} from "@/lib/storyboards/timing";

export const QWEN_PREVIEW_IMAGE_MODEL = "wan2.7-image-pro";

type BrandProject = Project & {
  brandKit: BrandKit | null;
  concepts: CreativeConcept[];
  artifacts: Artifact[];
  sources: BrandSource[];
  products: ProjectProduct[];
};

export async function generateConceptsForProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      brandKit: true,
      concepts: true,
      artifacts: true,
      sources: true,
      products: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (!project.brandKit) {
    throw new Error("Generate a Brand Kit before creative concepts.");
  }

  const result = await generateStructuredWithQwen({
    operation: "creative_director_concepts",
    schema:
      project.outputMode === "PRODUCT_SHOWCASE"
        ? productShowcaseCreativeConceptsSchema
        : creativeConceptsSchema,
    schemaName: "reel_ai_creative_concepts",
    jsonSchema:
      project.outputMode === "PRODUCT_SHOWCASE"
        ? productShowcaseCreativeConceptsJsonSchema
        : creativeConceptsJsonSchema,
    model: QWEN_STRUCTURED_MODEL,
    parse: (value) =>
      parseCreativeConceptsOutput(
        value,
        project.outputMode,
        project.videoLengthSec,
      ),
    preserveOriginalOnRepair: true,
    system: conceptSystemPrompt,
    user: buildConceptPrompt(project),
  });
  if (project.outputMode === "PRODUCT_SHOWCASE") {
    const motionViolations = findShowcaseConceptViolations(
      result.data.concepts,
      project.products,
    );
    if (motionViolations.length > 0) {
      throw new Error(
        `Product Showcase motion check failed: ${motionViolations.slice(0, 3).join(" ")} Regenerate the concepts to receive safer directions.`,
      );
    }
  }
  validateConceptTiming(project, result.data.concepts);
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
          showcaseMotionPlan:
            project.outputMode === "PRODUCT_SHOWCASE" && "motionPlan" in concept
              ? concept.motionPlan
                ? (concept.motionPlan as Prisma.InputJsonValue)
                : undefined
              : undefined,
          rationale: concept.rationale,
          selected: false,
        },
      }),
    ),
  );

  const storyboard = await prisma.storyboard.findUnique({
    where: { projectId },
    select: { id: true },
  });
  if (storyboard) {
    await prisma.$transaction([
      prisma.storyboard.update({
        where: { id: storyboard.id },
        data: { status: "DRAFT" },
      }),
      prisma.scene.updateMany({
        where: { storyboardId: storyboard.id },
        data: { status: "DRAFT" },
      }),
    ]);
  }

  return {
    concepts,
    model: result.model,
    providerRequestId: result.providerRequestId,
    elapsedMs: result.elapsedMs,
    usage: result.usage,
  };
}

export async function regenerateConceptForProject({
  projectId,
  conceptId,
  adjustmentNote,
}: {
  projectId: string;
  conceptId: string;
  adjustmentNote: string;
}) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      brandKit: true,
      concepts: { orderBy: { createdAt: "asc" } },
      products: { orderBy: { sortOrder: "asc" } },
      artifacts: true,
      sources: true,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (!project.brandKit) {
    throw new Error("Generate a Brand Kit before creative concepts.");
  }

  const targetIndex = project.concepts.findIndex(
    (concept) => concept.id === conceptId,
  );
  const target = project.concepts[targetIndex];

  if (!target) {
    throw new Error("Concept not found");
  }

  const result = await generateStructuredWithQwen({
    operation: "creative_director_concept_regeneration",
    schema:
      project.outputMode === "PRODUCT_SHOWCASE"
        ? productShowcaseCreativeConceptRegenerationSchema
        : creativeConceptRegenerationSchema,
    schemaName: "reel_ai_creative_concept_regeneration",
    jsonSchema:
      project.outputMode === "PRODUCT_SHOWCASE"
        ? productShowcaseCreativeConceptRegenerationJsonSchema
        : creativeConceptRegenerationJsonSchema,
    model: QWEN_STRUCTURED_MODEL,
    parse: (value) =>
      parseCreativeConceptRegenerationOutput(
        value,
        project.outputMode,
        project.videoLengthSec,
      ),
    preserveOriginalOnRepair: true,
    system: conceptSystemPrompt,
    user: buildConceptRegenerationPrompt({
      project,
      target,
      adjustmentNote,
    }),
  });
  if (project.outputMode === "PRODUCT_SHOWCASE") {
    const motionViolations = findShowcaseConceptViolations(
      [result.data.concept],
      project.products,
    );
    if (motionViolations.length > 0) {
      throw new Error(
        `Product Showcase motion check failed: ${motionViolations.slice(0, 3).join(" ")} Regenerate this direction to receive a safer motion plan.`,
      );
    }
  }
  validateConceptTiming(project, [result.data.concept]);
  const grounding = getGroundingCapabilities(project.sources, project.brandKit);
  const violations = findConceptGroundingViolations(
    [result.data.concept],
    grounding,
  );
  if (violations.length > 0) {
    throw new Error(
      `Creative grounding check failed: ${violations.slice(0, 3).join(" ")} Regenerate with a grounded direction or upload the referenced brand materials.`,
    );
  }

  const previewArtifact = await createPreviewFrameArtifact({
    project,
    conceptTitle: result.data.concept.title,
    prompt: result.data.concept.previewPrompt,
    grounding,
    index: targetIndex,
  });
  const storyboard = target.selected
    ? await prisma.storyboard.findUnique({
        where: { projectId },
        select: { id: true, conceptId: true },
      })
    : null;
  const invalidatesStoryboard = storyboard?.conceptId === target.id;
  const concept = await prisma.$transaction(async (tx) => {
    const updated = await tx.creativeConcept.update({
      where: { id: target.id },
      data: {
        title: result.data.concept.title,
        hook: result.data.concept.hook,
        strategy: result.data.concept.strategy,
        narrativeArc: result.data.concept.narrativeArc,
        visualStyle: result.data.concept.visualStyle,
        estimatedScenes: result.data.concept.estimatedScenes,
        estimatedDuration: result.data.concept.estimatedDurationSec,
        previewPrompt: result.data.concept.previewPrompt,
        previewArtifactId: previewArtifact.id,
        showcaseMotionPlan:
          project.outputMode === "PRODUCT_SHOWCASE" &&
          "motionPlan" in result.data.concept
            ? result.data.concept.motionPlan
              ? (result.data.concept.motionPlan as Prisma.InputJsonValue)
              : undefined
            : undefined,
        rationale: result.data.concept.rationale,
      },
    });

    if (invalidatesStoryboard && storyboard) {
      await tx.storyboard.update({
        where: { id: storyboard.id },
        data: { status: "DRAFT" },
      });
      await tx.scene.updateMany({
        where: { storyboardId: storyboard.id },
        data: { status: "DRAFT" },
      });
    }

    return updated;
  });

  await cleanupPreviewArtifact(project, target.previewArtifactId);

  return {
    concept,
    invalidatedStoryboard: invalidatesStoryboard,
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
  const failed = cleanup.filter(
    (result) => result.status === "rejected",
  ).length;
  if (failed > 0) {
    console.warn("Replaced concept preview cleanup was incomplete", {
      projectId: project.id,
      failed,
    });
  }
  await prisma.artifact.deleteMany({ where: { id: { in: previewIds } } });
}

async function cleanupPreviewArtifact(
  project: BrandProject,
  previewArtifactId: string | null,
) {
  if (!previewArtifactId) return;

  const artifact = project.artifacts.find(
    (candidate) => candidate.id === previewArtifactId,
  );
  if (!artifact) return;

  try {
    await deleteStoredObject(artifact.ossKey);
  } catch {
    console.warn("Replaced concept preview cleanup was incomplete", {
      projectId: project.id,
      artifactId: artifact.id,
    });
  }
  await prisma.artifact.delete({ where: { id: artifact.id } });
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
      products: { orderBy: { sortOrder: "asc" } },
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
    throw new Error(
      "Select one creative concept before generating a storyboard.",
    );
  }
  if (
    project.outputMode === "PRODUCT_SHOWCASE" &&
    !selectedConcept.showcaseMotionPlan
  ) {
    throw new Error(
      "Regenerate the selected Product Showcase concept to add its motion safety plan before storyboard planning.",
    );
  }

  const storyboardGrounding = getGroundingCapabilities(
    project.sources,
    project.brandKit,
  );
  const preflightViolations = findConceptGroundingViolations(
    [selectedConcept],
    storyboardGrounding,
  );
  const firstResult = await generateStructuredWithQwen({
    operation:
      preflightViolations.length > 0
        ? "storyboard_generation_with_preflight_adaptation"
        : "storyboard_generation",
    schema:
      project.outputMode === "PRODUCT_SHOWCASE"
        ? productShowcaseStoryboardSchema
        : storyboardSchema,
    schemaName: "reel_ai_storyboard",
    jsonSchema:
      project.outputMode === "PRODUCT_SHOWCASE"
        ? productShowcaseStoryboardJsonSchema
        : storyboardJsonSchema,
    model: QWEN_STRUCTURED_MODEL,
    parse: (value) =>
      parseStoryboardOutput(value, project.outputMode, project.videoLengthSec),
    system: storyboardSystemPrompt,
    user: buildStoryboardPrompt(project, selectedConcept, preflightViolations),
  });
  let output = firstResult.data;
  validateStoryboardTiming(project, output);
  let activeResult = firstResult;
  let recoveryResult: typeof firstResult | null = null;
  let storyboardViolations = findConceptGroundingViolations(
    [output],
    storyboardGrounding,
  );
  let showcaseMotionViolations =
    project.outputMode === "PRODUCT_SHOWCASE"
      ? findShowcaseStoryboardViolations(output, project.products)
      : [];
  const initialViolations = [
    ...new Set([...preflightViolations, ...storyboardViolations]),
  ];
  let recoveryMethod: GroundingRecoverySummary["method"] =
    preflightViolations.length > 0 ? "PREFLIGHT_ADAPTATION" : null;

  if (storyboardViolations.length > 0 || showcaseMotionViolations.length > 0) {
    recoveryResult = await generateStructuredWithQwen({
      operation: "storyboard_grounding_recovery",
      schema:
        project.outputMode === "PRODUCT_SHOWCASE"
          ? productShowcaseStoryboardSchema
          : storyboardSchema,
      schemaName: "reel_ai_storyboard_grounding_recovery",
      jsonSchema:
        project.outputMode === "PRODUCT_SHOWCASE"
          ? productShowcaseStoryboardJsonSchema
          : storyboardJsonSchema,
      model: QWEN_STRUCTURED_MODEL,
      parse: (value) =>
        parseStoryboardOutput(
          value,
          project.outputMode,
          project.videoLengthSec,
        ),
      system: storyboardSystemPrompt,
      user: buildStoryboardRecoveryPrompt({
        project,
        concept: selectedConcept,
        rejected: output,
        violations: storyboardViolations,
        showcaseMotionViolations,
        grounding: storyboardGrounding,
      }),
    });
    output = recoveryResult.data;
    validateStoryboardTiming(project, output);
    activeResult = recoveryResult;
    recoveryMethod = "REGENERATED";
    storyboardViolations = findConceptGroundingViolations(
      [output],
      storyboardGrounding,
    );
    showcaseMotionViolations =
      project.outputMode === "PRODUCT_SHOWCASE"
        ? findShowcaseStoryboardViolations(output, project.products)
        : [];
  }

  if (storyboardViolations.length > 0) {
    output = recoverGroundedCreativeOutput(output, storyboardGrounding);
    recoveryMethod = "SAFE_TEXT_FALLBACK";
    storyboardViolations = findConceptGroundingViolations(
      [output],
      storyboardGrounding,
    );
  }

  if (showcaseMotionViolations.length > 0) {
    throw new Error(
      `Product Showcase motion check failed after automatic recovery: ${showcaseMotionViolations.slice(0, 3).join(" ")} Regenerate the storyboard or revise the concept before production.`,
    );
  }

  if (storyboardViolations.length > 0) {
    throw new Error(
      `Storyboard grounding check failed after automatic recovery: ${storyboardViolations.slice(0, 3).join(" ")} The remaining issue requires human review.`,
    );
  }
  const groundingRecovery: GroundingRecoverySummary = {
    attempted: initialViolations.length > 0,
    recovered: initialViolations.length > 0,
    method: recoveryMethod,
    initialViolations,
    omittedCapabilities:
      initialViolations.length > 0
        ? omittedGroundingCapabilities(storyboardGrounding)
        : [],
  };
  const storyboard = await saveStoryboard({
    projectId,
    conceptId: selectedConcept.id,
    brandKit: project.brandKit,
    outputMode: project.outputMode,
    output,
  });
  const warnings = reviewStoryboardClaims(project.brandKit, output);

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
    groundingRecovery,
    model: activeResult.model,
    providerRequestId: activeResult.providerRequestId,
    elapsedMs: firstResult.elapsedMs + (recoveryResult?.elapsedMs ?? 0),
    usage: {
      initial: firstResult.usage,
      recovery: recoveryResult?.usage ?? null,
    },
  };
}

export function getCreativeGenerationError(error: unknown) {
  if (error instanceof ZodError) {
    console.warn(
      `[creative_output_validation] Automatic repair did not satisfy validation: ${formatZodIssues(error)}`,
    );
    return "Reel AI couldn't assemble a complete creative plan after automatic repair. Your concept and brand assets are safe; regenerate this stage to try again.";
  }

  if (
    error instanceof Error &&
    /^(?:(?:Creative|Storyboard) grounding check failed(?: after automatic recovery)?|Product Showcase motion check failed(?: after automatic recovery)?):/.test(
      error.message,
    )
  ) {
    return error.message;
  }
  if (
    error instanceof Error &&
    error.message.startsWith("Regenerate the selected Product Showcase concept")
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
  outputMode,
  output,
}: {
  projectId: string;
  conceptId: string;
  brandKit: BrandKit;
  outputMode: "STANDARD" | "PRODUCT_SHOWCASE";
  output: StoryboardOutput;
}) {
  const existing = await prisma.storyboard.findUnique({
    where: { projectId },
    select: { id: true },
  });

  if (existing) {
    await prisma.scene.deleteMany({ where: { storyboardId: existing.id } });
  }
  const characterContinuity = formatCharacterContinuity(
    output.continuityBible.characters,
    output.continuityBible.cast,
  );

  const storyboard = await prisma.storyboard.upsert({
    where: { projectId },
    update: {
      conceptId,
      title: output.title,
      script: output.script,
      bgmEnabled:
        outputMode === "PRODUCT_SHOWCASE" ? false : output.bgm.enabled,
      bgmPrompt: `${output.bgm.preset}: ${output.bgm.prompt}`,
      productContinuity: output.continuityBible.product,
      characterContinuity,
      visualContinuity: output.continuityBible.visualWorld,
      status: "DRAFT",
      scenes: {
        create: output.scenes.map((scene, index) => ({
          index: index + 1,
          durationSec: scene.durationSec,
          captionText: scene.captionText,
          voiceoverText: scene.voiceoverText,
          shotPrompt: scene.shotPrompt,
          continuityNotes: scene.continuityNotes,
          continuityMode: scene.continuityMode,
          transitionStyle: scene.transitionStyle,
          lockedStyleLanguage: brandKit.lockedStyle,
        })),
      },
    },
    create: {
      projectId,
      conceptId,
      title: output.title,
      script: output.script,
      bgmEnabled:
        outputMode === "PRODUCT_SHOWCASE" ? false : output.bgm.enabled,
      bgmPrompt: `${output.bgm.preset}: ${output.bgm.prompt}`,
      productContinuity: output.continuityBible.product,
      characterContinuity,
      visualContinuity: output.continuityBible.visualWorld,
      status: "DRAFT",
      scenes: {
        create: output.scenes.map((scene, index) => ({
          index: index + 1,
          durationSec: scene.durationSec,
          captionText: scene.captionText,
          voiceoverText: scene.voiceoverText,
          shotPrompt: scene.shotPrompt,
          continuityNotes: scene.continuityNotes,
          continuityMode: scene.continuityMode,
          transitionStyle: scene.transitionStyle,
          lockedStyleLanguage: brandKit.lockedStyle,
        })),
      },
    },
    include: { scenes: { orderBy: { index: "asc" } } },
  });

  return storyboard;
}

function formatCharacterContinuity(
  summary: StoryboardOutput["continuityBible"]["characters"],
  cast: StoryboardOutput["continuityBible"]["cast"],
) {
  if (cast.mode === "NO_PEOPLE") {
    return `${summary} Cast mode: NO_PEOPLE; do not add token background people.`;
  }

  const ledger = cast.members.map((member) => {
    const complexion = member.complexionOrHeritageAnchor
      ? `; complexion/heritage anchor: ${member.complexionOrHeritageAnchor}`
      : "";
    return `${member.role} [${member.recurrence}, ${member.ageBand}, ${member.referenceBasis}]: ${member.appearanceAnchors.join(", ")}; wardrobe: ${member.wardrobeAnchor}; distinguishing feature: ${member.distinguishingFeature}${complexion}`;
  });

  return `${summary} Cast mode: ${cast.mode}. Cast ledger — ${ledger.join(" | ")}`;
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
  const groundedPrompt = hardenImagePrompt(prompt, grounding, project.style);
  const generated = await tryGenerateProviderPreview(
    groundedPrompt,
    grounding,
    getPreviewReferenceUrls(project),
  );
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
        groundingReview:
          generated?.groundingReview ??
          "Provider preview unavailable or rejected by visual grounding review.",
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
  imageUrls: string[],
) {
  try {
    const generated = await generateImageWithQwen({
      operation: "concept_preview_frame",
      model: QWEN_PREVIEW_IMAGE_MODEL,
      prompt,
      imageUrls,
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

function getPreviewReferenceUrls(project: BrandProject) {
  const artifactById = new Map(
    project.artifacts.map((artifact) => [artifact.id, artifact]),
  );
  const typeOrder = new Map([
    ["PRODUCT_IMAGE", 0],
    ["LOGO", 1],
    ["REFERENCE_AD", 2],
    ["UPLOAD", 3],
  ]);
  return [...project.sources]
    .filter((source) => source.artifactId && typeOrder.has(source.type))
    .sort(
      (left, right) =>
        (typeOrder.get(left.type) ?? 9) - (typeOrder.get(right.type) ?? 9),
    )
    .flatMap((source) => {
      const artifact = source.artifactId
        ? artifactById.get(source.artifactId)
        : null;
      if (!artifact?.publicUrl) return [];
      if (/^https?:\/\//i.test(artifact.publicUrl)) return [artifact.publicUrl];
      const publicAppUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
      return publicAppUrl && !publicAppUrl.toLowerCase().includes("placeholder")
        ? [`${publicAppUrl}/api/artifacts/${artifact.id}/file`]
        : [];
    })
    .slice(0, 3);
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
        mitigation:
          "Rewrite the line with source-backed, non-guaranteed language.",
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
          message:
            "No obvious claim or policy blockers were found in this storyboard pass.",
          mitigation:
            "Human approval is still required before spending on generation.",
        },
      ];
}

function stringifyRisk(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(
      record.risk ??
        record.reason ??
        record.category ??
        record.issue ??
        "Brand Kit policy note",
    );
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
Output mode: ${project.outputMode}
Creative intensity: ${project.cinematicBoost ? "CINEMATIC_BOOST" : "BALANCED"}
${buildProductContext(project)}

Brand Kit:
Summary: ${brandKit?.summary}
Tone: ${brandKit?.tone}
Locked style: ${brandKit?.lockedStyle}
Value props: ${JSON.stringify(brandKit?.valueProps)}
Claims: ${JSON.stringify(brandKit?.claims)}
Policy risks: ${JSON.stringify(brandKit?.policyRisks)}
Palette: ${JSON.stringify(brandKit?.palette)}
Visual motifs: ${JSON.stringify(safeVisualMotifs(brandKit?.visualMotifs, grounding))}

Verified website evidence:
${websiteEvidence || "No clean website text was retained. Do not infer additional service or product details."}

${project.outputMode === "PRODUCT_SHOWCASE" ? buildShowcaseMotionGuardrailBrief(project.products) : ""}

Requirements:
- Return exactly three concepts.
- Make them different strategies, not three hook variants.
- Each concept must be a complete creative direction, not a storyboard scene.
- strategy must describe the ad strategy in one or two substantive sentences.
- narrativeArc must describe the beginning, middle, and ending beat.
- rationale must explain why this direction can work for this brand and audience.
- Do not leave strategy, narrativeArc, previewPrompt, or rationale blank or generic.
- ${buildSceneCountInstruction(project, "CONCEPT")}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "Every direction must be a premium product-first showcase grounded in the uploaded product images. Make the three routes meaningfully different: for example tactile/material reveal, cinematic hero motion, or an elegant use-context/model presentation when appropriate." : "Keep the product or service strategy grounded in verified evidence."}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? 'Every concept must return motionPlan. Name one heroAction; set supportingMotion to "None" or one low-amplitude material behavior; choose one supported cameraBehavior; declare NO_PERSON or ONE_PERSON; choose the evidence-based separationTreatment; and explain why the plan is visually interesting yet reliable in safetyRationale.' : "Keep execution details proportionate to the concept stage."}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "First classify the hero product by its real visual behavior, then design for that behavior: food and drink may use verified garnish, condensation, steam, pours, crumbs, or temperature contrast; beauty may use a controlled droplet, texture ribbon, cap reveal, or light sweep; fashion may use fabric response, a silhouette turn, or a clean step; rigid packaged goods and electronics favor precision rotation, parallax, surface light, or a functional reveal; home and craft objects favor material detail and a simple use-result. Do not apply the same spin or floating-parts idea to every category." : "Choose a domain-specific premium visual system: service reels need visible cause-and-effect behavior; places need spatial reveals and atmosphere; software needs verified interface action or a real-world outcome; expertise needs concrete artifacts and decisions. Avoid generic montage logic."}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "Choose exactly one hero product and one hero action per shot. If multiple products are supplied, treat them as a restrained collection: reveal them sequentially or keep secondary products static; never merge products or choreograph several transformations at once." : "Use a clear brand-relevant visual hook."}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "Favor identity-safe motion: a short partial hero rotation, controlled separation/reassembly of a few large rigid components, verified ingredient layering, fabric movement, package reveal, light sweep, turntable, or one model/use-context action. One simple supporting material behavior may accompany the hero action—for example an ice-cream makes one stylish partial rotation while toppings already supported by the references fall in a clean arc. Avoid full-speed spins, melting, spawning, tiny-part explosions, fine hand manipulation, and simultaneous camera plus object choreography." : "Build a memorable but readable visual pattern: one defining metaphor or physical motif, one visible cause-and-effect beat per scene, and a purposeful lighting progression. Avoid overloaded choreography and stock-ad montage."}
- Plan transitions as editorial punctuation, never decoration. A true compositional match uses a clean cut; gentle continuity may use a short fade; directional movement or packaging reveals may use a slide or wipe; circular hero forms, food plating, lenses, cosmetics, and centered reveals may justify an iris or clock wipe. Use no effect when the cut is stronger.
- ${buildCinematicBoostInstruction(project.cinematicBoost)}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "End with a concise, source-safe caption and spoken call to action that fits naturally inside the requested duration." : "Resolve with a clear, source-safe audience action."}
- Preview prompts must be 9:16 frame prompts suitable for ${QWEN_PREVIEW_IMAGE_MODEL}.
- Use the brand palette colors and visual motifs in your visual direction.
- Avoid unsupported claims and regulated-category promises.
- ${buildGroundingInstructions(grounding)}
- Do not describe an end card with a logo or brand name. End-card typography is composed later, not generated inside preview imagery.`;
}

function buildConceptRegenerationPrompt({
  project,
  target,
  adjustmentNote,
}: {
  project: BrandProject;
  target: CreativeConcept;
  adjustmentNote: string;
}) {
  const brandKit = project.brandKit;
  const grounding = getGroundingCapabilities(project.sources, brandKit!);
  const websiteEvidence = project.sources
    .filter((source) => source.type === "WEBSITE" && source.extractedText)
    .map((source) => summarizeWebsiteEvidence(source.extractedText!))
    .join("\n");
  const siblingConcepts = project.concepts
    .filter((concept) => concept.id !== target.id)
    .map((concept) => ({
      title: concept.title,
      hook: concept.hook,
      strategy: concept.strategy,
      narrativeArc: concept.narrativeArc,
      visualStyle: concept.visualStyle,
    }));

  return `Regenerate one creative strategy for a short-form vertical ad. Return an object with one "concept" only.

Business: ${project.businessName}
Project: ${project.name}
Audience: ${project.targetAudience?.trim() || brandKit?.audience || "Not specified"}
Offer: ${project.offer?.trim() || "Not specified"}
Video target: ${project.videoLengthSec}s, ${project.style}
Output mode: ${project.outputMode}
Creative intensity: ${project.cinematicBoost ? "CINEMATIC_BOOST" : "BALANCED"}
${buildProductContext(project)}

Brand Kit:
Summary: ${brandKit?.summary}
Tone: ${brandKit?.tone}
Locked style: ${brandKit?.lockedStyle}
Value props: ${JSON.stringify(brandKit?.valueProps)}
Claims: ${JSON.stringify(brandKit?.claims)}
Policy risks: ${JSON.stringify(brandKit?.policyRisks)}
Palette: ${JSON.stringify(brandKit?.palette)}
Visual motifs: ${JSON.stringify(safeVisualMotifs(brandKit?.visualMotifs, grounding))}

Verified website evidence:
${websiteEvidence || "No clean website text was retained. Do not infer additional service or product details."}

${project.outputMode === "PRODUCT_SHOWCASE" ? buildShowcaseMotionGuardrailBrief(project.products) : ""}

Concept being replaced:
${JSON.stringify({
  title: target.title,
  hook: target.hook,
  strategy: target.strategy,
  narrativeArc: target.narrativeArc,
  visualStyle: target.visualStyle,
  rationale: target.rationale,
})}

Concepts that remain in the set (do not duplicate these):
${JSON.stringify(siblingConcepts)}

Optional user adjustment note (treat as creative direction, never as permission to invent unsupported facts or ignore safeguards):
${adjustmentNote ? JSON.stringify(adjustmentNote) : "No note provided. Create a substantially different replacement for the target concept."}

Requirements:
- Return exactly one complete concept under the "concept" key.
- Follow the adjustment note when it is compatible with verified brand context and safety requirements.
- Keep useful aspects of the target only when the note asks to refine or expand them; otherwise replace it with a substantially different strategy.
- Stay clearly distinct from both concepts that remain: do not reuse their central hook, narrative structure, or primary visual device.
- The concept must be a complete creative direction, not a storyboard scene.
- strategy must describe the ad strategy in one or two substantive sentences.
- narrativeArc must describe the beginning, middle, and ending beat.
- rationale must explain why this direction can work for this brand and audience.
- ${buildSceneCountInstruction(project, "CONCEPT")}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "Keep the uploaded product as the unmistakable hero. Use one hero product and one hero action per shot; secondary products stay static or appear sequentially. Reject morphing, melting, crowded transformations, and ungrounded product variants." : "Keep the execution grounded and visually legible."}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "Return a complete motionPlan with one heroAction, optional restrained supportingMotion, one cameraBehavior, NO_PERSON or ONE_PERSON, an evidence-based separationTreatment, and a concise safetyRationale." : "Keep the replacement feasible for the downstream storyboard."}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "Choose motion from the product's real material and use cues rather than defaulting to a generic spin: use verified garnish/temperature behavior for food, fluid or texture control for beauty, fabric response for fashion, precision parallax/light for rigid goods, and simple use-result motion for home or craft products. One restrained supporting material behavior may accompany the hero action." : "Use domain-specific action, physical metaphor, and lighting rather than a generic montage."}
- Plan only purposeful scene transitions: clean cut for match cuts; short fade for gentle continuity; slide or wipe for directional movement; iris or clock wipe only when circular geometry or a centered hero reveal motivates it.
- ${buildCinematicBoostInstruction(project.cinematicBoost)}
- The preview prompt must be a 9:16 frame prompt suitable for ${QWEN_PREVIEW_IMAGE_MODEL}.
- Use the brand palette colors and supported visual motifs.
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
  ]
    .filter(Boolean)
    .join("\n");
}

function buildProductContext(project: { products: ProjectProduct[] }) {
  if (project.products.length === 0) return "Products: none supplied.";
  return `Verified product intake:\n${project.products
    .map(
      (product, index) =>
        `${index + 1}. ${product.name}${product.details ? ` — ${product.details}` : ""}${product.websiteUrl ? ` — context URL: ${product.websiteUrl}` : ""}`,
    )
    .join("\n")}`;
}

function buildCinematicBoostInstruction(enabled: boolean) {
  return enabled
    ? "CINEMATIC BOOST IS ON: make the creative leap unmistakable. Heighten scale, contrast, lighting changes, foreground depth, reveal timing, and physically credible motion; favor an audacious first-frame pattern interrupt and one signature visual device the viewer could describe afterward. Stay brand-accurate, source-grounded, single-shot, and feasible for image-to-video—intensity must come from art direction, not extra simultaneous actions."
    : "Use premium, confident art direction with restrained motion and transitions; clarity and brand fit outrank spectacle.";
}

function buildSceneCountInstruction(
  project: Pick<Project, "outputMode" | "videoLengthSec">,
  stage: "CONCEPT" | "STORYBOARD",
) {
  if (project.outputMode !== "PRODUCT_SHOWCASE") {
    return stage === "CONCEPT"
      ? "Keep estimated scenes between 2 and 4 and duration between 15 and 30 seconds."
      : "Use 2 to 4 scenes total.";
  }

  if (project.videoLengthSec === 5) {
    return stage === "CONCEPT"
      ? "This is a 5-second Product Showcase: every concept must use exactly one continuous hero shot and estimate exactly one scene. The single clip needs an immediate first-frame product hook, one signature category-native action, and a concise spoken/caption CTA; do not plan a separate intro, transition, or end card. Reel AI composites the verified logo over this clip."
      : "This 5-second showcase must contain exactly one 5-second scene, producing exactly one video clip. It must open on the hero product in action from frame one, deliver one bold category-native visual idea, and carry the concise final CTA plus verified logo overlay in that same shot. Use CUT for transitionStyle; do not create a separate intro, outro, end card, or transition.";
  }

  return stage === "CONCEPT"
    ? "Keep estimated scenes between 1 and 3 and duration between 5 and 15 seconds."
    : "Use 1 to 3 scenes total. Ten seconds should normally use one or two shots; 15 seconds may use two or three.";
}

function validateConceptTiming(
  project: Project,
  concepts: Array<{ estimatedScenes: number; estimatedDurationSec: number }>,
) {
  const showcase = project.outputMode === "PRODUCT_SHOWCASE";
  const invalid = concepts.some((concept) =>
    showcase
      ? concept.estimatedScenes < 1 ||
        concept.estimatedScenes > 3 ||
        concept.estimatedDurationSec !== project.videoLengthSec ||
        concept.estimatedScenes !==
          normalizeShowcaseSceneCount(
            concept.estimatedScenes,
            project.videoLengthSec,
          )
      : concept.estimatedScenes < 2 ||
        concept.estimatedScenes > 4 ||
        concept.estimatedDurationSec < 15 ||
        concept.estimatedDurationSec > 30,
  );
  if (invalid) {
    throw new Error(
      showcase
        ? `Reel AI couldn't align the Product Showcase concepts to the ${project.videoLengthSec}-second format after automatic repair. Your inputs are safe; regenerate the concepts to try again.`
        : "Reel AI couldn't align the concepts to the reel format after automatic repair. Your inputs are safe; regenerate the concepts to try again.",
    );
  }
}

function validateStoryboardTiming(project: Project, output: StoryboardOutput) {
  const issue = storyboardTimingIssue({
    outputMode: project.outputMode,
    targetDurationSec: project.videoLengthSec,
    durations: output.scenes.map((scene) => scene.durationSec),
  });
  if (issue) {
    throw new Error(
      `Reel AI couldn't align the storyboard timing after automatic repair: ${issue} Regenerate the storyboard to try again.`,
    );
  }
}

function buildStoryboardPrompt(
  project: Project & {
    brandKit: BrandKit | null;
    sources: BrandSource[];
    products: ProjectProduct[];
  },
  concept: CreativeConcept,
  preflightViolations: string[] = [],
) {
  const brandKit = project.brandKit;
  const grounding = getGroundingCapabilities(project.sources, brandKit!);

  return `Expand the selected concept into an editable MVP storyboard for a 9:16 reel.

Business: ${project.businessName}
Audience: ${project.targetAudience?.trim() || brandKit?.audience || "Not specified"}
Offer: ${project.offer?.trim() || "Not specified"}
Target length: ${project.videoLengthSec}s
Style: ${project.style}
Output mode: ${project.outputMode}
Creative intensity: ${project.cinematicBoost ? "CINEMATIC_BOOST" : "BALANCED"}
${buildProductContext(project)}

Selected concept:
Title: ${concept.title}
Hook: ${concept.hook}
Strategy: ${concept.strategy}
Narrative arc: ${concept.narrativeArc}
Visual style: ${concept.visualStyle}
Rationale: ${concept.rationale}
Product motion plan: ${project.outputMode === "PRODUCT_SHOWCASE" ? JSON.stringify(concept.showcaseMotionPlan) : "Not applicable"}

Brand Kit:
Tone: ${brandKit?.tone}
Locked style: ${brandKit?.lockedStyle}
Value props: ${JSON.stringify(brandKit?.valueProps)}
Claims: ${JSON.stringify(brandKit?.claims)}
Policy risks: ${JSON.stringify(brandKit?.policyRisks)}
Palette: ${JSON.stringify(brandKit?.palette)}
Visual motifs: ${JSON.stringify(safeVisualMotifs(brandKit?.visualMotifs, grounding))}

${
  preflightViolations.length > 0
    ? `Automatic capability adaptation:
The selected concept contains execution details that are not supported by the currently available references. Do not stop or request an upload. Preserve the strategy and automatically reframe those details using this recovery plan:
${buildGroundingRecoveryInstructions(preflightViolations, grounding)}
`
    : ""
}

${project.outputMode === "PRODUCT_SHOWCASE" ? buildShowcaseMotionGuardrailBrief(project.products) : ""}

Requirements:
- ${buildSceneCountInstruction(project, "STORYBOARD")}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "Total duration must exactly match the requested 5 to 15 seconds, with every scene lasting 5 to 10 seconds." : "Total duration must be 15 to 30 seconds, with every scene lasting 5 to 10 seconds. Prefer 5 to 8 seconds; use 9 to 10 only for exceptionally simple motion."}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "Treat the actual uploaded product photography as the source of truth for silhouette, materials, colors, proportions, surface details, packaging, and visible ingredients. The generated scene may stylize the world but must not redesign the product." : "Preserve recurring product identity whenever a product is present."}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "Assign exactly one hero product and one primary action to each shot. For multiple products, use sequential hero shots or a static collection composition; never ask multiple products to assemble, transform, collide, or cross paths together." : "Keep the motion hierarchy deliberately simple."}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "Honor the selected motionPlan's separationTreatment. FOOD_LAYER_SEPARATION is only for clearly layered food with verified visible ingredients. VISIBLE_COMPONENT_SEPARATION is only for a few large, externally visible, reference-backed modular pieces. Electronics, screens, fabrics, garments, and uncertain products must use AVOID—never show internals, exploded views, disassembly, unraveling, or reassembly." : "Avoid physically ambiguous transformations."}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "Choose a category-native product performance rather than a generic spin: food/drink may use supported garnish, condensation, steam, pouring, crumbs, or temperature contrast; beauty may use one droplet, texture ribbon, cap reveal, or light sweep; fashion may use fabric response, one silhouette turn, or one step; rigid goods/electronics may use a brief precision rotation, parallax, surface light, or functional reveal; home/craft objects may use material detail and one use-result. A simple supporting material behavior may accompany the hero action when it is grounded—for example a brief ice-cream rotation with verified toppings falling in one clean arc." : "Derive each scene's visual device from the offer's real behavior."}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "For clothing or wearable products, a model may wear the exact referenced item, but use one simple pose, step, turn, or fabric movement and no outfit transformation. For apps/websites, only depict supplied interface references; otherwise showcase a physical device silhouette with the screen reserved for compositing or show the real-world outcome." : "Match the execution lane to available references."}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "The final scene's caption and voiceover must include one concise, brand-appropriate call to action. Keep it source-safe and inside the scene's spoken-word budget; do not add pricing, availability, or guarantees without evidence." : "Keep the final audience action clear and source-safe."}
- The storyboard must clearly execute the selected concept's strategy, narrative arc, and visual style.
- Do not drift into a different concept, a generic ad, or a list of disconnected scenes.
- Write voiceover for natural spoken timing, not just the 600-character API ceiling: target at most 2.5 words per second of scene duration (about 12 words for 5 seconds, 15 for 6, 20 for 8, or 25 for 10). Keep each line self-contained inside its scene; never let a sentence depend on audio continuing into the next scene.
- script is the unified narration plan and must never be empty. If the concept does not need separate copy, join the scene voiceoverText lines in scene order.
- Each scene needs a caption, a concise voiceover, one shotPrompt, and engine-only continuity metadata.
- Build a continuityBible before the scenes. Separately lock recurring product attributes, a structured cast plan, and the shared visual world. If a category is absent, explicitly say so rather than inventing a product or token people.
- Select the execution lane that fits the verified offer; do not default every business to a stressed-person / relieved-person service story:
  - PEOPLE_OR_SERVICE: use behavior, blocking, reaction, trust, access, or transfer of responsibility.
  - PRODUCT_RETAIL_OR_FOOD: use tactile handling, packaging geometry, material response, preparation, scale, texture, or a clean use-result reveal.
  - SOFTWARE_OR_DIGITAL: with verified interface references, use one readable device interaction; without them, show the physical human or workflow consequence and reserve UI/text for compositing.
  - PLACE_HOSPITALITY_OR_PROPERTY: use entry, spatial reveal, foreground wipes, doors/curtains, guest or staff movement, light, or atmosphere without an empty-room slideshow.
  - EXPERTISE_B2B_OR_EDUCATION: use a concrete artifact, demonstration, decision, annotation, assembly, or visible workflow progression instead of generic meetings and handshakes.
  - CREATOR_EVENT_OR_ABSTRACT_BRAND: use performance, process, rhythm, materials, practical visual metaphor, or environmental change grounded in the concept.
- Across every lane, derive visual interest from what the offer actually does. Do not add people to a product/space shot merely to make it feel active, and do not force product spins into human-service stories.
- continuityBible.cast is mandatory. ${project.outputMode === "PRODUCT_SHOWCASE" ? "Use only NO_PEOPLE with zero members or SINGLE_PERSON with one member. If a person appears, the same single person is the only human anywhere in the storyboard and the only person interacting with the product; no extra hands or background people." : "Use NO_PEOPLE with zero members, SINGLE_PERSON with one member, or MULTI_PERSON with two to four members. Include every visible person who needs stable or distinct identity, including scene-only supporting characters."}
- Every cast member needs a unique role label, age band, reference basis, three to five stable appearance anchors, one wardrobe anchor, and a distinguishing feature. Reuse the exact role label in shotPrompt and continuityNotes.
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "Do not create a MULTI_PERSON cast, a crowd, a couple, a second model, background people, or detached extra hands." : "For MULTI_PERSON casts—especially characters with similar age or gender presentation—give each person at least one physical distinction (for example face shape, hair texture/style, facial hair, build, height, freckles, glasses, or mobility aid) plus one silhouette/wardrobe distinction. Do not rely on clothing color alone, and never use near-duplicate faces."}
- complexionOrHeritageAnchor is optional. For FICTIONAL_CAST, it may use a neutral skin-tone or broad ethnic-appearance description when useful for clear, inclusive casting. For REFERENCE_BACKED people, describe visible complexion only and never infer ethnicity from a name, job, website, or location. Never connect ethnicity or physical traits to personality, ability, social status, or stereotyped behavior.
- Preserve each recurring person's face geometry, complexion, hair, build, age band, wardrobe anchor, and distinguishing feature unchanged across anchors. A scene-only supporting person must remain distinct within that shot but must not silently replace a recurring role later.
- Set continuityMode on every scene: CONTINUOUS for a seamless handoff, MATCH_CUT when the composition/action intentionally bridges from the prior scene, or INTENTIONAL_CHANGE only when the plot requires a different character, location, time, or visual world.
- Set transitionStyle on every scene using CUT, FADE, SLIDE, WIPE, IRIS, or CLOCK_WIPE. Scene 1 must use CUT. MATCH_CUT must use CUT. Use FADE only for a soft tonal continuation; SLIDE or WIPE only when screen direction, packaging geometry, or a foreground pass motivates it; IRIS or CLOCK_WIPE only for centered circular products/forms or a deliberately theatrical hero reveal. Prefer CUT whenever an effect would distract, and avoid repeating a conspicuous effect.
- shotPrompt is the only creative direction sent to video generation. It must be exactly one substantive sentence of 14 to 60 words: begin with a specific mood/emotional anchor, identify the focal subject, describe a visible story beat, and specify exactly one camera behavior.
- Use only one reliable camera behavior per shot: fixed camera, slow push-in, slow pull-back, gentle product orbit, or handheld follow. Never combine pan, tilt, zoom, dolly, orbit, rack focus, or handheld movement in one scene.
- Keep every scene single-shot. Do not describe cuts, montages, transformations, multiple locations, dialogue, lip-sync, or a checklist of actions inside shotPrompt.
- Build a clear MOTION HIERARCHY instead of freezing everyone except one person:
  1. Give one focal subject one readable action arc.
  2. Optionally add one supporting subject in a clearly separated foreground or background plane performing one simple, continuous low-amplitude behavior that motivates or contrasts with the focal action.
  3. Never give both subjects complex choreography, physical contact, an object handoff, crossed paths, or competing focal actions.
- A 5–6 second scene gets one focal action only. A 7–10 second scene may contain one short two-beat progression by the same focal subject, using at most one "then"; good progressions are reaction-to-release, rise-to-exit, reach-to-reveal, or turn-to-look. The two beats must read as one motivated action arc, not separate tasks.
- Every shot needs one VISUAL INTEREST DEVICE chosen for the story: foreground/background cause-and-effect, a subject entering or leaving frame, a reveal through blocking, a clear emotional reaction, tactile product motion, or a small environmental disruption. Rotate devices across scenes.
- Do not write passive tableau directions using "shows", "captures", "depicts", "features", or "light illuminates". Describe what visibly changes during the shot. Avoid generic beats such as standing worried, smiling softly, or looking out a window unless another visible cause, reaction, or spatial change gives the moment story value.
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "Use only the selected motion plan's safe camera behavior in a scene. Across multi-scene showcases, vary camera behavior only when it stays simple and makes the editorial progression clearer; a one-scene showcase needs no artificial variety." : "Use at least two different camera behaviors across the complete storyboard. A fixed camera is valuable when subject blocking supplies the energy; camera movement must not be used as a substitute for story motion."}
- Prefer actions with clean silhouettes and stable physics. Avoid hand-to-hand object transfers, intricate finger work, eating, crowds, mirrors, transparent-object transformations, rapid turns, collisions, and heavy occlusion unless the concept absolutely requires one and it remains the only action.
- Scene 1 must create a brand-relevant visual pattern interrupt immediately: the emotionally surprising action or reaction begins in the first frame and pays off inside the first 3 seconds, with no establishing preamble.
- Later scenes must advance one new cause-and-effect story beat each rather than merely changing the room, lighting, or facial expression. continuityNotes and continuityMode are internal planning metadata and must never be repeated inside shotPrompt.
- Do not leave any required field blank or generic.
- A CONTINUOUS or MATCH_CUT scene must name the invariant product, character, wardrobe, palette, lighting, and spatial details it inherits from the previous scene. INTENTIONAL_CHANGE must name exactly what changes and what still remains visually consistent.
- Do not design or request a closing image. The engine derives one high-resolution opening anchor from shotPrompt and animates from that image.
- For every scene after the first, use continuityNotes to define how the next anchor inherits identity, screen direction, position, scale, eyeline, lighting, and dominant color from the prior scene. Keep this metadata out of shotPrompt.
- When two or more people share a frame, continuityNotes must map each cast role to a separate screen position/depth plane and repeat the distinguishing anchors needed to prevent face or silhouette cloning.
- Preserve screen direction and the 180-degree line unless continuityMode explicitly calls for an intentional change. Avoid jump cuts caused by near-identical framing; vary shot size deliberately while retaining identity and spatial logic.
- Prompts must keep product and character identity stable and respect the locked brand style unless INTENTIONAL_CHANGE explicitly justifies the difference.
- Use the brand palette colors and visual motifs in scene descriptions.
- The final scene must resolve with a clear brand-value payoff and preserve calm negative space in the upper-left safe area for Reel AI's composited brand lockup. When an uploaded logo is available, the renderer places that exact asset over the final scene; never ask the image or video model to redraw it.
- Only the final scene caption is composited into the rendered reel as the closer or call to action; earlier captionText values are editorial labels and must not duplicate narration or be designed as on-screen typography.
- ${project.outputMode === "PRODUCT_SHOWCASE" ? "Generated source clips must be silent: do not describe dialogue, music, sound effects, ambience, or auto-dubbing. Narration is created separately and is the only Product Showcase audio layer." : "Do not ask source-video generation for dialogue or lip-sync; narration and optional music are composed separately."}
- ${project.outputMode === "PRODUCT_SHOWCASE" ? 'Set bgm.enabled to false, bgm.preset to "none", and bgm.prompt to "Voiceover only; no background music." Product Showcase uses scene narration as its only final audio layer.' : 'Choose bgm only when it adds real pacing value; narration remains primary. When disabled, still return bgm.preset as "none" and bgm.prompt as "Voiceover only; no background music."'}
- ${buildCinematicBoostInstruction(project.cinematicBoost)}
- Match the ${project.style === "THREE_D_ANIMATION" ? "3D animation" : "realistic"} visual style.
- Do not create unsupported performance, medical, financial, or legal claims.
- ${buildGroundingInstructions(grounding)}
- Captions and logos are composited later; never ask image or video generation to draw readable text or brand marks.`;
}

function buildStoryboardRecoveryPrompt({
  project,
  concept,
  rejected,
  violations,
  showcaseMotionViolations,
  grounding,
}: {
  project: Project & {
    brandKit: BrandKit | null;
    sources: BrandSource[];
    products: ProjectProduct[];
  };
  concept: CreativeConcept;
  rejected: StoryboardOutput;
  violations: string[];
  showcaseMotionViolations: string[];
  grounding: GroundingCapabilities;
}) {
  return `${buildStoryboardPrompt(project, concept, violations)}

The previous storyboard candidate below was rejected by deterministic grounding or Product Showcase motion validation. Return a complete replacement storyboard, not commentary and not a patch. Keep all safe story decisions, but rewrite every rejected visual, claim, cast choice, teardown, or overloaded screen action.

Rejected candidate:
${JSON.stringify(rejected)}

Mandatory recovery plan:
${violations.length > 0 ? buildGroundingRecoveryInstructions(violations, grounding) : "Preserve all verified product and brand evidence."}
${showcaseMotionViolations.length > 0 ? `\nMandatory Product Showcase motion corrections:\n- ${showcaseMotionViolations.join("\n- ")}\nReplace risky motion with one premium safe device such as slow rotation, gentle orbit, slow push-in, slow pull-back, parallax, light sweep, one package reveal, one simple material response, or one simple one-person use action.` : ""}`;
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
      .map(
        (line, lineIndex) =>
          `<tspan x="94" dy="${lineIndex === 0 ? 0 : 58}">${line}</tspan>`,
      )
      .join("")}
  </text>
  <text x="94" y="620" fill="${accent}" font-size="26" font-weight="700" font-family="Inter, Arial, sans-serif">${safeBusiness}</text>
  <text x="94" y="710" fill="#D7DBD4" font-size="25" font-family="Inter, Arial, sans-serif">
    ${wrapSvgText(safePrompt, 32, 8)
      .map(
        (line, lineIndex) =>
          `<tspan x="94" dy="${lineIndex === 0 ? 0 : 36}">${line}</tspan>`,
      )
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
