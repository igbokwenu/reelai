import { PublicError } from "@/lib/errors";
import { handleRoute, notFound, ok } from "@/lib/http/responses";
import { assertManualControlAvailable } from "@/lib/jobs/manual-control";
import { prisma } from "@/lib/prisma";
import { findShowcaseShotViolations } from "@/lib/product-showcase/guardrails";
import { shotPromptSchema, storyboardPatchSchema } from "@/lib/schemas/agent";
import { planContinuityInvalidation } from "@/lib/storyboards/continuity-invalidation";
import { storyboardTimingIssue } from "@/lib/storyboards/timing";

type RouteContext = {
  params: Promise<{ storyboardId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const { storyboardId } = await context.params;
    const body = storyboardPatchSchema.parse(await request.json());
    const storyboard = await prisma.storyboard.findUnique({
      where: { id: storyboardId },
      include: {
        scenes: true,
        project: {
          select: {
            outputMode: true,
            videoLengthSec: true,
            products: { select: { name: true, details: true } },
          },
        },
      },
    });

    if (!storyboard) {
      return notFound("Storyboard not found");
    }
    await assertManualControlAvailable(storyboard.projectId);

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
    const proposedSceneById = new Map(
      (body.scenes ?? []).map((scene) => [scene.id, scene]),
    );
    const timingIssue = storyboardTimingIssue({
      outputMode: storyboard.project.outputMode,
      targetDurationSec: storyboard.project.videoLengthSec,
      durations: storyboard.scenes.map(
        (scene) =>
          proposedSceneById.get(scene.id)?.durationSec ?? scene.durationSec,
      ),
    });
    if (timingIssue) {
      throw new PublicError(timingIssue, 409);
    }
    if (storyboard.project.outputMode === "PRODUCT_SHOWCASE") {
      const motionViolations = findShowcaseShotViolations(
        storyboard.scenes.map((scene) => {
          const proposed = proposedSceneById.get(scene.id);
          return {
            index: scene.index,
            shotPrompt: proposed?.shotPrompt ?? scene.shotPrompt,
            continuityNotes: proposed?.continuityNotes ?? scene.continuityNotes,
          };
        }),
        body.characterContinuity ?? storyboard.characterContinuity,
        storyboard.project.products,
      );
      if (motionViolations.length > 0) {
        throw new PublicError(
          `Product Showcase motion needs revision: ${motionViolations.slice(0, 3).join(" ")}`,
          409,
        );
      }
    }
    for (const scene of body.scenes ?? []) {
      const existing = existingSceneById.get(scene.id)!;
      if (scene.shotPrompt !== existing.shotPrompt) {
        shotPromptSchema.parse(scene.shotPrompt);
      }
      const wordCount = scene.voiceoverText
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
      const wordBudget = Math.floor(scene.durationSec * 2.5);
      if (wordCount > wordBudget) {
        throw new PublicError(
          `Scene ${existing.index} voiceover has ${wordCount} words. Shorten it to ${wordBudget} words for a natural ${scene.durationSec}-second read.`,
          409,
        );
      }
    }
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
        scene.shotPrompt !== existing.shotPrompt ||
        scene.continuityNotes !== existing.continuityNotes ||
        scene.continuityMode !== existing.continuityMode ||
        (scene.transitionStyle !== undefined &&
          scene.transitionStyle !== existing.transitionStyle)
      );
    });
    const narrationChanged = (body.scenes ?? []).some((scene) => {
      const existing = existingSceneById.get(scene.id)!;
      return (
        scene.voiceoverText !== existing.voiceoverText ||
        scene.durationSec !== existing.durationSec
      );
    });
    const renderChanged = sceneOutputChanged || continuityChanged;

    await prisma.$transaction([
      prisma.storyboard.update({
        where: { id: storyboardId },
        data: {
          title: body.title,
          script: body.script,
          bgmEnabled:
            storyboard.project.outputMode === "PRODUCT_SHOWCASE"
              ? false
              : body.bgmEnabled,
          bgmPrompt: body.bgmPrompt,
          bgmTrackId:
            storyboard.project.outputMode === "PRODUCT_SHOWCASE"
              ? null
              : body.bgmTrackId,
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
            shotPrompt: scene?.shotPrompt,
            continuityNotes: scene?.continuityNotes,
            continuityMode: scene?.continuityMode,
            transitionStyle: scene?.transitionStyle,
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
            prisma.scene.updateMany({
              where: { storyboardId },
              data: { narrationArtifactId: null },
            }),
            prisma.generationJob.updateMany({
              where: {
                projectId: storyboard.projectId,
                type: "TTS",
                status: "COMPLETE",
              },
              data: {
                status: "CANCELLED",
                error:
                  "Storyboard narration or timing changed; regenerate scene narration.",
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
