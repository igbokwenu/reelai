import "server-only";

import type { Artifact, Prisma, Scene, Storyboard, Take } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { generateImageWithQwen } from "@/lib/qwen/image";
import {
  QWEN_I2V_MODEL,
  pollVideoTask,
  sanitizeVideoError,
  submitImageToVideoTask,
} from "@/lib/qwen/video";
import { createArtifactFromUrl } from "@/lib/media/artifacts";

export const QWEN_KEYFRAME_IMAGE_MODEL = "wan2.7-image-pro";

type ProductionScene = Scene & {
  takes: Take[];
  storyboard: Pick<
    Storyboard,
    "productContinuity" | "characterContinuity" | "visualContinuity"
  >;
};
type VideoJobOutput = {
  scenes: Array<{
    sceneId: string;
    takeId: string;
    taskId: string;
    status: "WAITING_PROVIDER" | "COMPLETE" | "FAILED";
    artifactId?: string;
    error?: string;
  }>;
};

export async function createAndRunKeyframeJob(projectId: string) {
  const scenes = await getApprovedScenes(projectId);
  const job = await prisma.generationJob.create({
    data: {
      projectId,
      type: "KEYFRAME",
      status: "QUEUED",
      model: QWEN_KEYFRAME_IMAGE_MODEL,
      input: {
        operation: "scene_keyframes",
        sceneIds: scenes.map((scene) => scene.id),
      },
    },
  });

  return runKeyframeJob(job.id);
}

export async function createAndRunVideoJob(projectId: string) {
  const scenes = await getApprovedScenes(projectId);
  const job = await prisma.generationJob.create({
    data: {
      projectId,
      type: "VIDEO",
      status: "QUEUED",
      model: QWEN_I2V_MODEL,
      input: {
        operation: "scene_i2v",
        sceneIds: scenes.map((scene) => scene.id),
      },
    },
  });

  return runVideoSubmissionJob(job.id);
}

export async function selectTake(takeId: string) {
  const take = await prisma.take.findUnique({
    where: { id: takeId },
    include: { scene: true },
  });

  if (!take) {
    throw new Error("Take not found");
  }

  if (take.status !== "COMPLETE" || !take.artifactId) {
    throw new Error("Only completed takes with artifacts can be selected.");
  }

  const sceneUpdate =
    take.kind === "VIDEO"
      ? { selectedVideoTakeId: take.id }
      : take.kind === "KEYFRAME_END"
        ? { selectedEndFrameTakeId: take.id, selectedVideoTakeId: null }
        : { selectedKeyframeTakeId: take.id, selectedVideoTakeId: null };

  const siblingTakeFilter: Prisma.TakeWhereInput = {
    sceneId: take.sceneId,
    kind: take.kind,
  };

  await prisma.$transaction([
    prisma.take.updateMany({
      where: siblingTakeFilter,
      data: { selected: false },
    }),
    prisma.take.update({
      where: { id: take.id },
      data: { selected: true },
    }),
    prisma.scene.update({
      where: { id: take.sceneId },
      data: sceneUpdate,
    }),
    ...(take.kind === "VIDEO"
      ? []
      : [
          prisma.take.updateMany({
            where: { sceneId: take.sceneId, kind: "VIDEO" },
            data: { selected: false },
          }),
        ]),
  ]);

  return prisma.take.findUniqueOrThrow({ where: { id: take.id } });
}

