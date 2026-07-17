import { created, handleRoute, ok } from "@/lib/http/responses";
import { runBrandKitJob } from "@/lib/jobs/brand-kit";
import { prisma } from "@/lib/prisma";
import { QWEN_STRUCTURED_MODEL } from "@/lib/qwen/client";
import {
  createProjectSchema,
  inferProjectIdentity,
} from "@/lib/schemas/project";
import { after } from "next/server";

export async function GET() {
  return handleRoute(async () => {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { artifacts: true, sources: true },
        },
      },
    });

    return ok({ projects });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const input = createProjectSchema.parse(await request.json());
    const identity = inferProjectIdentity(input);
    const { project, brandKitJob } = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          ...identity,
          websiteUrl: input.websiteUrl,
          targetAudience: input.targetAudience,
          offer: input.offer,
          videoLengthSec: input.videoLengthSec,
          style: input.style,
          outputMode: input.outputMode,
          razzmatazzMode: input.razzmatazzMode,
          products:
            input.outputMode === "PRODUCT_SHOWCASE"
              ? {
                  create: input.products.map((product, sortOrder) => ({
                    name: product.name,
                    details: product.details,
                    websiteUrl: product.websiteUrl,
                    sortOrder,
                  })),
                }
              : undefined,
          sources:
            input.websiteUrl || input.brief
              ? {
                  create: {
                    type: input.websiteUrl ? "WEBSITE" : "DOCUMENT",
                    url: input.websiteUrl,
                    metadata: {
                      label: input.websiteUrl
                        ? "Project website"
                        : "Creative direction",
                      source: "project-intake",
                      creativeDirection: input.brief,
                      businessNameInferred: !input.businessName,
                      projectNameInferred: !input.name,
                    },
                  },
                }
              : undefined,
        },
        include: { sources: true, products: { orderBy: { sortOrder: "asc" } } },
      });
      if (input.outputMode === "PRODUCT_SHOWCASE") {
        const productSources = project.products.flatMap((product) =>
          product.websiteUrl && product.websiteUrl !== input.websiteUrl
            ? [
                {
                  projectId: project.id,
                  productId: product.id,
                  type: "WEBSITE" as const,
                  url: product.websiteUrl,
                  metadata: {
                    label: `${product.name} product page`,
                    source: "product-showcase-intake",
                  },
                },
              ]
            : [],
        );
        if (productSources.length > 0) {
          await tx.brandSource.createMany({ data: productSources });
        }
      }
      const brandKitJob = input.generateBrandKit
        ? await tx.generationJob.create({
            data: {
              projectId: project.id,
              type: "BRAND_KIT",
              status: "QUEUED",
              model: QWEN_STRUCTURED_MODEL,
              input: {
                operation: "brand_kit_generation",
                source: "project_creation",
              },
            },
          })
        : null;
      return { project, brandKitJob };
    });

    if (brandKitJob) {
      after(async () => {
        await runBrandKitJob(brandKitJob.id);
      });
    }

    return created({ project, brandKitJob });
  });
}
