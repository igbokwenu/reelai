import { handleRoute, notFound } from "@/lib/http/responses";
import { readLocalObject } from "@/lib/oss";
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

    if (artifact.publicUrl?.startsWith("http")) {
      return Response.redirect(artifact.publicUrl, 302);
    }

    const body = await readLocalObject(artifact.ossKey);

    return new Response(body, {
      headers: {
        "Content-Type": artifact.mimeType,
        "Content-Disposition": `inline; filename="${artifact.id}"`,
      },
    });
  });
}