export async function advanceVideoJob(jobId: string) {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });

  if (!job || job.type !== "VIDEO" || job.status !== "WAITING_PROVIDER") {
    return job;
  }

  const output = parseVideoOutput(job.output);
  const nextScenes = await Promise.all(
    output.scenes.map(async (sceneTask) => {
      if (sceneTask.status !== "WAITING_PROVIDER") {
        return sceneTask;
      }

      try {
        const providerStatus = await pollVideoTask(sceneTask.taskId);

        if (
          providerStatus.status === "PENDING" ||
          providerStatus.status === "RUNNING" ||
          providerStatus.status === "UNKNOWN"
        ) {
          return sceneTask;
        }

        if (providerStatus.status === "FAILED" || !providerStatus.videoUrl) {
          const error =
            providerStatus.message ??
            "QwenCloud video task failed before producing a durable URL.";
          await prisma.take.update({
            where: { id: sceneTask.takeId },
            data: { status: "FAILED", notes: error },
          });
          await prisma.scene.update({
            where: { id: sceneTask.sceneId },
            data: { status: "FAILED" },
          });

          return { ...sceneTask, status: "FAILED" as const, error };
        }

        const artifact = await createArtifactFromUrl({
          projectId: job.projectId,
          fileName: `scene-${sceneTask.sceneId}-take-${sceneTask.takeId}.mp4`,
          mimeType: "video/mp4",
          type: "VIDEO",
          url: providerStatus.videoUrl,
          metadata: {
            operation: "scene_i2v",
            model: job.model ?? QWEN_I2V_MODEL,
            providerTaskId: sceneTask.taskId,
            providerRequestId: providerStatus.providerRequestId,
          },
        });

        await prisma.$transaction([
          prisma.take.update({
            where: { id: sceneTask.takeId },
            data: {
              artifactId: artifact.id,
              status: "COMPLETE",
              selected: true,
              notes: "Completed QwenCloud image-to-video take.",
            },
          }),
          prisma.take.updateMany({
            where: {
              sceneId: sceneTask.sceneId,
              kind: "VIDEO",
              id: { not: sceneTask.takeId },
            },
            data: { selected: false },
          }),
          prisma.scene.update({
            where: { id: sceneTask.sceneId },
            data: {
              status: "COMPLETE",
              selectedVideoTakeId: sceneTask.takeId,
            },
          }),
        ]);

        return {
          ...sceneTask,
          status: "COMPLETE" as const,
          artifactId: artifact.id,
        };
      } catch (error) {
        const safeError = sanitizeVideoError(error);
        await prisma.take.update({
          where: { id: sceneTask.takeId },
          data: { status: "FAILED", notes: safeError },
        });
        await prisma.scene.update({
          where: { id: sceneTask.sceneId },
          data: { status: "FAILED" },
        });

        return { ...sceneTask, status: "FAILED" as const, error: safeError };
      }
    }),
  );
  const hasWaiting = nextScenes.some(
    (sceneTask) => sceneTask.status === "WAITING_PROVIDER",
  );
  const hasFailed = nextScenes.some(
    (sceneTask) => sceneTask.status === "FAILED",
  );
  const completed = !hasWaiting && !hasFailed;

  return prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: completed
        ? "COMPLETE"
        : hasFailed
          ? "FAILED"
          : "WAITING_PROVIDER",
      output: { scenes: nextScenes },
      error: hasFailed
        ? "One or more scene video tasks failed. Retry failed scenes from the Generation console."
        : null,
      completedAt: completed || hasFailed ? new Date() : null,
    },
  });
}

