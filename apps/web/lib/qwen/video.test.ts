import { describe, expect, it } from "vitest";

import { isRetryableVideoSubmissionError } from "./video-retry";
import { buildVideoSubmissionBody } from "./video-request";

describe("buildVideoSubmissionBody", () => {
  it("uses one approved scene anchor without a forced closing frame", () => {
    expect(
      buildVideoSubmissionBody({
        model: "wan2.7-i2v",
        prompt: "A smooth product reveal",
        imageUrl: "https://example.test/open.png",
        durationSec: 8,
      }),
    ).toEqual({
      model: "wan2.7-i2v",
      input: {
        prompt: "A smooth product reveal",
        media: [{ type: "first_frame", url: "https://example.test/open.png" }],
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
