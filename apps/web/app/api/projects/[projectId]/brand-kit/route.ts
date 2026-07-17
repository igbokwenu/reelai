import { badRequest, handleRoute, notFound, ok } from "@/lib/http/responses";
import {
  createAndRunBrandKitJob,
  createQueuedBrandKitJob,
  runBrandKitJob,
} from "@/lib/jobs/brand-kit";
import { assertManualControlAvailable } from "@/lib/jobs/manual-control";
import { prisma } from "@/lib/prisma";
import { after } from "next/server";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { projectId } = await context.params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        products: { select: { id: true } },
        sources: {
          where: { type: "PRODUCT_IMAGE", artifactId: { not: null } },
          select: { productId: true },
        },
      },
    });

    if (!project) {
      return notFound("Project not found");
    }
    await assertManualControlAvailable(projectId);

    if (project.outputMode === "PRODUCT_SHOWCASE") {
      const coveredProducts = new Set(
        project.sources.map((source) => source.productId).filter(Boolean),
      );
      if (
        project.products.length !== 1 ||
        project.sources.length !== 1 ||
        !coveredProducts.has(project.products[0]!.id)
      ) {
        return badRequest(
          "Product Showcase requires exactly one product with one product image.",
        );
      }
    }

    const background =
      request.headers.get("content-type")?.includes("application/json") &&
      (
        (await request.json().catch(() => null)) as {
          background?: unknown;
        } | null
      )?.background === true;
    const job = background
      ? await createQueuedBrandKitJob(projectId, "initial_project_setup")
      : await createAndRunBrandKitJob(projectId);
    if (background) {
      after(async () => {
        await runBrandKitJob(job.id);
      });
    }
    const brandKit = await prisma.brandKit.findUnique({
      where: { projectId },
    });

    return ok({ job, brandKit });
  });
}
