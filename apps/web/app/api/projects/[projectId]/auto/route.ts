import { z } from "zod";

import { handleRoute, notFound, ok } from "@/lib/http/responses";
import {
  advanceAutoGeneration,
  resumeAutoGeneration,
  startAutoGeneration,
} from "@/lib/jobs/auto-production";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ projectId: string }> };

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), enabled: z.boolean().default(true) }),
  z.object({ action: z.literal("resume") }),
]);

export async function POST(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { projectId } = await context.params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) return notFound("Project not found");

    const body = requestSchema.parse(await request.json());
    const run =
      body.action === "resume"
        ? await resumeAutoGeneration(projectId)
        : await startAutoGeneration({ projectId, enabled: body.enabled });
    return ok({ run, autoMode: body.action === "start" ? body.enabled : true });
  });
}

export async function GET(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { projectId } = await context.params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) return notFound("Project not found");

    const run = await advanceAutoGeneration({
      projectId,
      artifactBaseUrl: new URL(request.url).origin,
    });
    return ok({ run });
  });
}