async function runKeyframeJob(jobId: string) {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date(), error: null },
  });
  const job = await prisma.generationJob.findUniqueOrThrow({
    where: { id: jobId },
  });

  try {
    await prisma.project.update({
      where: { id: job.projectId },
      data: { status: "GENERATING" },
    });

    const scenes = await getApprovedScenes(job.projectId);
    const groundingReferenceUrls = await getGroundingReferenceUrls(
      job.projectId,
    );
    const created = [];
    let previousEndReferenceUrl: string | null = null;

    for (const scene of scenes) {
      await prisma.scene.update({
        where: { id: scene.id },
        data: { status: "GENERATING" },
      });

      const startTake = await createKeyframeTake({
        projectId: job.projectId,
        scene,
        kind: "KEYFRAME_START",
        prompt: buildKeyframePrompt(scene, "start"),
        referenceImageUrls:
          previousEndReferenceUrl &&
          scene.continuityMode !== "INTENTIONAL_CHANGE"
            ? [previousEndReferenceUrl, ...groundingReferenceUrls].slice(0, 3)
            : groundingReferenceUrls,
      });
      const endTake = await createKeyframeTake({
        projectId: job.projectId,
        scene,
        kind: "KEYFRAME_END",
        prompt: buildKeyframePrompt(scene, "end"),
        referenceImageUrls: [
          startTake.providerImageUrl,
          ...groundingReferenceUrls,
        ].slice(0, 3),
      });
      previousEndReferenceUrl = endTake.providerImageUrl;
      created.push(startTake.take, endTake.take);
      await prisma.$transaction([
        prisma.take.updateMany({
          where: {
            sceneId: scene.id,
            kind: { in: ["KEYFRAME_START", "KEYFRAME_END"] },
          },
          data: { selected: false },
        }),
        prisma.take.updateMany({
          where: { id: { in: [startTake.take.id, endTake.take.id] } },
          data: { selected: true },
        }),
        prisma.take.updateMany({
          where: { sceneId: scene.id, kind: "VIDEO" },
          data: { selected: false },
        }),
        prisma.scene.update({
          where: { id: scene.id },
          data: {
            status: "APPROVED",
            selectedKeyframeTakeId: startTake.take.id,
            selectedEndFrameTakeId: endTake.take.id,
            selectedVideoTakeId: null,
          },
        }),
      ]);
    }

    await prisma.project.update({
      where: { id: job.projectId },
      data: { status: "DRAFT" },
    });

    return prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETE",
        output: {
          takeIds: created.map((take) => take.id),
          sceneCount: scenes.length,
        },
        completedAt: new Date(),
      },
    });
  } catch (error) {
    return failProductionJob(job.id, job.projectId, error);
  }
}

async function runVideoSubmissionJob(jobId: string) {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date(), error: null },
  });
  const job = await prisma.generationJob.findUniqueOrThrow({
    where: { id: jobId },
  });

  try {
    await prisma.project.update({
      where: { id: job.projectId },
      data: { status: "GENERATING" },
    });

    const scenes = await getApprovedScenes(job.projectId);
    const submitted = [];

    for (const scene of scenes) {
      const selectedFrames = await getSelectedKeyframeArtifacts(scene);

      if (!selectedFrames) {
        throw new Error(
          "Generate the recommended first and last frames before creating video clips.",
        );
      }

      const take = await createQueuedTake({
        sceneId: scene.id,
        kind: "VIDEO",
        prompt: buildVideoPrompt(scene),
      });

      await prisma.scene.update({
        where: { id: scene.id },
        data: { status: "GENERATING" },
      });

      const submission = await submitImageToVideoTask({
        operation: "scene_i2v",
        model: job.model ?? QWEN_I2V_MODEL,
        prompt: take.prompt,
        imageUrl: artifactUrl(selectedFrames.start),
        lastFrameUrl: artifactUrl(selectedFrames.end),
        durationSec: scene.durationSec,
      });

      await prisma.take.update({
        where: { id: take.id },
        data: {
          status: "RUNNING",
          notes: `Provider task ${submission.taskId}`,
        },
      });

      submitted.push({
        sceneId: scene.id,
        takeId: take.id,
        taskId: submission.taskId,
        status: "WAITING_PROVIDER" as const,
      });
    }

    const output: VideoJobOutput = { scenes: submitted };

    return prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "WAITING_PROVIDER",
        providerTaskId: submitted.map((item) => item.taskId).join(","),
        output: output as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    return failProductionJob(job.id, job.projectId, error);
  }
}

