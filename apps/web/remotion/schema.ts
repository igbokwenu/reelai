export type ReelCompositionInput = {
  scenes: Array<{
    videoUrl: string;
    captionText: string;
    startTimeSec: number;
    durationSec: number;
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
          input.scenes.reduce(
            (total, scene) => total + scene.durationSec,
            0,
          ) * fps,
        ),
      ),
    };
  }

  const scene =
    showOn === "FIRST" ? input.scenes[0] : input.scenes.at(-1);
  if (!scene) return null;

  return {
    from: Math.round(scene.startTimeSec * fps),
    durationInFrames: Math.max(1, Math.round(scene.durationSec * fps)),
  };
}
