import { handleRoute, notFound, ok } from "@/lib/http/responses";
import { createAndRunNarrationJob } from "@/lib/jobs/final-render";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { projectId } = await context.params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return notFound("Project not found");
    }

    const job = await createAndRunNarrationJob(projectId);
    return ok({ job });
  });
}
