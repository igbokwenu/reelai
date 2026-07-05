import { created, handleRoute, ok } from "@/lib/http/responses";
import { prisma } from "@/lib/prisma";
import { createProjectSchema } from "@/lib/schemas/project";

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
    const project = await prisma.project.create({
      data: {
        ...input,
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

    return created({ project });
  });
}
