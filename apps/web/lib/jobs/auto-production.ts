import "server-only";

import type { AutoGenerationRun, GenerationJob } from "@prisma/client";

import { PublicError } from "@/lib/errors";
import { createAndRunStoryboardJob } from "@/lib/jobs/creative";
import {
  isAutoRunActive,
  nextAutoPhase,
  retryDelayMs,
  type AutoPhase,
} from "@/lib/jobs/auto-production-state";
import {
  createAndRunFinalRenderJob,
  createAndRunNarrationJob,
} from "@/lib/jobs/final-render";
import {
  advanceVideoJob,
  createAndRunKeyframeJob,
  createAndRunVideoJob,
} from "@/lib/jobs/production";
import { prisma } from "@/lib/prisma";
import { storyboardTimingIssue } from "@/lib/storyboards/timing";

const AUTO_LEASE_MS = 20 * 60 * 1000;

class AutoPipelineError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
  ) {
    super(message);
  }
}

export async function startAutoGeneration({
  projectId,
  enabled,
}: {
  projectId: string;
  enabled: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE
    `;
    if (locked.length === 0) throw new PublicError("Project not found.", 404);

    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        brandKit: { select: { id: true } },
        concepts: { where: { selected: true }, select: { id: true } },
      },
    });
    if (!project.brandKit) {
      throw new PublicError("Generate a Brand Kit before proceeding.", 409);
    }
    if (project.concepts.length !== 1) {
      throw new PublicError(
        "Select exactly one creative concept before proceeding.",
        409,
      );
    }

    const active = await tx.autoGenerationRun.findFirst({
      where: {
        projectId,
        status: { in: ["RUNNING", "WAITING_RETRY"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (active && !enabled) {
      throw new PublicError(
        "Auto mode is already building this reel. Manual mode returns when the run completes or pauses for review.",
        409,
      );
    }

    await tx.project.update({
      where: { id: projectId },
      data: { autoMode: enabled, brandKitConfirmedAt: new Date() },
    });
    if (!enabled) return null;
    if (active) return active;

    return tx.autoGenerationRun.create({
      data: { projectId, status: "RUNNING", phase: "STORYBOARD" },
    });
  });
}

export async function resumeAutoGeneration(projectId: string) {
  const latest = await prisma.autoGenerationRun.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) {
    throw new PublicError(
      "No auto generation run is available to resume.",
      404,
    );
  }
  if (latest.status === "COMPLETE") return latest;
  if (isAutoRunActive(latest.status)) return latest;

  return prisma.autoGenerationRun.update({
    where: { id: latest.id },
    data: {
      status: "RUNNING",
      attempt: 0,
      nextAttemptAt: null,
      leaseUntil: null,
      currentJobId: null,
      error: null,
      completedAt: null,
    },
  });
}

export async function getLatestAutoGeneration(projectId: string) {
  return prisma.autoGenerationRun.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

export async function advanceAutoGeneration({
  projectId,
  artifactBaseUrl,
}: {
  projectId: string;
  artifactBaseUrl: string;
}) {
  const run = await getLatestAutoGeneration(projectId);
  if (!run || !isAutoRunActive(run.status)) return run;

  const now = new Date();
  if (run.nextAttemptAt && run.nextAttemptAt > now) return run;
  if (run.leaseUntil && run.leaseUntil > now) return run;

  const claimed = await prisma.autoGenerationRun.updateMany({
    where: { id: run.id, status: run.status, updatedAt: run.updatedAt },
    data: {
      status: "RUNNING",
      nextAttemptAt: null,
      leaseUntil: new Date(now.getTime() + AUTO_LEASE_MS),
    },
  });
  if (claimed.count === 0) return getLatestAutoGeneration(projectId);

  const claimedRun = await prisma.autoGenerationRun.findUniqueOrThrow({
    where: { id: run.id },
  });

  try {
    await executePhase(claimedRun, artifactBaseUrl);
  } catch (error) {
    await handlePhaseFailure(claimedRun, error);
  }

  return prisma.autoGenerationRun.findUnique({ where: { id: run.id } });
}

async function executePhase(run: AutoGenerationRun, artifactBaseUrl: string) {
  if (run.phase !== "STORYBOARD" && run.phase !== "COMPLETE") {
    const storyboardIsCurrent = await hasCurrentApprovedStoryboard(
      run.projectId,
    );
    if (!storyboardIsCurrent) return resetToPhase(run, "STORYBOARD");
  }

  switch (run.phase as AutoPhase) {
    case "STORYBOARD":
      return runStoryboardPhase(run);
    case "KEYFRAMES":
      return runKeyframePhase(run);
    case "CLIPS":
      return runClipPhase(run);
    case "NARRATION":
      return runNarrationPhase(run);
    case "RENDER":
      return runRenderPhase(run, artifactBaseUrl);
    case "COMPLETE":
      return markRunComplete(run.id);
    default:
      throw new AutoPipelineError(
        "Auto generation reached an unknown phase.",
        false,
      );
  }
}

async function runStoryboardPhase(run: AutoGenerationRun) {
  const selectedConcept = await prisma.creativeConcept.findFirst({
    where: { projectId: run.projectId, selected: true },
    select: { id: true },
  });
  if (!selectedConcept) {
    throw new AutoPipelineError(
      "Select a concept before resuming Auto mode.",
      false,
    );
  }

  let storyboard = await prisma.storyboard.findUnique({
    where: { projectId: run.projectId },
    include: {
      scenes: true,
      project: { select: { outputMode: true, videoLengthSec: true } },
    },
  });
  if (!storyboard || storyboard.conceptId !== selectedConcept.id) {
    const job = await createAndRunStoryboardJob(run.projectId);
    if (["QUEUED", "RUNNING", "WAITING_PROVIDER"].includes(job.status)) {
      return releaseLease(run.id, { currentJobId: job.id });
    }
    assertCompleteJob(job, "Storyboard generation");
    rejectPolicyBlockers(job);
    storyboard = await prisma.storyboard.findUnique({
      where: { projectId: run.projectId },
      include: {
        scenes: true,
        project: { select: { outputMode: true, videoLengthSec: true } },
      },
    });
  }
  if (!storyboard) {
    throw new AutoPipelineError(
      "Storyboard generation did not produce a saved storyboard.",
    );
  }
  const timingIssue = storyboardTimingIssue({
    outputMode: storyboard.project.outputMode,
    targetDurationSec: storyboard.project.videoLengthSec,
    durations: storyboard.scenes.map((scene) => scene.durationSec),
  });
  if (timingIssue) {
    throw new AutoPipelineError(
      `Storyboard needs review before Auto mode can continue: ${timingIssue}`,
      false,
    );
  }

  await prisma.$transaction([
    prisma.storyboard.update({
      where: { id: storyboard.id },
      data: { status: "APPROVED" },
    }),
    prisma.scene.updateMany({
      where: { storyboardId: storyboard.id, status: "DRAFT" },
      data: { status: "APPROVED" },
    }),
  ]);
  return moveToNextPhase(run, "STORYBOARD");
}

async function runKeyframePhase(run: AutoGenerationRun) {
  if (!(await hasCompleteAnchors(run.projectId))) {
    const job = await createAndRunKeyframeJob(run.projectId);
    await setCurrentJob(run.id, job.id);
    assertCompleteJob(job, "Scene anchor generation");
  }
  if (!(await hasCompleteAnchors(run.projectId))) {
    throw new AutoPipelineError(
      "Scene anchors are incomplete after generation.",
    );
  }
  return moveToNextPhase(run, "KEYFRAMES");
}

async function runClipPhase(run: AutoGenerationRun) {
  if (!(await hasCompleteAnchors(run.projectId))) {
    return resetToPhase(run, "KEYFRAMES");
  }
  if (await hasCompleteClips(run.projectId)) {
    return moveToNextPhase(run, "CLIPS");
  }

  let job: GenerationJob | null = null;
  if (run.currentJobId) {
    job = await prisma.generationJob.findFirst({
      where: { id: run.currentJobId, projectId: run.projectId, type: "VIDEO" },
    });
  }
  if (!job || ["FAILED", "CANCELLED", "COMPLETE"].includes(job.status)) {
    if (job?.status === "FAILED")
      assertCompleteJob(job, "Scene clip generation");
    job = await createAndRunVideoJob(run.projectId);
    await setCurrentJob(run.id, job.id);
  }
  if (job.status === "WAITING_PROVIDER" || job.status === "RUNNING") {
    job = (await advanceVideoJob(job.id)) ?? job;
  }
  if (job.status === "WAITING_PROVIDER" || job.status === "RUNNING") {
    return releaseLease(run.id, { currentJobId: job.id });
  }
  assertCompleteJob(job, "Scene clip generation");
  if (!(await hasCompleteClips(run.projectId))) {
    throw new AutoPipelineError(
      "One or more scene clips are still incomplete. Reel AI will retry only the missing scenes.",
    );
  }
  return moveToNextPhase(run, "CLIPS");
}

async function runNarrationPhase(run: AutoGenerationRun) {
  if (!(await hasCompleteClips(run.projectId))) {
    return resetToPhase(run, "CLIPS");
  }
  if (!(await hasCurrentNarration(run.projectId))) {
    await createAndRunNarrationJob(run.projectId);
    const job = await prisma.generationJob.findFirstOrThrow({
      where: { projectId: run.projectId, type: "TTS" },
      orderBy: { createdAt: "desc" },
    });
    await setCurrentJob(run.id, job.id);
    assertCompleteJob(job, "Scene narration generation");
  }
  if (!(await hasCurrentNarration(run.projectId))) {
    throw new AutoPipelineError(
      "Scene narration is incomplete after generation.",
    );
  }
  return moveToNextPhase(run, "NARRATION");
}

async function runRenderPhase(run: AutoGenerationRun, artifactBaseUrl: string) {
  if (!(await hasCompleteClips(run.projectId))) {
    return resetToPhase(run, "CLIPS");
  }
  if (!(await hasCurrentNarration(run.projectId))) {
    return resetToPhase(run, "NARRATION");
  }
  if (!(await hasCompleteRender(run.projectId, run.startedAt))) {
    const storyboard = await prisma.storyboard.findUniqueOrThrow({
      where: { projectId: run.projectId },
      select: { bgmEnabled: true },
    });
    const job = await createAndRunFinalRenderJob({
      projectId: run.projectId,
      artifactBaseUrl,
      aiDisclosureEnabled: true,
      bgmEnabled: storyboard.bgmEnabled,
    });
    await setCurrentJob(run.id, job.id);
    assertCompleteJob(job, "Final reel rendering");
  }
  if (!(await hasCompleteRender(run.projectId, run.startedAt))) {
    throw new AutoPipelineError(
      "The final reel artifact is not available after rendering.",
    );
  }
  return markRunComplete(run.id);
}

async function moveToNextPhase(run: AutoGenerationRun, phase: AutoPhase) {
  const next = nextAutoPhase(phase);
  if (next === "COMPLETE") return markRunComplete(run.id);
  return prisma.autoGenerationRun.update({
    where: { id: run.id },
    data: {
      phase: next,
      status: "RUNNING",
      currentJobId: null,
      attempt: 0,
      error: null,
      nextAttemptAt: null,
      leaseUntil: null,
    },
  });
}

async function resetToPhase(run: AutoGenerationRun, phase: AutoPhase) {
  if (run.currentJobId) {
    await prisma.generationJob.updateMany({
      where: {
        id: run.currentJobId,
        status: { in: ["QUEUED", "RUNNING", "WAITING_PROVIDER"] },
      },
      data: {
        status: "CANCELLED",
        error: "Superseded after an upstream Auto mode input changed.",
        completedAt: new Date(),
      },
    });
  }
  return prisma.autoGenerationRun.update({
    where: { id: run.id },
    data: {
      phase,
      status: "RUNNING",
      currentJobId: null,
      attempt: 0,
      error: null,
      nextAttemptAt: null,
      leaseUntil: null,
    },
  });
}

async function markRunComplete(runId: string) {
  return prisma.autoGenerationRun.update({
    where: { id: runId },
    data: {
      phase: "COMPLETE",
      status: "COMPLETE",
      attempt: 0,
      error: null,
      nextAttemptAt: null,
      leaseUntil: null,
      completedAt: new Date(),
    },
  });
}

async function handlePhaseFailure(run: AutoGenerationRun, error: unknown) {
  const message = autoErrorMessage(error, run.phase);
  const nextAttempt = run.attempt + 1;
  const retryable = !(error instanceof AutoPipelineError) || error.retryable;
  const exhausted = !retryable || nextAttempt >= run.maxAttempts;

  await prisma.autoGenerationRun.update({
    where: { id: run.id },
    data: exhausted
      ? {
          status: "FAILED",
          attempt: nextAttempt,
          currentJobId: null,
          error: message,
          leaseUntil: null,
          nextAttemptAt: null,
          completedAt: new Date(),
        }
      : {
          status: "WAITING_RETRY",
          attempt: nextAttempt,
          currentJobId: null,
          error: message,
          leaseUntil: null,
          nextAttemptAt: new Date(Date.now() + retryDelayMs(nextAttempt)),
        },
  });
}

function assertCompleteJob(job: GenerationJob, label: string) {
  if (job.status === "COMPLETE") return;
  const message = job.error
    ? `${label}: ${job.error}`
    : `${label} did not complete.`;
  const retryable =
    !/shorten|must be approved|not found|select (?:exactly )?one|before (?:proceeding|resuming)|policy|requires human review|upload the/i.test(
      message,
    );
  throw new AutoPipelineError(message, retryable);
}

function rejectPolicyBlockers(job: GenerationJob) {
  const output = asRecord(job.output);
  const warnings = Array.isArray(output?.warnings) ? output.warnings : [];
  const blocker = warnings.find(
    (item) => asRecord(item)?.severity === "blocker",
  );
  if (blocker) {
    throw new AutoPipelineError(
      "The storyboard needs a quick policy review before generation. Open Storyboard to soften the flagged claim, approve it, then resume Auto mode.",
      false,
    );
  }
}

async function hasCompleteAnchors(projectId: string) {
  const storyboard = await productionStoryboard(projectId);
  return Boolean(
    storyboard?.scenes.length &&
    storyboard.scenes.every((scene) => {
      const take = scene.takes.find(
        (candidate) => candidate.id === scene.selectedKeyframeTakeId,
      );
      return (
        take?.kind === "KEYFRAME_START" &&
        take.status === "COMPLETE" &&
        Boolean(take.artifactId)
      );
    }),
  );
}

async function hasCurrentApprovedStoryboard(projectId: string) {
  const [selectedConcept, storyboard] = await Promise.all([
    prisma.creativeConcept.findFirst({
      where: { projectId, selected: true },
      select: { id: true },
    }),
    prisma.storyboard.findUnique({
      where: { projectId },
      select: {
        conceptId: true,
        status: true,
        scenes: { select: { durationSec: true } },
        project: { select: { outputMode: true, videoLengthSec: true } },
      },
    }),
  ]);
  if (
    !selectedConcept ||
    !storyboard ||
    storyboard.conceptId !== selectedConcept.id ||
    !["APPROVED", "COMPLETE"].includes(storyboard.status)
  ) {
    return false;
  }
  return !storyboardTimingIssue({
    outputMode: storyboard.project.outputMode,
    targetDurationSec: storyboard.project.videoLengthSec,
    durations: storyboard.scenes.map((scene) => scene.durationSec),
  });
}

async function hasCompleteClips(projectId: string) {
  const storyboard = await productionStoryboard(projectId);
  return Boolean(
    storyboard?.scenes.length &&
    storyboard.scenes.every((scene) => {
      const take = scene.takes.find(
        (candidate) => candidate.id === scene.selectedVideoTakeId,
      );
      return (
        scene.status === "COMPLETE" &&
        take?.kind === "VIDEO" &&
        take.status === "COMPLETE" &&
        Boolean(take.artifactId)
      );
    }),
  );
}

function productionStoryboard(projectId: string) {
  return prisma.storyboard.findUnique({
    where: { projectId },
    include: {
      scenes: {
        include: { takes: true },
        orderBy: { index: "asc" },
      },
    },
  });
}

async function hasCurrentNarration(projectId: string) {
  const storyboard = await prisma.storyboard.findUnique({
    where: { projectId },
    include: { scenes: { orderBy: { index: "asc" } } },
  });
  if (!storyboard) return false;
  const requiredIds = storyboard.scenes
    .filter((scene) => scene.voiceoverText.trim())
    .map((scene) => scene.narrationArtifactId)
    .filter((id): id is string => Boolean(id));
  const voicedScenes = storyboard.scenes.filter((scene) =>
    scene.voiceoverText.trim(),
  );
  if (voicedScenes.length === 0) return true;
  if (requiredIds.length !== voicedScenes.length) return false;
  const artifactCount = await prisma.artifact.count({
    where: { id: { in: requiredIds }, projectId, type: "AUDIO" },
  });
  return artifactCount === requiredIds.length;
}

async function hasCompleteRender(projectId: string, startedAt: Date) {
  const render = await prisma.render.findFirst({
    where: {
      projectId,
      status: "COMPLETE",
      artifactId: { not: null },
      completedAt: { gte: startedAt },
    },
    orderBy: { completedAt: "desc" },
  });
  if (!render?.artifactId) return false;
  return Boolean(
    await prisma.artifact.findFirst({
      where: { id: render.artifactId, projectId, type: "FINAL_RENDER" },
      select: { id: true },
    }),
  );
}

function setCurrentJob(runId: string, currentJobId: string) {
  return prisma.autoGenerationRun.update({
    where: { id: runId },
    data: { currentJobId },
  });
}

function releaseLease(
  runId: string,
  data: { currentJobId?: string | null } = {},
) {
  return prisma.autoGenerationRun.update({
    where: { id: runId },
    data: { status: "RUNNING", leaseUntil: null, ...data },
  });
}

function autoErrorMessage(error: unknown, phase: string) {
  const detail =
    error instanceof Error
      ? error.message
      : "The generation service did not respond.";
  return `${formatPhase(phase)} paused: ${detail}`.slice(0, 900);
}

function formatPhase(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