async function createKeyframeTake({
  projectId,
  scene,
  kind,
  prompt,
  referenceImageUrls,
}: {
  projectId: string;
  scene: ProductionScene;
  kind: "KEYFRAME_START" | "KEYFRAME_END";
  prompt: string;
  referenceImageUrls: string[];
}) {
  const queued = await createQueuedTake({ sceneId: scene.id, kind, prompt });

  try {
    const generated = await generateImageWithQwen({
      operation: "scene_keyframe",
      model: QWEN_KEYFRAME_IMAGE_MODEL,
      prompt,
      imageUrls: referenceImageUrls,
    });
    const artifact = await createArtifactFromUrl({
      projectId,
      fileName: `${scene.index}-${kind.toLowerCase()}-${queued.attempt}.png`,
      mimeType: "image/png",
      type: "IMAGE",
      url: generated.imageUrl,
      metadata: {
        operation: "scene_keyframe",
        model: generated.model,
        providerImageUrl: generated.imageUrl,
        providerRequestId: generated.providerRequestId,
        prompt,
        referenceImageCount: referenceImageUrls.length,
        sceneId: scene.id,
        takeId: queued.id,
      },
    });

    const take = await prisma.take.update({
      where: { id: queued.id },
      data: {
        status: "COMPLETE",
        artifactId: artifact.id,
        notes: "Completed QwenCloud keyframe.",
      },
    });

    return { take, providerImageUrl: generated.imageUrl };
  } catch (error) {
    const safeError =
      error instanceof Error
        ? error.message
        : "Keyframe generation failed. Check sanitized server logs.";

    await prisma.take.update({
      where: { id: queued.id },
      data: { status: "FAILED", notes: safeError },
    });

    throw new Error(safeError);
  }
}

async function createQueuedTake({
  sceneId,
  kind,
  prompt,
}: {
  sceneId: string;
  kind: "KEYFRAME_START" | "KEYFRAME_END" | "VIDEO";
  prompt: string;
}) {
  const attempt = await prisma.take.count({ where: { sceneId, kind } });

  return prisma.take.create({
    data: {
      sceneId,
      kind,
      attempt: attempt + 1,
      prompt,
      status: "QUEUED",
    },
  });
}

async function getApprovedScenes(projectId: string) {
  const storyboard = await prisma.storyboard.findUnique({
    where: { projectId },
    include: {
      scenes: {
        include: { takes: { orderBy: { createdAt: "desc" } } },
        orderBy: { index: "asc" },
      },
    },
  });

  if (!storyboard) {
    throw new Error("Generate and save a storyboard before production.");
  }

  if (storyboard.status !== "APPROVED" && storyboard.status !== "COMPLETE") {
    throw new Error("Save and approve the storyboard before generation.");
  }

  const scenes = storyboard.scenes.filter((scene) =>
    ["APPROVED", "COMPLETE"].includes(scene.status),
  );

  if (scenes.length < 2 || scenes.length > 4) {
    throw new Error("Phase 5 supports 2 to 4 approved scenes.");
  }

  return scenes.map((scene) => ({
    ...scene,
    storyboard: {
      productContinuity: storyboard.productContinuity,
      characterContinuity: storyboard.characterContinuity,
      visualContinuity: storyboard.visualContinuity,
    },
  }));
}

async function getGroundingReferenceUrls(projectId: string) {
  const sources = await prisma.brandSource.findMany({
    where: {
      projectId,
      artifactId: { not: null },
      type: { in: ["PRODUCT_IMAGE", "LOGO", "REFERENCE_AD", "UPLOAD"] },
    },
    orderBy: { createdAt: "asc" },
  });
  const artifactIds = sources
    .map((source) => source.artifactId)
    .filter((id): id is string => Boolean(id));

  if (artifactIds.length === 0) return [];

  const artifacts = await prisma.artifact.findMany({
    where: {
      id: { in: artifactIds },
      mimeType: { startsWith: "image/" },
    },
  });
  const artifactById = new Map(
    artifacts.map((artifact) => [artifact.id, artifact]),
  );

  return sources
    .map((source) =>
      source.artifactId ? artifactById.get(source.artifactId) : null,
    )
    .filter((artifact): artifact is Artifact => Boolean(artifact))
    .map((artifact) => artifact.publicUrl)
    .filter((url): url is string =>
      Boolean(url?.startsWith("https://") || url?.startsWith("http://")),
    )
    .slice(0, 3);
}

