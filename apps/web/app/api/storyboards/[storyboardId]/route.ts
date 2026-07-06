import { handleRoute, notFound, ok } from "@/lib/http/responses";
import { prisma } from "@/lib/prisma";
import { storyboardPatchSchema } from "@/lib/schemas/agent";

type RouteContext = {
  params: Promise<{ storyboardId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { storyboardId } = await context.params;
    const body = storyboardPatchSchema.parse(await request.json());
    const storyboard = await prisma.storyboard.findUnique({
      where: { id: storyboardId },
      include: { scenes: true },
    });

    if (!storyboard) {
      return notFound("Storyboard not found");
    }

    if (body.scenes) {
      const knownSceneIds = new Set(storyboard.scenes.map((scene) => scene.id));

      for (const scene of body.scenes) {
        if (!knownSceneIds.has(scene.id)) {
          return notFound("Scene not found");
        }
      }
    }

    await prisma.$transaction([
      prisma.storyboard.update({
        where: { id: storyboardId },
        data: {
          title: body.title,
          script: body.script,
          bgmEnabled: body.bgmEnabled,
          bgmPrompt: body.bgmPrompt,
          status: "APPROVED",
        },
      }),
      ...(body.scenes ?? []).map((scene) =>
        prisma.scene.update({
          where: { id: scene.id },
          data: {
            durationSec: scene.durationSec,
            captionText: scene.captionText,
            voiceoverText: scene.voiceoverText,
            startFramePrompt: scene.startFramePrompt,
            endFramePrompt: scene.endFramePrompt,
            videoMotionPrompt: scene.videoMotionPrompt,
            continuityNotes: scene.continuityNotes,
            status: "APPROVED",
          },
        }),
      ),
    ]);

    const updated = await prisma.storyboard.findUniqueOrThrow({
      where: { id: storyboardId },
      include: { scenes: { orderBy: { index: "asc" } } },
    });

    return ok({ storyboard: updated });
  });
}
