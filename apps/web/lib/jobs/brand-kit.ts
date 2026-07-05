import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  generateBrandKitForProject,
  getBrandKitGenerationError,
} from "@/lib/agents/brand-kit";
import { QWEN_STRUCTURED_MODEL } from "@/lib/qwen/client";

export async function createAndRunBrandKitJob(projectId: string) {
  const job = await prisma.generationJob.create({
    data: {
      projectId,
      type: "BRAND_KIT",
      status: "QUEUED",
      model: QWEN_STRUCTURED_MODEL,
      input: {
        operation: "brand_kit_generation",
        source: "project_context",
      },
    },
  });

  return runBrandKitJob(job.id);
}

export async function runBrandKitJob(jobId: string) {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      error: null,
    },
  });

  const job = await prisma.generationJob.findUniqueOrThrow({
    where: { id: jobId },
  });

  try {
    await prisma.project.update({
      where: { id: job.projectId },
      data: { status: "RESEARCHING" },
    });

    const result = await generateBrandKitForProject(job.projectId);
    const completed = await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETE",
        model: result.model,
        providerTaskId: result.providerRequestId,
        output: {
          brandKitId: result.brandKit.id,
          elapsedMs: result.elapsedMs,
          usage: toJsonValue(result.usage),
          fields: Object.keys(result.output),
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
    const safeError = getBrandKitGenerationError(error);
    const failed = await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: safeError,
        completedAt: new Date(),
      },
    });

    await prisma.project.update({
      where: { id: job.projectId },
      data: { status: "FAILED" },
    });

    return failed;
  }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined || value === null) {
    return null;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
