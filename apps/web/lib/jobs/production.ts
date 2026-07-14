import "server-only";

import type { Artifact, Prisma, Scene, Storyboard, Take } from "@prisma/client";

import { PublicError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { generateImageWithQwen } from "@/lib/qwen/image";
import {
  QWEN_I2V_MODEL,
  pollVideoTask,
  sanitizeVideoError,
  submitImageToVideoTask,
} from "@/lib/qwen/video";
import { createArtifactFromUrl } from "@/lib/media/artifacts";
import {
  hasExactSceneCoverage,
  isStalePollClaim,
  parseVideoJobOutput,
  selectRequestedScenes,
  selectVideoGenerationTargets,
  stableSceneStatus,
  summarizeVideoTasks,
  type VideoJobOutput,
  type VideoSceneTask,
} from "@/lib/jobs/production-state";

export const QWEN_KEYFRAME_IMAGE_MODEL = "wan2.7-image-pro";
const VIDEO_NEGATIVE_PROMPT =
  "deformed anatomy, extra limbs, duplicated subjects, morphing, warping, flicker, jitter, abrupt camera changes, frozen motion, text, logos, watermark";

type ProductionScene = Scene & {
  takes: Take[];
  storyboard: Pick<
    Storyboard,
    | "projectId"
    | "productContinuity"
    | "characterContinuity"
    | "visualContinuity"
  >;
};
const ACTIVE_PRODUCTION_JOB_STATUSES = [
  "QUEUED",
  "RUNNING",
  "WAITING_PROVIDER",
] as const;
const VIDEO_PROVIDER_TIMEOUT_MS = 60 * 60 * 1000;
const STALE_PRODUCTION_JOB_MS = 30 * 60 * 1000;

export async function createAndRunKeyframeJob(projectId: string) {
  const scenes = await getProductionScenes(projectId);
  const job = await createProductionJob({
    projectId,
    type: "KEYFRAME",
    model: QWEN_KEYFRAME_IMAGE_MODEL,
    operation: "scene_keyframes",
    sceneIds: scenes.map((scene) => scene.id),
  });

  return runKeyframeJob(job.id);
}

export async function createAndRunVideoJob(projectId: string) {
  const scenes = await getProductionScenes(projectId);
  const targets = selectVideoGenerationTargets(scenes);
  const job = await createProductionJob({
    projectId,
    type: "VIDEO",
    model: QWEN_I2V_MODEL,
    operation: "scene_i2v",
    sceneIds: targets.map((scene) => scene.id),
  });

  return runVideoSubmissionJob(job.id);
}

export async function createAndRunSceneVideoJob(
  projectId: string,
  sceneId: string,
) {
  const scenes = await getProductionScenes(projectId);
  const scene = scenes.find((candidate) => candidate.id === sceneId);
  if (!scene) {
    throw new PublicError("Scene not found in this project's storyboard.", 404);
  }

  const job = await createProductionJob({
    projectId,
    type: "VIDEO",
    model: QWEN_I2V_MODEL,
    operation: "scene_i2v_retry",
    sceneIds: [scene.id],
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

  if (take.kind === "KEYFRAME_END") {
    throw new PublicError(
      "Legacy closing frames are history only. Select or generate a scene anchor instead.",
      409,
    );
  }

  const sceneUpdate: Prisma.SceneUpdateInput =
    take.kind === "VIDEO"
      ? { selectedVideoTakeId: take.id, status: "COMPLETE" }
      : {
          selectedKeyframeTakeId: take.id,
          selectedVideoTakeId: null,
          status: "APPROVED",
        };

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
  let job = await prisma.generationJob.findUnique({ where: { id: jobId } });

  if (!job || job.type !== "VIDEO") return job;

  if (job.status === "WAITING_PROVIDER") {
    const claim = await prisma.generationJob.updateMany({
      where: { id: job.id, status: "WAITING_PROVIDER" },
      data: { status: "RUNNING" },
    });
    if (claim.count === 0) {
      return prisma.generationJob.findUnique({ where: { id: jobId } });
    }
    job = await prisma.generationJob.findUniqueOrThrow({
      where: { id: jobId },
    });
  } else if (job.status === "RUNNING") {
    if (!isStalePollClaim(job.updatedAt)) return job;

    const claim = await prisma.generationJob.updateMany({
      where: { id: job.id, status: "RUNNING", updatedAt: job.updatedAt },
      data: { status: "RUNNING" },
    });
    if (claim.count === 0) {
      return prisma.generationJob.findUnique({ where: { id: jobId } });
    }
    job = await prisma.generationJob.findUniqueOrThrow({
      where: { id: jobId },
    });
  } else {
    return job;
  }

  const output = parseVideoJobOutput(job.output);
  const expectedSceneIds = getExpectedSceneIds(job.input);
  if (!output || !hasExactSceneCoverage(output.scenes, expectedSceneIds)) {
    return failProductionJob({
      jobId: job.id,
      projectId: job.projectId,
      error: new Error("Video job provider state is missing or invalid."),
      operation: "video",
      projectStatus: "FAILED",
    });
  }

  const persistedTakes = await prisma.take.findMany({
    where: { id: { in: output.scenes.map((task) => task.takeId) } },
    select: {
      id: true,
      sceneId: true,
      kind: true,
      status: true,
      artifactId: true,
    },
  });
  const takeById = new Map(persistedTakes.map((take) => [take.id, take]));
  const hasInvalidTake = output.scenes.some((task) => {
    const take = takeById.get(task.takeId);
    return !take || take.sceneId !== task.sceneId || take.kind !== "VIDEO";
  });
  if (hasInvalidTake) {
    return failProductionJob({
      jobId: job.id,
      projectId: job.projectId,
      error: new Error(
        "Video job provider state references an invalid scene take.",
      ),
      operation: "video",
      projectStatus: "FAILED",
    });
  }
  const hasInvalidCompletion = output.scenes.some((task) => {
    const take = takeById.get(task.takeId)!;
    return (
      task.status === "COMPLETE" &&
      (take.status !== "COMPLETE" || !take.artifactId)
    );
  });
  if (hasInvalidCompletion) {
    return failProductionJob({
      jobId: job.id,
      projectId: job.projectId,
      error: new Error(
        "Video job provider state has an invalid completed take.",
      ),
      operation: "video",
      projectStatus: "FAILED",
    });
  }

  const nextScenes: VideoSceneTask[] = [];
  for (const sceneTask of output.scenes) {
    const persistedTake = takeById.get(sceneTask.takeId)!;
    if (persistedTake.status === "COMPLETE" && persistedTake.artifactId) {
      nextScenes.push({
        ...withoutTaskError(sceneTask),
        status: "COMPLETE",
        artifactId: persistedTake.artifactId,
      });
      continue;
    }
    if (sceneTask.status === "FAILED") {
      if (persistedTake.status !== "FAILED") {
        await markVideoTakeFailed(
          sceneTask,
          sceneTask.error ?? "Video submission did not complete.",
        );
      }
      nextScenes.push(sceneTask);
      continue;
    }

    try {
      const providerStatus = await pollVideoTask(sceneTask.taskId!);

      if (
        providerStatus.status === "PENDING" ||
        providerStatus.status === "RUNNING" ||
        providerStatus.status === "UNKNOWN"
      ) {
        if (
          job.startedAt &&
          Date.now() - job.startedAt.getTime() >= VIDEO_PROVIDER_TIMEOUT_MS
        ) {
          const error =
            "QwenCloud video task exceeded the one-hour processing window.";
          await markVideoTakeFailed(sceneTask, error);
          nextScenes.push({ ...sceneTask, status: "FAILED", error });
          continue;
        }
        nextScenes.push(withoutTaskError(sceneTask));
        continue;
      }

      if (providerStatus.status === "FAILED" || !providerStatus.videoUrl) {
        const error =
          "QwenCloud video task failed before producing a durable URL.";
        await markVideoTakeFailed(sceneTask, error);
        nextScenes.push({ ...sceneTask, status: "FAILED", error });
        continue;
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

      nextScenes.push({
        ...withoutTaskError(sceneTask),
        status: "COMPLETE",
        artifactId: artifact.id,
      });
    } catch (error) {
      // Polling and artifact-copy failures are recoverable. The provider task
      // remains durable, so keep it live for the next poll instead of losing it.
      nextScenes.push({
        ...sceneTask,
        error: sanitizeVideoError(error),
      });
    }
  }

  const summary = summarizeVideoTasks(nextScenes);
  const error = summary.hasFailed
    ? "One or more scene video tasks failed. Existing completed clips were preserved where available."
    : null;
  let projectStatus: "DRAFT" | "GENERATING" | "FAILED" = "GENERATING";
  if (summary.terminal) {
    projectStatus =
      summary.status === "COMPLETE" ||
      (await hasCompleteStoryVideos(job.projectId))
        ? "DRAFT"
        : "FAILED";
  }

  const [, updatedJob] = await prisma.$transaction([
    prisma.project.update({
      where: { id: job.projectId },
      data: { status: projectStatus },
    }),
    prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: summary.status,
        providerTaskId:
          nextScenes
            .filter((task) => task.status === "WAITING_PROVIDER")
            .map((task) => task.taskId)
            .filter((taskId): taskId is string => Boolean(taskId))
            .join(",") || null,
        output: { scenes: nextScenes } as unknown as Prisma.InputJsonValue,
        error: summary.terminal ? error : null,
        completedAt: summary.terminal ? new Date() : null,
      },
    }),
  ]);

  return updatedJob;
}

export async function recoverStaleKeyframeJob(jobId: string) {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (
    !job ||
    job.type !== "KEYFRAME" ||
    (job.status !== "QUEUED" && job.status !== "RUNNING") ||
    !isStalePollClaim(job.updatedAt, new Date(), STALE_PRODUCTION_JOB_MS)
  ) {
    return job;
  }

  const claim = await prisma.generationJob.updateMany({
    where: { id: job.id, status: job.status, updatedAt: job.updatedAt },
    data: {
      status: "FAILED",
      error:
        "Keyframe generation stopped reporting progress. Start it again to retry safely.",
      completedAt: new Date(),
    },
  });
  if (claim.count === 0) {
    return prisma.generationJob.findUnique({ where: { id: jobId } });
  }

  await restoreProductionScenes(job.projectId);
  await prisma.project.update({
    where: { id: job.projectId },
    data: { status: "DRAFT" },
  });
  return prisma.generationJob.findUnique({ where: { id: jobId } });
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
    const scenes = await getProductionScenes(job.projectId);
    await prisma.$transaction([
      prisma.project.update({
        where: { id: job.projectId },
        data: { status: "GENERATING" },
      }),
      prisma.scene.updateMany({
        where: { id: { in: scenes.map((scene) => scene.id) } },
        data: { status: "GENERATING" },
      }),
    ]);

    const groundingReferenceUrls = await getGroundingReferenceUrls(
      job.projectId,
    );
    const created: Array<{ scene: ProductionScene; anchorTake: Take }> = [];
    let previousAnchorReferenceUrl: string | null = null;

    for (const [index, scene] of scenes.entries()) {
      const previousScene = index > 0 ? scenes[index - 1]! : null;
      const anchorTake = await createKeyframeTake({
        projectId: job.projectId,
        scene,
        kind: "KEYFRAME_START",
        prompt: buildKeyframePrompt(scene, previousScene),
        referenceImageUrls:
          previousAnchorReferenceUrl &&
          scene.continuityMode !== "INTENTIONAL_CHANGE"
            ? [previousAnchorReferenceUrl, ...groundingReferenceUrls].slice(
                0,
                3,
              )
            : groundingReferenceUrls,
      });
      previousAnchorReferenceUrl = anchorTake.providerImageUrl;
      created.push({ scene, anchorTake: anchorTake.take });
      const progress = await prisma.generationJob.updateMany({
        where: { id: job.id, status: "RUNNING" },
        data: {
          output: {
            sceneCount: scenes.length,
            generatedSceneCount: created.length,
            takeIds: created.map((item) => item.anchorTake.id),
          },
        },
      });
      if (progress.count === 0) {
        throw new Error("Keyframe generation job is no longer active.");
      }
    }

    return prisma.$transaction(async (tx) => {
      const completion = await tx.generationJob.updateMany({
        where: { id: job.id, status: "RUNNING" },
        data: {
          status: "COMPLETE",
          output: {
            takeIds: created.map((item) => item.anchorTake.id),
            sceneCount: scenes.length,
          },
          completedAt: new Date(),
        },
      });
      if (completion.count === 0) {
        throw new Error("Keyframe generation job is no longer active.");
      }

      for (const item of created) {
        await tx.take.updateMany({
          where: {
            sceneId: item.scene.id,
            kind: { in: ["KEYFRAME_START", "KEYFRAME_END"] },
          },
          data: { selected: false },
        });
        await tx.take.update({
          where: { id: item.anchorTake.id },
          data: { selected: true },
        });
        await tx.take.updateMany({
          where: { sceneId: item.scene.id, kind: "VIDEO" },
          data: { selected: false },
        });
        await tx.scene.update({
          where: { id: item.scene.id },
          data: {
            status: "APPROVED",
            selectedKeyframeTakeId: item.anchorTake.id,
            selectedVideoTakeId: null,
          },
        });
      }
      await tx.project.update({
        where: { id: job.projectId },
        data: { status: "DRAFT" },
      });

      return tx.generationJob.findUniqueOrThrow({ where: { id: job.id } });
    });
  } catch (error) {
    return failProductionJob({
      jobId: job.id,
      projectId: job.projectId,
      error,
      operation: "keyframe",
      projectStatus: "DRAFT",
      restoreScenes: true,
    });
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
    const productionScenes = await getProductionScenes(job.projectId);
    const scenes = selectRequestedScenes(
      productionScenes,
      getExpectedSceneIds(job.input),
    );
    if (!scenes) {
      throw new Error("Video job references an invalid storyboard scene set.");
    }
    const preflight = [];
    for (const scene of scenes) {
      const selectedAnchor = await getSelectedKeyframeArtifact(scene);

      if (!selectedAnchor) {
        throw new Error(
          "Generate the recommended scene anchors before creating video clips.",
        );
      }

      preflight.push({
        scene,
        imageUrl: artifactUrl(selectedAnchor),
      });
    }

    await prisma.project.update({
      where: { id: job.projectId },
      data: { status: "GENERATING" },
    });
    const prepared = [];
    for (const item of preflight) {
      const take = await createQueuedTake({
        sceneId: item.scene.id,
        kind: "VIDEO",
        prompt: item.scene.shotPrompt,
      });
      prepared.push({ ...item, take });
    }
    const submitted: VideoSceneTask[] = prepared.map(({ scene, take }) => ({
      sceneId: scene.id,
      takeId: take.id,
      status: "FAILED",
      error: "Video submission did not start.",
    }));
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        output: { scenes: submitted } as unknown as Prisma.InputJsonValue,
      },
    });

    for (const [index, item] of prepared.entries()) {
      const { scene, take } = item;

      await prisma.scene.update({
        where: { id: scene.id },
        data: { status: "GENERATING" },
      });

      let submission;
      try {
        submission = await submitImageToVideoTask({
          operation: "scene_i2v",
          model: job.model ?? QWEN_I2V_MODEL,
          prompt: take.prompt,
          imageUrl: item.imageUrl,
          negativePrompt: VIDEO_NEGATIVE_PROMPT,
          durationSec: scene.durationSec,
        });
      } catch (error) {
        const safeError = sanitizeVideoError(error);
        const failedTask: VideoSceneTask = {
          sceneId: scene.id,
          takeId: take.id,
          status: "FAILED",
          error: safeError,
        };
        submitted[index] = failedTask;
        await markVideoTakeFailed(failedTask, safeError);
        await prisma.generationJob.update({
          where: { id: job.id },
          data: {
            output: { scenes: submitted } as unknown as Prisma.InputJsonValue,
          },
        });
        continue;
      }

      const task: VideoSceneTask = {
        sceneId: scene.id,
        takeId: take.id,
        taskId: submission.taskId,
        status: "WAITING_PROVIDER",
      };
      submitted[index] = task;
      await prisma.$transaction([
        prisma.take.update({
          where: { id: take.id },
          data: {
            status: "RUNNING",
            notes: `Provider task ${submission.taskId}`,
          },
        }),
        prisma.generationJob.update({
          where: { id: job.id },
          data: {
            providerTaskId: submitted
              .map((submittedTask) => submittedTask.taskId)
              .filter((taskId): taskId is string => Boolean(taskId))
              .join(","),
            output: { scenes: submitted } as unknown as Prisma.InputJsonValue,
          },
        }),
      ]);
    }

    const output: VideoJobOutput = { scenes: submitted };
    const summary = summarizeVideoTasks(submitted);
    const projectStatus = summary.terminal
      ? (await hasCompleteStoryVideos(job.projectId))
        ? "DRAFT"
        : "FAILED"
      : "GENERATING";
    const [, updatedJob] = await prisma.$transaction([
      prisma.project.update({
        where: { id: job.projectId },
        data: { status: projectStatus },
      }),
      prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: summary.status,
          providerTaskId:
            submitted
              .filter((item) => item.status === "WAITING_PROVIDER")
              .map((item) => item.taskId)
              .filter((taskId): taskId is string => Boolean(taskId))
              .join(",") || null,
          output: output as unknown as Prisma.InputJsonValue,
          error: summary.terminal
            ? "Video submission failed for every scene. Existing completed clips were preserved where available."
            : null,
          completedAt: summary.terminal ? new Date() : null,
        },
      }),
    ]);

    return updatedJob;
  } catch (error) {
    return failProductionJob({
      jobId: job.id,
      projectId: job.projectId,
      error,
      operation: "video",
      projectStatus: "DRAFT",
      restoreScenes: true,
    });
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
    const safeError = sanitizeProductionError(error, "keyframe");

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

async function getProductionScenes(projectId: string) {
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
    throw new PublicError("Generate and save a storyboard before production.");
  }

  if (storyboard.status !== "APPROVED" && storyboard.status !== "COMPLETE") {
    throw new PublicError("Save and approve the storyboard before generation.");
  }

  if (storyboard.scenes.length < 2 || storyboard.scenes.length > 4) {
    throw new PublicError(
      "Production requires a storyboard with 2 to 4 scenes.",
    );
  }
  if (storyboard.scenes.some((scene) => scene.status === "DRAFT")) {
    throw new PublicError("Approve every storyboard scene before generation.");
  }

  return storyboard.scenes.map((scene) => ({
    ...scene,
    storyboard: {
      projectId: storyboard.projectId,
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
      projectId,
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

async function getSelectedKeyframeArtifact(scene: ProductionScene) {
  const selected = scene.takes.find(
    (take) =>
      take.id === scene.selectedKeyframeTakeId &&
      take.kind === "KEYFRAME_START" &&
      take.status === "COMPLETE" &&
      take.artifactId,
  );
  if (!selected?.artifactId) return null;

  return prisma.artifact.findFirst({
    where: {
      id: selected.artifactId,
      projectId: scene.storyboard.projectId,
      mimeType: { startsWith: "image/" },
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
  scene: ProductionScene,
  previousScene: ProductionScene | null,
) {
  return `Create a high-resolution opening still at the onset of this single shot: ${scene.shotPrompt}

Locked brand style: ${scene.lockedStyleLanguage}
Product continuity: ${scene.storyboard.productContinuity}
Character continuity: ${scene.storyboard.characterContinuity}
Visual-world continuity: ${scene.storyboard.visualContinuity}
Transition mode: ${scene.continuityMode}
Scene continuity: ${scene.continuityNotes}
${previousScene ? `Prior shot context for the handoff: ${previousScene.shotPrompt}` : "This is the story's establishing anchor and immediate hook."}
${scene.continuityMode === "INTENTIONAL_CHANGE" ? "Honor only the explicitly planned change; preserve every other locked identity and style attribute." : "Use supplied prior-scene imagery only to preserve identity, lighting, spatial logic, and screen direction; compose a distinct next shot rather than copying it."}
Vertical 9:16, clean silhouette, stable anatomy and product geometry, commercial polish, no readable text or logos.`;
}

async function createProductionJob({
  projectId,
  type,
  model,
  operation,
  sceneIds,
}: {
  projectId: string;
  type: "KEYFRAME" | "VIDEO";
  model: string;
  operation: string;
  sceneIds: string[];
}) {
  return prisma.$transaction(async (tx) => {
    // Lock the existing project row for this transaction. Unlike PostgreSQL's
    // void-returning advisory lock, this is supported by Prisma's PG adapter.
    const lockedProject = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Project"
      WHERE "id" = ${projectId}
      FOR UPDATE
    `;
    if (lockedProject.length === 0) {
      throw new PublicError("Project not found.", 404);
    }

    const staleBefore = new Date(Date.now() - STALE_PRODUCTION_JOB_MS);
    await tx.generationJob.updateMany({
      where: {
        projectId,
        type: { in: ["KEYFRAME", "VIDEO"] },
        status: { in: [...ACTIVE_PRODUCTION_JOB_STATUSES] },
        updatedAt: { lt: staleBefore },
      },
      data: {
        status: "CANCELLED",
        error:
          "Superseded after the production job stopped reporting progress.",
        completedAt: new Date(),
      },
    });

    const active = await tx.generationJob.findFirst({
      where: {
        projectId,
        type: { in: ["KEYFRAME", "VIDEO"] },
        status: { in: [...ACTIVE_PRODUCTION_JOB_STATUSES] },
      },
      select: { id: true },
    });
    if (active) {
      throw new PublicError(
        "A production job is already running for this project.",
        409,
      );
    }

    return tx.generationJob.create({
      data: {
        projectId,
        type,
        status: "QUEUED",
        model,
        input: { operation, sceneIds },
      },
    });
  });
}

async function markVideoTakeFailed(sceneTask: VideoSceneTask, error: string) {
  const scene = await prisma.scene.findUnique({
    where: { id: sceneTask.sceneId },
    select: { selectedVideoTakeId: true },
  });
  if (!scene) return;

  await prisma.$transaction([
    prisma.take.update({
      where: { id: sceneTask.takeId },
      data: { status: "FAILED", selected: false, notes: error },
    }),
    prisma.scene.update({
      where: { id: sceneTask.sceneId },
      data: { status: stableSceneStatus(scene.selectedVideoTakeId) },
    }),
  ]);
}

async function hasCompleteStoryVideos(projectId: string) {
  const storyboard = await prisma.storyboard.findUnique({
    where: { projectId },
    include: {
      scenes: {
        include: { takes: { where: { kind: "VIDEO" } } },
      },
    },
  });
  if (
    !storyboard ||
    storyboard.scenes.length < 2 ||
    storyboard.scenes.length > 4
  ) {
    return false;
  }

  return storyboard.scenes.every((scene) => {
    const selected = scene.takes.find(
      (take) => take.id === scene.selectedVideoTakeId,
    );
    return selected?.status === "COMPLETE" && Boolean(selected.artifactId);
  });
}

async function failProductionJob({
  jobId,
  projectId,
  error,
  operation,
  projectStatus,
  restoreScenes = false,
}: {
  jobId: string;
  projectId: string;
  error: unknown;
  operation: "keyframe" | "video";
  projectStatus: "DRAFT" | "FAILED";
  restoreScenes?: boolean;
}) {
  const safeError = sanitizeProductionError(error, operation);

  if (restoreScenes) {
    await restoreProductionScenes(projectId);
  }

  const [, failed] = await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { status: projectStatus },
    }),
    prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: safeError,
        completedAt: new Date(),
      },
    }),
  ]);

  return failed;
}

async function restoreProductionScenes(projectId: string) {
  const scenes = await prisma.scene.findMany({
    where: { storyboard: { projectId }, status: "GENERATING" },
    select: { id: true, selectedVideoTakeId: true },
  });
  if (scenes.length === 0) return;

  await prisma.$transaction(
    scenes.map((scene) =>
      prisma.scene.update({
        where: { id: scene.id },
        data: { status: stableSceneStatus(scene.selectedVideoTakeId) },
      }),
    ),
  );
}

function sanitizeProductionError(
  error: unknown,
  operation: "keyframe" | "video",
) {
  if (error instanceof Error) {
    const safeMessages = [
      "storyboard",
      "scene",
      "keyframe",
      "scene anchors",
      "PUBLIC_APP_URL",
      "API key",
      "QwenCloud",
      "production job",
      "provider state",
    ];
    if (
      safeMessages.some((fragment) =>
        error.message.toLowerCase().includes(fragment.toLowerCase()),
      )
    ) {
      return error.message;
    }
  }

  return operation === "video"
    ? sanitizeVideoError(error)
    : "Keyframe generation failed. Check server logs for sanitized provider metadata.";
}

function getExpectedSceneIds(value: Prisma.JsonValue): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const sceneIds = (value as { sceneIds?: unknown }).sceneIds;
  return Array.isArray(sceneIds) &&
    sceneIds.every((sceneId) => typeof sceneId === "string")
    ? sceneIds
    : [];
}

function withoutTaskError(task: VideoSceneTask): VideoSceneTask {
  const next = { ...task };
  delete next.error;
  return next;
}
