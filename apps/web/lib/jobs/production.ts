import "server-only";

import type { Prisma, Scene, Storyboard, Take } from "@prisma/client";

import { PublicError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { generateImageWithQwen } from "@/lib/qwen/image";
import { resolveArtifactForQwen } from "@/lib/qwen/uploads";
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
  selectKeyframeGenerationTargets,
  selectVideoGenerationTargets,
  stableSceneStatus,
  summarizeVideoTasks,
  type VideoJobOutput,
  type VideoSceneTask,
} from "@/lib/jobs/production-state";
import { findShowcaseShotViolations } from "@/lib/product-showcase/guardrails";
import { storyboardTimingIssue } from "@/lib/storyboards/timing";

export const QWEN_KEYFRAME_IMAGE_MODEL = "wan2.7-image-pro";
const VIDEO_NEGATIVE_PROMPT =
  "deformed anatomy, extra limbs, duplicated subjects, cloned faces, look-alike characters, identity swapping, morphing, warping, flicker, jitter, abrupt camera changes, frozen motion, text, logos, watermark";

type ProductionScene = Scene & {
  takes: Take[];
  storyboard: Pick<
    Storyboard,
    | "projectId"
    | "conceptId"
    | "productContinuity"
    | "characterContinuity"
    | "visualContinuity"
  > & {
    outputMode: "STANDARD" | "PRODUCT_SHOWCASE";
    razzmatazzMode: boolean;
  };
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
  const concept = await prisma.creativeConcept.findFirst({
    where: { id: scenes[0]?.storyboard.conceptId, projectId },
    select: { previewArtifactId: true },
  });
  const targets = selectKeyframeGenerationTargets(
    scenes,
    concept?.previewArtifactId ?? null,
  );
  if (targets.length === 0) {
    return prisma.generationJob.create({
      data: {
        projectId,
        type: "KEYFRAME",
        status: "COMPLETE",
        model: QWEN_KEYFRAME_IMAGE_MODEL,
        input: { operation: "scene_keyframes", sceneIds: [] },
        output: { takeIds: [], sceneCount: 0, reusedOpeningFrame: true },
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }
  const job = await createProductionJob({
    projectId,
    type: "KEYFRAME",
    model: QWEN_KEYFRAME_IMAGE_MODEL,
    operation: "scene_keyframes",
    sceneIds: targets.map((scene) => scene.id),
  });

  return runKeyframeJob(job.id);
}

export async function createAndRunSceneKeyframeJob(
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
    type: "KEYFRAME",
    model: QWEN_KEYFRAME_IMAGE_MODEL,
    operation: "scene_keyframe_regeneration",
    sceneIds: [scene.id],
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
    sourceAudioPolicy:
      scenes[0]?.storyboard.outputMode === "PRODUCT_SHOWCASE"
        ? "SILENT"
        : "SILENT_SOURCE_WITH_POST_MIX",
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
    sourceAudioPolicy:
      scene.storyboard.outputMode === "PRODUCT_SHOWCASE"
        ? "SILENT"
        : "SILENT_SOURCE_WITH_POST_MIX",
  });

  return runVideoSubmissionJob(job.id);
}

export async function selectTake(takeId: string) {
  const take = await prisma.take.findUnique({
    where: { id: takeId },
    include: {
      scene: {
        include: {
          storyboard: { select: { projectId: true, conceptId: true } },
        },
      },
    },
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
    ...(take.kind === "KEYFRAME_START" && take.scene.index === 1
      ? [
          prisma.creativeConcept.updateMany({
            where: {
              id: take.scene.storyboard.conceptId,
              projectId: take.scene.storyboard.projectId,
            },
            data: { previewArtifactId: take.artifactId },
          }),
        ]
      : []),
    prisma.generationJob.updateMany({
      where: {
        projectId: take.scene.storyboard.projectId,
        type: "RENDER",
        status: "COMPLETE",
      },
      data: {
        status: "CANCELLED",
        error: "A different scene take was selected; create a fresh export.",
      },
    }),
    prisma.render.updateMany({
      where: {
        projectId: take.scene.storyboard.projectId,
        status: "COMPLETE",
      },
      data: { status: "FAILED" },
    }),
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
        prisma.generationJob.updateMany({
          where: {
            projectId: job.projectId,
            type: "RENDER",
            status: "COMPLETE",
          },
          data: {
            status: "CANCELLED",
            error: "A scene clip changed; create a fresh export.",
          },
        }),
        prisma.render.updateMany({
          where: { projectId: job.projectId, status: "COMPLETE" },
          data: { status: "FAILED" },
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
    const productionScenes = await getProductionScenes(job.projectId);
    const scenes = selectRequestedScenes(
      productionScenes,
      getExpectedSceneIds(job.input),
    );
    if (!scenes) {
      throw new Error(
        "Keyframe job references an invalid storyboard scene set.",
      );
    }
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

    const groundingReferences = await getGroundingReferenceUrls(job.projectId);
    if (
      groundingReferences.expectedProductReferenceCount > 0 &&
      groundingReferences.productReferenceCount === 0
    ) {
      throw new Error(
        "QwenCloud could not resolve the uploaded product reference. No generic scene frame was generated; retry this frame.",
      );
    }
    const groundingReferenceUrls = groundingReferences.urls;
    const created: Array<{ scene: ProductionScene; anchorTake: Take }> = [];
    const recentAnchorReferenceUrls: string[] = [];

    for (const scene of scenes) {
      const previousScene =
        productionScenes.find(
          (candidate) => candidate.index === scene.index - 1,
        ) ?? null;
      const previousAnchor = previousScene
        ? await getSelectedKeyframeArtifact(previousScene)
        : null;
      const previousAnchorUrl = previousAnchor
        ? await resolveArtifactForQwen(
            previousAnchor,
            QWEN_KEYFRAME_IMAGE_MODEL,
          )
        : null;
      const anchorTake = await createKeyframeTake({
        projectId: job.projectId,
        scene,
        kind: "KEYFRAME_START",
        prompt: buildKeyframePrompt(scene, previousScene),
        referenceImageUrls:
          scene.continuityMode !== "INTENTIONAL_CHANGE"
            ? [
                ...recentAnchorReferenceUrls.slice(-2).reverse(),
                ...(previousAnchorUrl ? [previousAnchorUrl] : []),
                ...groundingReferenceUrls,
              ].slice(0, 3)
            : groundingReferenceUrls,
        productReferenceCount: groundingReferences.productReferenceCount,
      });
      recentAnchorReferenceUrls.push(anchorTake.providerImageUrl);
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
        if (item.scene.index === 1 && item.anchorTake.artifactId) {
          await tx.creativeConcept.updateMany({
            where: {
              id: item.scene.storyboard.conceptId,
              projectId: job.projectId,
            },
            data: { previewArtifactId: item.anchorTake.artifactId },
          });
        }
      }
      await tx.generationJob.updateMany({
        where: {
          projectId: job.projectId,
          type: "RENDER",
          status: "COMPLETE",
        },
        data: {
          status: "CANCELLED",
          error: "A scene opening frame changed; create a fresh export.",
        },
      });
      await tx.render.updateMany({
        where: { projectId: job.projectId, status: "COMPLETE" },
        data: { status: "FAILED" },
      });
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
        imageUrl: await resolveArtifactForQwen(
          selectedAnchor,
          job.model ?? QWEN_I2V_MODEL,
        ),
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
  productReferenceCount,
}: {
  projectId: string;
  scene: ProductionScene;
  kind: "KEYFRAME_START" | "KEYFRAME_END";
  prompt: string;
  referenceImageUrls: string[];
  productReferenceCount: number;
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
        role:
          scene.index === 1
            ? "storyboard_opening_frame"
            : "storyboard_scene_anchor",
        sceneIndex: scene.index,
        model: generated.model,
        providerImageUrl: generated.imageUrl,
        providerRequestId: generated.providerRequestId,
        prompt,
        referenceImageCount: referenceImageUrls.length,
        productReferenceCount,
        groundingMode:
          productReferenceCount > 0
            ? "product-reference-locked"
            : "scene-reference-grounded",
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
      project: {
        select: {
          outputMode: true,
          videoLengthSec: true,
          razzmatazzMode: true,
          products: { select: { name: true, details: true } },
        },
      },
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

  const timingIssue = storyboardTimingIssue({
    outputMode: storyboard.project.outputMode,
    targetDurationSec: storyboard.project.videoLengthSec,
    durations: storyboard.scenes.map((scene) => scene.durationSec),
  });
  if (timingIssue) {
    throw new PublicError(timingIssue, 409);
  }
  if (storyboard.scenes.some((scene) => scene.status === "DRAFT")) {
    throw new PublicError("Approve every storyboard scene before generation.");
  }
  if (storyboard.project.outputMode === "PRODUCT_SHOWCASE") {
    const motionViolations = findShowcaseShotViolations(
      storyboard.scenes,
      storyboard.characterContinuity,
      storyboard.project.products,
      storyboard.project.razzmatazzMode,
    );
    if (motionViolations.length > 0) {
      throw new PublicError(
        `Product Showcase motion needs revision before production: ${motionViolations.slice(0, 3).join(" ")}`,
        409,
      );
    }
  }

  return storyboard.scenes.map((scene) => ({
    ...scene,
    storyboard: {
      projectId: storyboard.projectId,
      conceptId: storyboard.conceptId,
      productContinuity: storyboard.productContinuity,
      characterContinuity: storyboard.characterContinuity,
      visualContinuity: storyboard.visualContinuity,
      outputMode: storyboard.project.outputMode,
      razzmatazzMode: storyboard.project.razzmatazzMode,
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
  sources.sort((left, right) => {
    const priority = (type: string) =>
      type === "PRODUCT_IMAGE" ? 0 : type === "LOGO" ? 1 : 2;
    return priority(left.type) - priority(right.type);
  });
  const artifactIds = sources
    .map((source) => source.artifactId)
    .filter((id): id is string => Boolean(id));

  if (artifactIds.length === 0) {
    return {
      urls: [],
      productReferenceCount: 0,
      expectedProductReferenceCount: 0,
    };
  }

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

  const orderedArtifacts = sources
    .flatMap((source) => {
      const artifact = source.artifactId
        ? artifactById.get(source.artifactId)
        : null;
      return artifact ? [{ artifact, sourceType: source.type }] : [];
    })
    .slice(0, 3);
  const resolved = await Promise.allSettled(
    orderedArtifacts.map(async ({ artifact, sourceType }) => ({
      sourceType,
      url: await resolveArtifactForQwen(artifact, QWEN_KEYFRAME_IMAGE_MODEL),
    })),
  );
  const references = resolved.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  return {
    urls: references.map((reference) => reference.url),
    productReferenceCount: references.filter(
      (reference) => reference.sourceType === "PRODUCT_IMAGE",
    ).length,
    expectedProductReferenceCount: sources.filter(
      (source) => source.type === "PRODUCT_IMAGE",
    ).length,
  };
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
Cast identity rule: treat every role in the cast ledger as a separate person. Preserve recurring face geometry, visible complexion, hair, build, age band, wardrobe, and distinguishing feature exactly. In multi-person frames, enforce different silhouettes and facial structures; never clone one face onto another body or merge identities. Respect an explicit fictional complexion/heritage anchor, but never infer ethnicity for a reference-backed person or use physical traits as personality shorthand.
${previousScene ? `Prior shot context for the handoff: ${previousScene.shotPrompt}` : "This is the story's establishing anchor and immediate hook."}
${scene.continuityMode === "INTENTIONAL_CHANGE" ? "Honor only the explicitly planned change; preserve every other locked identity and style attribute." : "Use supplied prior-scene imagery only to preserve identity, lighting, spatial logic, and screen direction; compose a distinct next shot rather than copying it."}
${scene.storyboard.outputMode === "PRODUCT_SHOWCASE" ? "PRODUCT SHOWCASE LOCK: the uploaded product references outrank all inferred styling. Preserve exact product silhouette, proportions, materials, colors, packaging, surface details, and visible ingredients. Compose one hero product and one clearly readable action only; secondary products remain static or absent. If a human is planned, show that single person only—no crowds, second model, background people, or extra hands. Keep screens to one readable state or one simple interaction. No melting, morphing, spawning, invented internals, exploded views, fabric/electronic teardown, crowded assembly, or simultaneous transformations." : ""}
${scene.storyboard.razzmatazzMode ? "RAZZMATAZZ LOCK: the intact product is the only subject and already fills the visual hierarchy. Use no person, detached hand, opened package, separated component, or product transformation. Reserve clean negative space for the renderer's brief tagline while surrounding light, particles, reflections, or atmosphere imply immediate premium energy." : ""}
Vertical 9:16, clean silhouette, stable anatomy and product geometry, commercial polish, no readable text or logos.`;
}

async function createProductionJob({
  projectId,
  type,
  model,
  operation,
  sceneIds,
  sourceAudioPolicy,
}: {
  projectId: string;
  type: "KEYFRAME" | "VIDEO";
  model: string;
  operation: string;
  sceneIds: string[];
  sourceAudioPolicy?: "SILENT" | "SILENT_SOURCE_WITH_POST_MIX";
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
        input: {
          operation,
          sceneIds,
          ...(sourceAudioPolicy ? { sourceAudioPolicy } : {}),
        },
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
      project: { select: { outputMode: true, videoLengthSec: true } },
      scenes: {
        include: { takes: { where: { kind: "VIDEO" } } },
      },
    },
  });
  if (!storyboard) {
    return false;
  }
  if (
    storyboardTimingIssue({
      outputMode: storyboard.project.outputMode,
      targetDurationSec: storyboard.project.videoLengthSec,
      durations: storyboard.scenes.map((scene) => scene.durationSec),
    })
  )
    return false;

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
