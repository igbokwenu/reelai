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

    const continuityChanged =
      (body.productContinuity !== undefined &&
        body.productContinuity !== storyboard.productContinuity) ||
      (body.characterContinuity !== undefined &&
        body.characterContinuity !== storyboard.characterContinuity) ||
      (body.visualContinuity !== undefined &&
        body.visualContinuity !== storyboard.visualContinuity);
    const existingSceneById = new Map(
      storyboard.scenes.map((scene) => [scene.id, scene]),
    );
    const sceneChanges = (body.scenes ?? []).map((scene) => {
      const existing = existingSceneById.get(scene.id)!;
      const imageChanged =
        continuityChanged ||
        scene.startFramePrompt !== existing.startFramePrompt ||
        scene.endFramePrompt !== existing.endFramePrompt ||
        scene.continuityNotes !== existing.continuityNotes ||
        scene.continuityMode !== existing.continuityMode;
      const videoChanged =
        imageChanged ||
        scene.durationSec !== existing.durationSec ||
        scene.captionText !== existing.captionText ||
        scene.videoMotionPrompt !== existing.videoMotionPrompt;

      return { scene, imageChanged, videoChanged };
    });

    await prisma.$transaction([
      prisma.storyboard.update({
        where: { id: storyboardId },
        data: {
          title: body.title,
          script: body.script,
          bgmEnabled: body.bgmEnabled,
          bgmPrompt: body.bgmPrompt,
          productContinuity: body.productContinuity,
          characterContinuity: body.characterContinuity,
          visualContinuity: body.visualContinuity,
          status: "APPROVED",
        },
      }),
      ...sceneChanges.map(({ scene, imageChanged, videoChanged }) =>
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
            continuityMode: scene.continuityMode,
            selectedKeyframeTakeId: imageChanged ? null : undefined,
            selectedEndFrameTakeId: imageChanged ? null : undefined,
            selectedVideoTakeId: videoChanged ? null : undefined,
            status: "APPROVED",
          },
        }),
      ),
      ...sceneChanges
        .filter(
          ({ imageChanged, videoChanged }) => imageChanged || videoChanged,
        )
        .map(({ scene, imageChanged }) =>
          prisma.take.updateMany({
            where: {
              sceneId: scene.id,
              ...(imageChanged ? {} : { kind: "VIDEO" as const }),
            },
            data: { selected: false },
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
