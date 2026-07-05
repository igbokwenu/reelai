import { handleRoute, notFound, ok } from "@/lib/http/responses";
import { selectConcept } from "@/lib/agents/creative";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ projectId: string; conceptId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { projectId, conceptId } = await context.params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return notFound("Project not found");
    }

    const concept = await selectConcept(projectId, conceptId);

    return ok({ concept });
  });
}
