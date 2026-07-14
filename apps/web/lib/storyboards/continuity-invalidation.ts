type ContinuityMode = "CONTINUOUS" | "MATCH_CUT" | "INTENTIONAL_CHANGE";

export type ContinuityScene = {
  id: string;
  index: number;
  durationSec: number;
  shotPrompt: string;
  continuityNotes: string;
  continuityMode: ContinuityMode;
};

export type ContinuityScenePatch = Omit<ContinuityScene, "index">;

export type SceneInvalidation = {
  anchor: boolean;
  video: boolean;
};

/**
 * Scene anchors form an ordered dependency chain. The one shot sentence drives
 * both the anchor and clip, so changing it invalidates that scene and every
 * downstream anchor built from the visual handoff.
 */
export function planContinuityInvalidation(
  existingScenes: ContinuityScene[],
  patches: ContinuityScenePatch[],
  continuityBibleChanged: boolean,
) {
  const result = new Map<string, SceneInvalidation>(
    existingScenes.map((scene) => [
      scene.id,
      { anchor: continuityBibleChanged, video: continuityBibleChanged },
    ]),
  );
  const existingById = new Map(
    existingScenes.map((scene) => [scene.id, scene]),
  );

  const invalidateAnchorsFrom = (index: number) => {
    for (const scene of existingScenes) {
      if (scene.index < index) continue;
      result.set(scene.id, { anchor: true, video: true });
    }
  };

  const invalidateVideo = (sceneId: string) => {
    const current = result.get(sceneId) ?? { anchor: false, video: false };
    result.set(sceneId, { ...current, video: true });
  };

  for (const patch of patches) {
    const existing = existingById.get(patch.id);
    if (!existing) continue;

    const shotChanged =
      patch.shotPrompt !== existing.shotPrompt ||
      patch.continuityNotes !== existing.continuityNotes ||
      patch.continuityMode !== existing.continuityMode;

    if (shotChanged) invalidateAnchorsFrom(existing.index);
    if (patch.durationSec !== existing.durationSec) {
      invalidateVideo(existing.id);
    }
  }

  return result;
}
