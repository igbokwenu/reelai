import { handleRoute, notFound, ok } from "@/lib/http/responses";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { jobId } = await context.params;
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return notFound("Job not found");
    }

    return ok({ job });
  });
}
