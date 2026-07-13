import "server-only";

import type { Prisma } from "@prisma/client";

import {
  generateConceptsForProject,
  generateStoryboardForProject,
  getCreativeGenerationError,
  regenerateConceptForProject,
} from "@/lib/agents/creative";
import { prisma } from "@/lib/prisma";
import { QWEN_STRUCTURED_MODEL } from "@/lib/qwen/client";

export async function createAndRunConceptJob(projectId: string) {
  const job = await prisma.generationJob.create({
    data: {
      projectId,
      type: "CONCEPTS",
      status: "QUEUED",
      model: QWEN_STRUCTURED_MODEL,
      input: { operation: "creative_director_concepts" },
    },
  });

  return runConceptJob(job.id);
}

export async function createAndRunConceptRegenerationJob({
  projectId,
  conceptId,
  adjustmentNote,
}: {
  projectId: string;
  conceptId: string;
  adjustmentNote: string;
}) {
  const job = await prisma.generationJob.create({
    data: {
      projectId,
      type: "CONCEPTS",
      status: "QUEUED",
      model: QWEN_STRUCTURED_MODEL,
      input: {
        operation: "creative_director_concept_regeneration",
        conceptId,
        adjustmentNote: adjustmentNote || null,
      },
    },
  });

  return runConceptRegenerationJob(job.id, conceptId, adjustmentNote);
}

export async function createAndRunStoryboardJob(projectId: string) {
  const job = await prisma.generationJob.create({
    data: {
      projectId,
      type: "STORYBOARD",
      status: "QUEUED",
      model: QWEN_STRUCTURED_MODEL,
      input: { operation: "storyboard_generation" },
    },
  });

  return runStoryboardJob(job.id);
}

async function runConceptJob(jobId: string) {
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
      data: { status: "CONCEPTING" },
    });

    const result = await generateConceptsForProject(job.projectId);
    const completed = await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETE",
        model: result.model,
        providerTaskId: result.providerRequestId,
        output: {
          conceptIds: result.concepts.map((concept) => concept.id),
          elapsedMs: result.elapsedMs,
          usage: toJsonValue(result.usage),
        },
        completedAt: new Date(),
      },
    });

    await prisma.project.update({
      where: { id: job.projectId },
      data: { status: "DRAFT" },
    });

    return completed;
  } catch (error) {
    return failJob(job.id, job.projectId, error);
  }
}

async function runConceptRegenerationJob(
  jobId: string,
  conceptId: string,
  adjustmentNote: string,
) {
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
      data: { status: "CONCEPTING" },
    });

    const result = await regenerateConceptForProject({
      projectId: job.projectId,
      conceptId,
      adjustmentNote,
    });
    const completed = await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETE",
        model: result.model,
        providerTaskId: result.providerRequestId,
        output: {
          conceptId: result.concept.id,
          invalidatedStoryboard: result.invalidatedStoryboard,
          elapsedMs: result.elapsedMs,
          usage: toJsonValue(result.usage),
        },
        completedAt: new Date(),
      },
    });

    await prisma.project.update({
      where: { id: job.projectId },
      data: { status: "DRAFT" },
    });

    return completed;
  } catch (error) {
    return failJob(job.id, job.projectId, error);
  }
}

async function runStoryboardJob(jobId: string) {
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
      data: { status: "STORYBOARDING" },
    });

    const result = await generateStoryboardForProject(job.projectId);
    const completed = await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETE",
        model: result.model,
        providerTaskId: result.providerRequestId,
        output: {
          storyboardId: result.storyboard.id,
          sceneCount: result.storyboard.scenes.length,
          warnings: result.warnings,
          groundingRecovery: result.groundingRecovery,
          elapsedMs: result.elapsedMs,
          usage: toJsonValue(result.usage),
        },
        completedAt: new Date(),
      },
    });

    await prisma.project.update({
      where: { id: job.projectId },
      data: { status: "DRAFT" },
    });

    return completed;
  } catch (error) {
    return failJob(job.id, job.projectId, error);
  }
}

async function failJob(jobId: string, projectId: string, error: unknown) {
  const safeError = getCreativeGenerationError(error);
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

function toJsonValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined || value === null) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
