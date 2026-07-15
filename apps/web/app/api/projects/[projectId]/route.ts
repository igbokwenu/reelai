import { handleRoute, notFound, ok } from "@/lib/http/responses";
import { prisma } from "@/lib/prisma";
import { getProjectGraph } from "@/lib/projects/graph";
import { deleteStoredObject } from "@/lib/oss";
import { assertManualControlAvailable } from "@/lib/jobs/manual-control";
import { projectCreativeSettingsSchema } from "@/lib/schemas/project";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

// A dev server or browser test can be stopped while an `after()` job is
// running, leaving a job that can never transition out of RUNNING. Treat only
// recently updated jobs as active so those abandoned projects remain
// deletable. Provider jobs update their row as they progress or finish.
const ACTIVE_JOB_STALE_AFTER_MS = 10 * 60 * 1_000;
const ACTIVE_AUTO_RUN_STALE_AFTER_MS = 30 * 60 * 1_000;

export async function GET(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { projectId } = await context.params;
    const project = await getProjectGraph(projectId);

    if (!project) {
      return notFound("Project not found");
    }

    return ok({ project });
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { projectId } = await context.params;
    const input = projectCreativeSettingsSchema.parse(await request.json());
    const exists = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!exists) return notFound("Project not found");
    await assertManualControlAvailable(projectId);

    const project = await prisma.project.update({
      where: { id: projectId },
      data: { cinematicBoost: input.cinematicBoost },
      select: { id: true, cinematicBoost: true },
    });

    return ok({ project });
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { projectId } = await context.params;
    const activeJobCutoff = new Date(Date.now() - ACTIVE_JOB_STALE_AFTER_MS);
    const activeAutoRunCutoff = new Date(
      Date.now() - ACTIVE_AUTO_RUN_STALE_AFTER_MS,
    );
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        jobs: {
          where: {
            status: { in: ["QUEUED", "RUNNING", "WAITING_PROVIDER"] },
            updatedAt: { gte: activeJobCutoff },
          },
          select: { id: true },
          take: 1,
        },
        autoRuns: {
          where: {
            status: { in: ["RUNNING", "WAITING_RETRY"] },
            updatedAt: { gte: activeAutoRunCutoff },
          },
          select: { id: true },
          take: 1,
        },
        artifacts: { select: { ossKey: true } },
      },
    });

    if (!project) return notFound("Project not found");
    if (project.jobs.length > 0 || project.autoRuns.length > 0) {
      return ok(
        {
          error:
            "Wait for the active generation to finish before deleting this project.",
        },
        { status: 409 },
      );
    }

    const cleanup = await Promise.allSettled(
      project.artifacts.map((artifact) => deleteStoredObject(artifact.ossKey)),
    );
    const failedCleanup = cleanup.filter(
      (result) => result.status === "rejected",
    ).length;
    if (failedCleanup > 0) {
      console.warn("Project artifact cleanup was incomplete", {
        projectId,
        failedCleanup,
      });
    }
    await prisma.project.delete({ where: { id: projectId } });
    return ok({ deleted: true, projectId });
  });
}
