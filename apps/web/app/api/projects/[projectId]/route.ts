import { handleRoute, notFound, ok } from "@/lib/http/responses";
import { prisma } from "@/lib/prisma";
import { getProjectGraph } from "@/lib/projects/graph";
import { deleteStoredObject } from "@/lib/oss";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

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

export async function DELETE(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { projectId } = await context.params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        jobs: {
          where: { status: { in: ["QUEUED", "RUNNING", "WAITING_PROVIDER"] } },
          select: { id: true },
          take: 1,
        },
        artifacts: { select: { ossKey: true } },
      },
    });

    if (!project) return notFound("Project not found");
    if (project.jobs.length > 0) {
      return ok(
        { error: "Wait for the active generation to finish before deleting this project." },
        { status: 409 },
      );
    }

    const cleanup = await Promise.allSettled(
      project.artifacts.map((artifact) => deleteStoredObject(artifact.ossKey)),
    );
    const failedCleanup = cleanup.filter((result) => result.status === "rejected").length;
    if (failedCleanup > 0) {
      console.warn("Project artifact cleanup was incomplete", { projectId, failedCleanup });
    }
    await prisma.project.delete({ where: { id: projectId } });
    return ok({ deleted: true, projectId });
  });
}
