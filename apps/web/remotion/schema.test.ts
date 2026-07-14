import { describe, expect, it } from "vitest";

import {
  getBrandWatermarkWindow,
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
});
