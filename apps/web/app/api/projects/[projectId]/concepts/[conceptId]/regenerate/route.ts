import { handleRoute, notFound, ok } from "@/lib/http/responses";
import { createAndRunConceptRegenerationJob } from "@/lib/jobs/creative";
import { prisma } from "@/lib/prisma";
import { creativeConceptRegenerationInputSchema } from "@/lib/schemas/agent";

type RouteContext = {
  params: Promise<{ projectId: string; conceptId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { projectId, conceptId } = await context.params;
    const input = creativeConceptRegenerationInputSchema.parse(
      await request.json().catch(() => ({})),
    );
    const concept = await prisma.creativeConcept.findFirst({
      where: { id: conceptId, projectId },
      select: {
        id: true,
        project: { select: { brandKit: { select: { id: true } } } },
      },
    });

    if (!concept) {
      return notFound("Concept not found");
    }

    if (!concept.project.brandKit) {
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

    const job = await createAndRunConceptRegenerationJob({
      projectId,
      conceptId,
      adjustmentNote: input.adjustmentNote,
    });
    const updatedConcept = await prisma.creativeConcept.findUnique({
      where: { id: conceptId },
    });

    return ok({ job, concept: updatedConcept });
  });
}
