import { describe, expect, it } from "vitest";

import {
  BGM_BASE_VOLUME,
  BGM_DUCKED_VOLUME,
  getBgmVolume,
  getBrandWatermarkWindow,
  getFinalCaptionWindow,
  getReelDurationFrames,
  getSceneNarrationWindow,
  getTransitionDurationFrames,
  type ReelCompositionInput,
} from "./schema";

const baseInput: ReelCompositionInput = {
  aiDisclosureEnabled: true,
  safeZonePreset: "TIKTOK_REELS",
  brandWatermark: {
    logoUrl: "https://assets.example/logo.png",
    showOn: "LAST",
  },
  scenes: [
    {
      captionText: "Problem",
      durationSec: 6,
      startTimeSec: 0,
      videoUrl: "https://assets.example/one.mp4",
    },
    {
      captionText: "Resolution",
      durationSec: 8,
      startTimeSec: 6,
      videoUrl: "https://assets.example/two.mp4",
    },
  ],
};

describe("brand watermark timing", () => {
  it("places the exact logo lockup over the last scene", () => {
    expect(getBrandWatermarkWindow(baseInput, 30)).toEqual({
      from: 180,
      durationInFrames: 240,
    });
  });

  it("preserves all-video placement for legacy render inputs", () => {
    expect(
      getBrandWatermarkWindow(
        {
          ...baseInput,
          brandWatermark: { text: "Example" },
        },
        30,
      ),
    ).toEqual({ from: 0, durationInFrames: 420 });
  });

  it("treats a five-second Product Showcase as one clip with the logo throughout", () => {
    const fiveSecondInput: ReelCompositionInput = {
      ...baseInput,
      scenes: [
        {
          captionText: "Taste the signature finish",
          durationSec: 5,
          startTimeSec: 0,
          transitionStyle: "CUT",
          videoUrl: "https://assets.example/hero.mp4",
        },
      ],
    };

    expect(getReelDurationFrames(fiveSecondInput)).toBe(150);
    expect(getBrandWatermarkWindow(fiveSecondInput, 30)).toEqual({
      from: 0,
      durationInFrames: 150,
    });
  });
});

describe("final closer timing", () => {
  it("keeps the first half of the final scene free of closure text", () => {
    expect(getFinalCaptionWindow(baseInput.scenes[1], 30)).toEqual({
      from: 120,
      durationInFrames: 120,
    });
  });

  it("uses the same second-half reveal for a single five-second showcase", () => {
    expect(
      getFinalCaptionWindow(
        {
          captionText: "Taste the signature finish",
          durationSec: 5,
          startTimeSec: 0,
          transitionStyle: "CUT",
          videoUrl: "https://assets.example/hero.mp4",
        },
        30,
      ),
    ).toEqual({ from: 75, durationInFrames: 75 });
  });
});

describe("scene narration timing", () => {
  const input: ReelCompositionInput = {
    ...baseInput,
    bgmUrl: "https://assets.example/music.wav",
    scenes: [
      {
        ...baseInput.scenes[0],
        narration: {
          audioUrl: "https://assets.example/scene-1.wav",
          offsetSec: 0.16,
          playbackRate: 1,
          sourceDurationSec: 4,
        },
      },
      baseInput.scenes[1],
    ],
  };

  it("locks the audio window to its owning scene", () => {
    expect(getSceneNarrationWindow(input.scenes[0], 30)).toEqual({
      from: 5,
      durationInFrames: 120,
    });
  });

  it("ducks BGM only while narration is active", () => {
    expect(getBgmVolume(input, 60, 30)).toBe(BGM_DUCKED_VOLUME);
    expect(getBgmVolume(input, 170, 30)).toBe(BGM_BASE_VOLUME);
  });

  it("fades the music bed at both reel edges", () => {
    expect(getBgmVolume(input, 0, 30)).toBe(0);
    expect(getBgmVolume(input, getReelDurationFrames(input) - 1, 30)).toBe(0);
  });
});

describe("scene transition timing", () => {
  it("uses short editorial transitions and keeps clean cuts at zero frames", () => {
    expect(
      getTransitionDurationFrames(
        { ...baseInput.scenes[1], transitionStyle: "IRIS" },
        30,
      ),
    ).toBe(14);
    expect(getTransitionDurationFrames(baseInput.scenes[1], 30)).toBe(0);
  });
});
