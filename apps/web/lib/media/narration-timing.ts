export const NARRATION_LEAD_IN_SEC = 0.16;
export const NARRATION_TAIL_ROOM_SEC = 0.22;
export const MAX_NARRATION_PLAYBACK_RATE = 1.2;

export type SceneNarrationTiming = {
  offsetSec: number;
  playbackRate: number;
  sourceDurationSec: number;
  audibleDurationSec: number;
};

export function fitNarrationToScene({
  sceneDurationSec,
  sourceDurationSec,
}: {
  sceneDurationSec: number;
  sourceDurationSec: number;
}): SceneNarrationTiming {
  const availableSec =
    sceneDurationSec - NARRATION_LEAD_IN_SEC - NARRATION_TAIL_ROOM_SEC;

  if (availableSec <= 0 || sourceDurationSec <= 0) {
    throw new Error(
      "Scene narration needs positive audio and scene durations.",
    );
  }

  const requiredRate = sourceDurationSec / availableSec;
  if (requiredRate > MAX_NARRATION_PLAYBACK_RATE) {
    throw new Error(
      `Narration is ${sourceDurationSec.toFixed(1)}s but only ${availableSec.toFixed(1)}s is available at a natural pace.`,
    );
  }

  const playbackRate = Math.max(1, requiredRate);
  return {
    offsetSec: NARRATION_LEAD_IN_SEC,
    playbackRate: Number(playbackRate.toFixed(4)),
    sourceDurationSec: Number(sourceDurationSec.toFixed(4)),
    audibleDurationSec: Number((sourceDurationSec / playbackRate).toFixed(4)),
  };
}
