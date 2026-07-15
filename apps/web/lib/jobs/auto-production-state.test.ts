import { describe, expect, it } from "vitest";

import {
  autoProgress,
  isAutoRunActive,
  nextAutoPhase,
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
});
