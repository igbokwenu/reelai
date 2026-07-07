export type ReelCompositionInput = {
  scenes: Array<{
    videoUrl: string;
    captionText: string;
    startTimeSec: number;
    durationSec: number;
  }>;
  narrationUrl?: string;
  bgmUrl?: string;
  brandWatermark?: { text?: string; logoUrl?: string };
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
