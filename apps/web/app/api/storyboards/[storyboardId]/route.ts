import { handleRoute, notFound, ok } from "@/lib/http/responses";
import { prisma } from "@/lib/prisma";
import { storyboardPatchSchema } from "@/lib/schemas/agent";
import { planContinuityInvalidation } from "@/lib/storyboards/continuity-invalidation";

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
    const invalidation = planContinuityInvalidation(
      storyboard.scenes,
      body.scenes ?? [],
      continuityChanged,
    );
    const patchBySceneId = new Map(
      (body.scenes ?? []).map((scene) => [scene.id, scene]),
    );
    const sceneOutputChanged = (body.scenes ?? []).some((scene) => {
      const existing = existingSceneById.get(scene.id)!;
      return (
        scene.durationSec !== existing.durationSec ||
        scene.captionText !== existing.captionText ||
        scene.voiceoverText !== existing.voiceoverText ||
        scene.anchorFramePrompt !== existing.anchorFramePrompt ||
        scene.transitionOutPrompt !== existing.transitionOutPrompt ||
        scene.videoMotionPrompt !== existing.videoMotionPrompt ||
        scene.continuityNotes !== existing.continuityNotes ||
        scene.continuityMode !== existing.continuityMode
      );
    });
    const narrationChanged = (body.scenes ?? []).some((scene) => {
      const existing = existingSceneById.get(scene.id)!;
      return scene.voiceoverText !== existing.voiceoverText;
    });
    const renderChanged = sceneOutputChanged || continuityChanged;

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
      ...storyboard.scenes.map((existing) => {
        const scene = patchBySceneId.get(existing.id);
        const stale = invalidation.get(existing.id)!;
        return prisma.scene.update({
          where: { id: existing.id },
          data: {
            durationSec: scene?.durationSec,
            captionText: scene?.captionText,
            voiceoverText: scene?.voiceoverText,
            anchorFramePrompt: scene?.anchorFramePrompt,
            transitionOutPrompt: scene?.transitionOutPrompt,
            videoMotionPrompt: scene?.videoMotionPrompt,
            continuityNotes: scene?.continuityNotes,
            continuityMode: scene?.continuityMode,
            selectedKeyframeTakeId: stale.anchor ? null : undefined,
            selectedVideoTakeId: stale.video ? null : undefined,
            status:
              existing.status === "DRAFT" || stale.video
                ? "APPROVED"
                : undefined,
          },
        });
      }),
      ...storyboard.scenes
        .filter((scene) => {
          const stale = invalidation.get(scene.id)!;
          return stale.anchor || stale.video;
        })
        .map((scene) => {
          const stale = invalidation.get(scene.id)!;
          return prisma.take.updateMany({
            where: {
              sceneId: scene.id,
              ...(stale.anchor
                ? { kind: { in: ["KEYFRAME_START", "VIDEO"] as const } }
                : { kind: "VIDEO" as const }),
            },
            data: { selected: false },
          });
        }),
      ...(narrationChanged
        ? [
            prisma.generationJob.updateMany({
              where: {
                projectId: storyboard.projectId,
                type: "TTS",
                status: "COMPLETE",
              },
              data: {
                status: "CANCELLED",
                error: "Storyboard narration changed; regenerate narration.",
              },
            }),
          ]
        : []),
      ...(renderChanged
        ? [
            prisma.generationJob.updateMany({
              where: {
                projectId: storyboard.projectId,
                type: "RENDER",
                status: "COMPLETE",
              },
              data: {
                status: "CANCELLED",
                error: "Storyboard changed; create a fresh final export.",
              },
            }),
            prisma.render.updateMany({
              where: {
                projectId: storyboard.projectId,
                status: "COMPLETE",
              },
              data: { status: "FAILED" },
            }),
          ]
        : []),
    ]);

    const updated = await prisma.storyboard.findUniqueOrThrow({
      where: { id: storyboardId },
      include: { scenes: { orderBy: { index: "asc" } } },
    });

    return ok({ storyboard: updated });
  });
}
