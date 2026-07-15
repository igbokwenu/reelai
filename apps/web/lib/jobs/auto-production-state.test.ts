import { describe, expect, it } from "vitest";

import {
  autoProgress,
  isAutoRunActive,
  isRetryableAutoFailure,
  nextAutoPhase,
  presentAutoFailure,
  retryDelayMs,
} from "@/lib/jobs/auto-production-state";

describe("auto production state", () => {
  it("moves through the complete production pipeline", () => {
    expect(nextAutoPhase("STORYBOARD")).toBe("KEYFRAMES");
    expect(nextAutoPhase("KEYFRAMES")).toBe("CLIPS");
    expect(nextAutoPhase("CLIPS")).toBe("NARRATION");
    expect(nextAutoPhase("NARRATION")).toBe("RENDER");
    expect(nextAutoPhase("RENDER")).toBe("COMPLETE");
  });

  it("uses bounded exponential retry delays", () => {
    expect(retryDelayMs(1)).toBe(3_000);
    expect(retryDelayMs(2)).toBe(6_000);
    expect(retryDelayMs(3)).toBe(12_000);
    expect(retryDelayMs(20)).toBe(30_000);
  });

  it("reports progress and active states consistently", () => {
    expect(autoProgress("STORYBOARD", "RUNNING")).toBe(0);
    expect(autoProgress("NARRATION", "RUNNING")).toBe(60);
    expect(autoProgress("COMPLETE", "COMPLETE")).toBe(100);
    expect(isAutoRunActive("WAITING_RETRY")).toBe(true);
    expect(isAutoRunActive("FAILED")).toBe(false);
  });

  it("retries transient failures but does not repeat deterministic creative validation", () => {
    expect(
      isRetryableAutoFailure("Video provider returned a temporary 503."),
    ).toBe(true);
    expect(
      isRetryableAutoFailure(
        "Creative output schema mismatch: script is too short.",
      ),
    ).toBe(false);
    expect(
      isRetryableAutoFailure(
        "Reel AI could not complete the plan after automatic repair.",
      ),
    ).toBe(false);
  });

  it("hides legacy schema internals from persisted failed Auto runs", () => {
    expect(
      presentAutoFailure(
        "Storyboard paused: Creative output schema mismatch: bgm.preset Too small: expected string to have >=2 characters.",
      ),
    ).toBe(
      "Reel AI couldn't complete the creative plan after automatic repair. Your concept and brand assets are safe; retry this phase to continue.",
    );
    expect(presentAutoFailure("Video provider returned a temporary 503.")).toBe(
      "Video provider returned a temporary 503.",
    );
  });
});
