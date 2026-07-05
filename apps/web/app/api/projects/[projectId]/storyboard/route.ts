import { handleRoute, notFound, ok } from "@/lib/http/responses";
import { createAndRunStoryboardJob } from "@/lib/jobs/creative";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { projectId } = await context.params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        brandKit: { select: { id: true } },
        concepts: { where: { selected: true }, select: { id: true } },
      },
    });

    if (!project) {
      return notFound("Project not found");
    }

    if (!project.brandKit) {
      return ok(
        { error: "Generate a Brand Kit before storyboard planning." },
        { status: 409 },
      );
    }

    if (project.concepts.length !== 1) {
      return ok(
        { error: "Select exactly one creative concept before storyboard planning." },
        { status: 409 },
      );
    }

    const job = await createAndRunStoryboardJob(projectId);
    const storyboard = await prisma.storyboard.findUnique({
      where: { projectId },
      include: { scenes: { orderBy: { index: "asc" } } },
    });

    return ok({ job, storyboard });
  });
}
