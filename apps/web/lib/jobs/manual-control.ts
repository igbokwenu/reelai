import { PublicError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const AUTO_CONTROL_MESSAGE =
  "Auto mode is currently building this reel. Manual generation and edits return automatically when the run completes or pauses for review.";

export async function assertManualControlAvailable(projectId: string) {
  const activeRun = await prisma.autoGenerationRun.findFirst({
    where: {
      projectId,
      status: { in: ["RUNNING", "WAITING_RETRY"] },
    },
    select: { id: true },
  });

  if (activeRun) throw new PublicError(AUTO_CONTROL_MESSAGE, 409);
}

export async function assertManualTakeControlAvailable(takeId: string) {
  const take = await prisma.take.findUnique({
    where: { id: takeId },
    select: {
      scene: {
        select: { storyboard: { select: { projectId: true } } },
      },
    },
  });

  if (take) {
    await assertManualControlAvailable(take.scene.storyboard.projectId);
  }
}
