import { describe, expect, it } from "vitest";

import { buildVideoSubmissionBody } from "./video-request";

describe("buildVideoSubmissionBody", () => {
  it("locks Wan 2.7 generation to the approved first and last frames", () => {
    expect(
      buildVideoSubmissionBody({
        model: "wan2.7-i2v",
        prompt: "A smooth product reveal",
        imageUrl: "https://example.test/open.png",
        lastFrameUrl: "https://example.test/close.png",
        durationSec: 8,
      }),
    ).toEqual({
      model: "wan2.7-i2v",
      input: {
        prompt: "A smooth product reveal",
        media: [
          { type: "first_frame", url: "https://example.test/open.png" },
          { type: "last_frame", url: "https://example.test/close.png" },
        ],
      },
      parameters: {
        duration: 8,
        resolution: "720P",
        prompt_extend: false,
        watermark: false,
      },
    });
  });

  it("keeps the legacy single-frame request shape for older model overrides", () => {
    expect(
      buildVideoSubmissionBody({
        model: "wan2.6-i2v-flash",
        prompt: "A smooth product reveal",
        imageUrl: "https://example.test/open.png",
        lastFrameUrl: "https://example.test/close.png",
        durationSec: 99,
      }),
    ).toMatchObject({
      input: { img_url: "https://example.test/open.png" },
      parameters: { duration: 15, audio: false },
    });
  });
});
