import { handleRoute, notFound, ok } from "@/lib/http/responses";
import { advanceVideoJob } from "@/lib/jobs/production";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { jobId } = await context.params;
    const found = await prisma.generationJob.findUnique({
      where: { id: jobId },
    });

    if (!found) {
      return notFound("Job not found");
    }

    const job =
      found.type === "VIDEO" && found.status === "WAITING_PROVIDER"
        ? await advanceVideoJob(found.id)
        : found;

    return ok({ job });
  });
}
