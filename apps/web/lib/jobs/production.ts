import "server-only";

import type { Artifact, Prisma, Scene, Take } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { generateImageWithQwen } from "@/lib/qwen/image";
import {
  QWEN_I2V_MODEL,
  pollVideoTask,
  sanitizeVideoError,
  submitImageToVideoTask,
} from "@/lib/qwen/video";
import { storeObject } from "@/lib/oss";

export const QWEN_KEYFRAME_IMAGE_MODEL = "wan2.7-image-pro";

type ProductionScene = Scene & { takes: Take[] };
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
      : { selectedKeyframeTakeId: take.id };

  await prisma.$transaction([
    prisma.take.updateMany({
      where: {
        sceneId: take.sceneId,
        kind: take.kind,
      },
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
              notes: "Completed QwenCloud image-to-video take.",
            },
          }),
          prisma.scene.update({
            where: { id: sceneTask.sceneId },
            data: { status: "COMPLETE" },
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
  const hasFailed = nextScenes.some((sceneTask) => sceneTask.status === "FAILED");
  const completed = !hasWaiting && !hasFailed;

  return prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: completed ? "COMPLETE" : hasFailed ? "FAILED" : "WAITING_PROVIDER",
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
    const created = [];

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
      });
      const endTake = await createKeyframeTake({
        projectId: job.projectId,
        scene,
        kind: "KEYFRAME_END",
        prompt: buildKeyframePrompt(scene, "end"),
      });

      created.push(startTake, endTake);
      await prisma.scene.update({
        where: { id: scene.id },
        data: {
          status: "APPROVED",
          selectedKeyframeTakeId:
            scene.selectedKeyframeTakeId ?? startTake.id,
        },
      });
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
      const selectedImage = await getSelectedKeyframeArtifact(scene);

      if (!selectedImage) {
        throw new Error(
          "Generate and select keyframes before submitting video clips.",
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
        imageUrl: artifactUrl(selectedImage),
        durationSec: scene.durationSec,
      });

      await prisma.take.update({
        where: { id: take.id },
        data: { status: "RUNNING", notes: `Provider task ${submission.taskId}` },
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
}: {
  projectId: string;
  scene: ProductionScene;
  kind: "KEYFRAME_START" | "KEYFRAME_END";
  prompt: string;
}) {
  const queued = await createQueuedTake({ sceneId: scene.id, kind, prompt });

  try {
    const generated = await generateImageWithQwen({
      operation: "scene_keyframe",
      model: QWEN_KEYFRAME_IMAGE_MODEL,
      prompt,
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
        sceneId: scene.id,
        takeId: queued.id,
      },
    });

    return prisma.take.update({
      where: { id: queued.id },
      data: {
        status: "COMPLETE",
        artifactId: artifact.id,
        notes: "Completed QwenCloud keyframe.",
      },
    });
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

  const scenes = storyboard.scenes.filter((scene) => scene.status === "APPROVED");

  if (scenes.length < 2 || scenes.length > 4) {
    throw new Error("Phase 5 supports 2 to 4 approved scenes.");
  }

  return scenes;
}

async function getSelectedKeyframeArtifact(scene: ProductionScene) {
  const selectedTake =
    scene.takes.find((take) => take.id === scene.selectedKeyframeTakeId) ??
    scene.takes.find(
      (take) =>
        take.kind === "KEYFRAME_START" &&
        take.status === "COMPLETE" &&
        take.artifactId,
    );

  if (!selectedTake?.artifactId) {
    return null;
  }

  return prisma.artifact.findUnique({ where: { id: selectedTake.artifactId } });
}

async function createArtifactFromUrl({
  projectId,
  fileName,
  mimeType,
  type,
  url,
  metadata,
}: {
  projectId: string;
  fileName: string;
  mimeType: string;
  type: "IMAGE" | "VIDEO";
  url: string;
  metadata: Prisma.InputJsonValue;
}) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Provider output could not be copied into durable storage.");
  }

  const body = Buffer.from(await response.arrayBuffer());
  const stored = await storeObject({
    projectId,
    fileName,
    mimeType: response.headers.get("content-type") ?? mimeType,
    body,
  });

  return prisma.artifact.create({
    data: {
      projectId,
      type,
      ossKey: stored.key,
      publicUrl: stored.publicUrl,
      mimeType: response.headers.get("content-type") ?? mimeType,
      metadata: {
        ...(metadata as Record<string, unknown>),
        sourceCopiedToDurableStorage: true,
        storageMode: stored.storageMode,
      },
    },
  });
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
  scene: Scene,
  position: "start" | "end",
) {
  const basePrompt =
    position === "start" ? scene.startFramePrompt : scene.endFramePrompt;

  return `${basePrompt}

Locked brand style: ${scene.lockedStyleLanguage}
Scene continuity: ${scene.continuityNotes}
Caption context: ${scene.captionText}
Use a vertical 9:16 composition, brand palette fidelity, consistent product/character styling, ad-safe commercial polish, no extra text unless requested.`;
}

function buildVideoPrompt(scene: Scene) {
  return `${scene.videoMotionPrompt}

Animate from the selected scene keyframe for ${scene.durationSec} seconds.
Locked brand style: ${scene.lockedStyleLanguage}
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
