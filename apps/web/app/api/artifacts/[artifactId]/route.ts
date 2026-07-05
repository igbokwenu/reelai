import { handleRoute, notFound, ok } from "@/lib/http/responses";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ artifactId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { artifactId } = await context.params;
    const artifact = await prisma.artifact.findUnique({
      where: { id: artifactId },
    });

    if (!artifact) {
      return notFound("Artifact not found");
    }

    return ok({ artifact });
  });
}
