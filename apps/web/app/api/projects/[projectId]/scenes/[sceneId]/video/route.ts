import { handleRoute, notFound, ok } from "@/lib/http/responses";
import { createAndRunSceneVideoJob } from "@/lib/jobs/production";
import { assertManualControlAvailable } from "@/lib/jobs/manual-control";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ projectId: string; sceneId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { projectId, sceneId } = await context.params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return notFound("Project not found");
    }
    await assertManualControlAvailable(projectId);

    const job = await createAndRunSceneVideoJob(projectId, sceneId);
    return ok({ job });
  });
}
