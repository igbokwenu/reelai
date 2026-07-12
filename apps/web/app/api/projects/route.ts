import { created, handleRoute, ok } from "@/lib/http/responses";
import { runBrandKitJob } from "@/lib/jobs/brand-kit";
import { prisma } from "@/lib/prisma";
import { QWEN_STRUCTURED_MODEL } from "@/lib/qwen/client";
import { createProjectSchema, inferProjectIdentity } from "@/lib/schemas/project";
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
          sources: input.websiteUrl || input.brief
            ? {
                create: {
                  type: input.websiteUrl ? "WEBSITE" : "DOCUMENT",
                  url: input.websiteUrl,
                  metadata: {
                    label: input.websiteUrl ? "Project website" : "Creative direction",
                    source: "project-intake",
                    creativeDirection: input.brief,
                  },
                },
              }
            : undefined,
        },
        include: { sources: true },
      });
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
