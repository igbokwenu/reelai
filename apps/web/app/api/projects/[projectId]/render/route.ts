import { z } from "zod";

import { handleRoute, notFound, ok } from "@/lib/http/responses";
import { createAndRunFinalRenderJob } from "@/lib/jobs/final-render";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

const renderRequestSchema = z.object({
  aiDisclosureEnabled: z.boolean().default(true),
  bgmEnabled: z.boolean().default(false),
});

export async function POST(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { projectId } = await context.params;
    const body = renderRequestSchema.parse(
      await request.json().catch(() => ({})),
    );
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      return notFound("Project not found");
    }

    const job = await createAndRunFinalRenderJob({
      projectId,
      artifactBaseUrl: new URL(request.url).origin,
      aiDisclosureEnabled: body.aiDisclosureEnabled,
      bgmEnabled: body.bgmEnabled,
    });
    return ok({ job });
  });
}