async function getSelectedKeyframeArtifacts(scene: ProductionScene) {
  const startTake =
    scene.takes.find(
      (take) =>
        take.id === scene.selectedKeyframeTakeId &&
        take.kind === "KEYFRAME_START" &&
        take.status === "COMPLETE",
    ) ??
    scene.takes.find(
      (take) =>
        take.kind === "KEYFRAME_START" &&
        take.status === "COMPLETE" &&
        take.artifactId,
    );
  const endTake =
    scene.takes.find(
      (take) =>
        take.id === scene.selectedEndFrameTakeId &&
        take.kind === "KEYFRAME_END" &&
        take.status === "COMPLETE",
    ) ??
    scene.takes.find(
      (take) =>
        take.kind === "KEYFRAME_END" &&
        take.status === "COMPLETE" &&
        take.artifactId,
    );

  if (!startTake?.artifactId || !endTake?.artifactId) {
    return null;
  }

  const [start, end] = await Promise.all([
    prisma.artifact.findUnique({ where: { id: startTake.artifactId! } }),
    prisma.artifact.findUnique({ where: { id: endTake.artifactId! } }),
  ]);

  return start && end ? { start, end } : null;
}

function artifactUrl(artifact: Artifact) {
  if (artifact.publicUrl?.startsWith("http")) {
    return artifact.publicUrl;
  }

  const publicAppUrl = process.env.PUBLIC_APP_URL;

  if (publicAppUrl && !publicAppUrl.toLowerCase().includes("placeholder")) {
    return `${publicAppUrl.replace(/\/$/, "")}/api/artifacts/${artifact.id}/file`;
  }

  throw new Error(
    "PUBLIC_APP_URL must be configured so QwenCloud can read selected keyframes.",
  );
}

function buildKeyframePrompt(
  scene: ProductionScene,
  position: "start" | "end",
) {
  const basePrompt =
    position === "start" ? scene.startFramePrompt : scene.endFramePrompt;

  return `${basePrompt}

Locked brand style: ${scene.lockedStyleLanguage}
Product continuity: ${scene.storyboard.productContinuity}
Character continuity: ${scene.storyboard.characterContinuity}
Visual-world continuity: ${scene.storyboard.visualContinuity}
Transition mode: ${scene.continuityMode}
Scene continuity: ${scene.continuityNotes}
Caption context: ${scene.captionText}
${scene.continuityMode === "INTENTIONAL_CHANGE" ? "Honor only the explicitly described plot change; preserve every other locked identity and style attribute." : "Treat supplied reference imagery as identity and composition guidance; do not redesign recurring products or characters."}
Use a vertical 9:16 composition, brand palette fidelity, consistent product/character styling, ad-safe commercial polish, no extra text unless requested.`;
}

function buildVideoPrompt(scene: ProductionScene) {
  return `${scene.videoMotionPrompt}

Animate from the approved opening frame to the approved closing frame over ${scene.durationSec} seconds. Arrive cleanly at the closing composition; do not introduce a different ending.
Locked brand style: ${scene.lockedStyleLanguage}
Product continuity: ${scene.storyboard.productContinuity}
Character continuity: ${scene.storyboard.characterContinuity}
Visual-world continuity: ${scene.storyboard.visualContinuity}
Transition mode: ${scene.continuityMode}
Continuity notes: ${scene.continuityNotes}
Caption context: ${scene.captionText}
Keep motion smooth, vertical 9:16, commercial social ad pacing, no unsupported claims, no new logos or text overlays beyond the approved storyboard copy.`;
}

async function failProductionJob(
  jobId: string,
  projectId: string,
  error: unknown,
) {
  const safeError = sanitizeVideoError(error);
  const failed = await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      error: safeError,
      completedAt: new Date(),
    },
  });

  await prisma.project.update({
    where: { id: projectId },
    data: { status: "FAILED" },
  });

  return failed;
}

function parseVideoOutput(value: Prisma.JsonValue | null): VideoJobOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { scenes: [] };
  }

  const scenes = (value as { scenes?: unknown }).scenes;

  if (!Array.isArray(scenes)) {
    return { scenes: [] };
  }

  return {
    scenes: scenes
      .map((scene) => scene as VideoJobOutput["scenes"][number])
      .filter((scene) => scene.sceneId && scene.takeId && scene.taskId),
  };
}
