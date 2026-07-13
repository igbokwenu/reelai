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

    const candidate = await prisma.creativeConcept.findFirst({
      where: { id: conceptId, projectId },
      select: { previewArtifactId: true },
    });
    if (!candidate) return notFound("Concept not found");
    const preview = candidate.previewArtifactId
      ? await prisma.artifact.findUnique({
          where: { id: candidate.previewArtifactId },
          select: { metadata: true },
        })
      : null;
    const metadata = preview?.metadata as { groundingMode?: unknown } | null;
    if (typeof metadata?.groundingMode !== "string") {
      return ok(
        { error: "Regenerate this concept with the current visual grounding safeguards before selecting it." },
        { status: 409 },
      );
    }

    const concept = await selectConcept(projectId, conceptId);

    return ok({ concept });
  });
}
