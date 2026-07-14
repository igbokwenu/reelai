export type ReelCompositionInput = {
  scenes: Array<{
    videoUrl: string;
    captionText: string;
    startTimeSec: number;
    durationSec: number;
    narration?: {
      audioUrl: string;
      offsetSec: number;
      playbackRate: number;
      sourceDurationSec: number;
    };
  }>;
  narrationUrl?: string;
  bgmUrl?: string;
  brandWatermark?: {
    text?: string;
    logoUrl?: string;
    showOn?: "FIRST" | "LAST" | "ALL";
  };
  aiDisclosureEnabled: boolean;
  safeZonePreset: "TIKTOK_REELS" | "YOUTUBE_SHORTS" | "NONE";
};

export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;
export const REEL_FPS = 30;
export const NARRATION_MIX_VOLUME = 0.96;
export const BGM_BASE_VOLUME = 0.18;
export const BGM_DUCKED_VOLUME = 0.065;

export function getReelDurationFrames(input: ReelCompositionInput) {
  const durationSec = input.scenes.reduce(
    (total, scene) => total + scene.durationSec,
    0,
  );

  return Math.max(REEL_FPS, Math.ceil(durationSec * REEL_FPS));
}

export function getBrandWatermarkWindow(
  input: ReelCompositionInput,
  fps = REEL_FPS,
) {
  if (!input.brandWatermark || input.scenes.length === 0) return null;

  const showOn = input.brandWatermark.showOn ?? "ALL";
  if (showOn === "ALL") {
    return {
      from: 0,
      durationInFrames: Math.max(
        fps,
        Math.ceil(
          input.scenes.reduce((total, scene) => total + scene.durationSec, 0) *
            fps,
        ),
      ),
    };
  }

  const scene = showOn === "FIRST" ? input.scenes[0] : input.scenes.at(-1);
  if (!scene) return null;

  return {
    from: Math.round(scene.startTimeSec * fps),
    durationInFrames: Math.max(1, Math.round(scene.durationSec * fps)),
  };
}

export function getSceneNarrationWindow(
  scene: ReelCompositionInput["scenes"][number],
  fps = REEL_FPS,
) {
  if (!scene.narration) return null;

  const from = Math.round(
    (scene.startTimeSec + scene.narration.offsetSec) * fps,
  );
  const sceneEnd = Math.round((scene.startTimeSec + scene.durationSec) * fps);
  const requestedFrames = Math.max(
    1,
    Math.ceil(
      (scene.narration.sourceDurationSec / scene.narration.playbackRate) * fps,
    ),
  );

  return {
    from,
    durationInFrames: Math.max(1, Math.min(requestedFrames, sceneEnd - from)),
  };
}

export function getBgmVolume(
  input: ReelCompositionInput,
  frame: number,
  fps = REEL_FPS,
) {
  const fadeFrames = Math.max(1, Math.round(fps * 0.12));
  let duckAmount = 0;

  for (const scene of input.scenes) {
    const window = getSceneNarrationWindow(scene, fps);
    if (!window) continue;

    const end = window.from + window.durationInFrames;
    const fadeIn = clamp01((frame - (window.from - fadeFrames)) / fadeFrames);
    const fadeOut = clamp01((end + fadeFrames - frame) / fadeFrames);
    duckAmount = Math.max(duckAmount, Math.min(fadeIn, fadeOut));
  }

  return BGM_BASE_VOLUME - (BGM_BASE_VOLUME - BGM_DUCKED_VOLUME) * duckAmount;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
