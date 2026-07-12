import { created, handleRoute, ok } from "@/lib/http/responses";
import { createQueuedBrandKitJob, runBrandKitJob } from "@/lib/jobs/brand-kit";
import { prisma } from "@/lib/prisma";
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
    const project = await prisma.project.create({
      data: {
        ...identity,
        websiteUrl: input.websiteUrl,
        targetAudience: input.targetAudience,
        offer: input.offer,
        brief: input.brief,
        videoLengthSec: input.videoLengthSec,
        style: input.style,
        sources: input.websiteUrl
          ? {
              create: {
                type: "WEBSITE",
                url: input.websiteUrl,
                metadata: {
                  label: "Project website",
                  source: "project-intake",
                },
              },
            }
          : undefined,
      },
      include: { sources: true },
    });

    const brandKitJob = input.generateBrandKit
      ? await createQueuedBrandKitJob(project.id, "project_creation")
      : null;

    if (brandKitJob) {
      after(async () => {
        await runBrandKitJob(brandKitJob.id);
      });
    }

    return created({ project, brandKitJob });
  });
}
