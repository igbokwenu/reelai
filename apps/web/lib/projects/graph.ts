import { prisma } from "@/lib/prisma";

export function getProjectGraph(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      brandKit: true,
      sources: { orderBy: { createdAt: "desc" } },
      concepts: { orderBy: { createdAt: "asc" } },
      storyboard: {
        include: {
          scenes: {
            include: { takes: { orderBy: { createdAt: "desc" } } },
            orderBy: { index: "asc" },
          },
        },
      },
      jobs: { orderBy: { createdAt: "desc" }, take: 12 },
      artifacts: { orderBy: { createdAt: "desc" } },
      renders: { orderBy: { createdAt: "desc" } },
    },
  });
}
