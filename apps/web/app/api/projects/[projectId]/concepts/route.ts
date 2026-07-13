import { handleRoute, notFound, ok } from "@/lib/http/responses";
import { createAndRunConceptJob } from "@/lib/jobs/creative";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { projectId } = await context.params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, brandKit: { select: { id: true } } },
    });

    if (!project) {
      return notFound("Project not found");
    }

    if (!project.brandKit) {
      return ok(
        { error: "Generate a Brand Kit before creative concepts." },
        { status: 409 },
      );
    }

    const activeJob = await prisma.generationJob.findFirst({
      where: {
        projectId,
        type: "CONCEPTS",
        status: { in: ["QUEUED", "RUNNING", "WAITING_PROVIDER"] },
      },
      select: { id: true },
    });
    if (activeJob) {
      return ok(
        { error: "Another concept generation is already in progress." },
        { status: 409 },
      );
    }

    const job = await createAndRunConceptJob(projectId);
    const concepts = await prisma.creativeConcept.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });

    return ok({ job, concepts });
  });
}
