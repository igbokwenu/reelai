import { describe, expect, it } from "vitest";

import { isRetryableVideoSubmissionError } from "./video-retry";
import { buildVideoSubmissionBody } from "./video-request";

describe("buildVideoSubmissionBody", () => {
  it("uses one approved scene anchor without a forced closing frame", () => {
    expect(
      buildVideoSubmissionBody({
        model: "wan2.7-i2v",
        prompt:
          "Quiet confidence: one bottle rotates as the camera slowly pushes in.",
        negativePrompt: "morphing, warping, flicker, text, watermark",
        imageUrl: "https://example.test/open.png",
        resolution: "1080P",
        durationSec: 8,
      }),
    ).toEqual({
      model: "wan2.7-i2v",
      input: {
        prompt:
          "Quiet confidence: one bottle rotates as the camera slowly pushes in.",
        negative_prompt: "morphing, warping, flicker, text, watermark",
        media: [{ type: "first_frame", url: "https://example.test/open.png" }],
      },
      parameters: {
        duration: 8,
        resolution: "1080P",
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
        durationSec: 99,
      }),
    ).toMatchObject({
      input: { img_url: "https://example.test/open.png" },
      parameters: { duration: 10, prompt_extend: false, audio: false },
    });
  });

  it("uses a provider-compatible 5-second source for a 3-second mini edit", () => {
    const request = buildVideoSubmissionBody({
      model: "wan2.7-i2v",
      prompt:
        "Electric focus: the intact bottle turns while a fixed camera holds.",
      imageUrl: "https://example.test/open.png",
      durationSec: 3,
    });

    expect(request.parameters.duration).toBe(5);
  });
});

describe("video submission retry policy", () => {
  it("retries transient network, rate-limit, and provider availability errors", () => {
    expect(isRetryableVideoSubmissionError(new TypeError("fetch failed"))).toBe(
      true,
    );
    expect(
      isRetryableVideoSubmissionError(
        new Error("QwenCloud video rate limit or quota was reached."),
      ),
    ).toBe(true);
    expect(
      isRetryableVideoSubmissionError(
        new Error("QwenCloud video generation is temporarily unavailable."),
      ),
    ).toBe(true);
  });

  it("does not retry authentication or invalid-media errors", () => {
    expect(
      isRetryableVideoSubmissionError(
        new Error("QwenCloud authentication failed."),
      ),
    ).toBe(false);
    expect(
      isRetryableVideoSubmissionError(
        new Error("QwenCloud rejected the video request."),
      ),
    ).toBe(false);
  });
});
