import { describe, expect, it } from "vitest";

import {
  defaultSceneCountForDuration,
  isStoryboardTimingValid,
  normalizeShowcaseDurations,
  normalizeShowcaseSceneCount,
  productShowcaseSceneRange,
  requestedSceneCountFromText,
  resolveSceneCountPreference,
  storyboardTimingIssue,
} from "@/lib/storyboards/timing";

describe("storyboard timing", () => {
  it("validates standard and Product Showcase contracts independently", () => {
    expect(
      isStoryboardTimingValid({
        outputMode: "STANDARD",
        targetDurationSec: 30,
        durations: [8, 8],
      }),
    ).toBe(true);
    expect(
      isStoryboardTimingValid({
        outputMode: "PRODUCT_SHOWCASE",
        targetDurationSec: 5,
        durations: [5],
      }),
    ).toBe(true);
    expect(
      storyboardTimingIssue({
        outputMode: "PRODUCT_SHOWCASE",
        targetDurationSec: 5,
        durations: [5, 5],
      }),
    ).toContain("exactly one scene and one video clip");
  });

  it("chooses only scene counts that can satisfy 5-10 seconds per scene", () => {
    expect(productShowcaseSceneRange(3)).toEqual({ min: 1, max: 1 });
    expect(productShowcaseSceneRange(5)).toEqual({ min: 1, max: 1 });
    expect(productShowcaseSceneRange(10)).toEqual({ min: 1, max: 2 });
    expect(productShowcaseSceneRange(15)).toEqual({ min: 2, max: 3 });
    expect(normalizeShowcaseSceneCount(3, 5)).toBe(1);
    expect(normalizeShowcaseSceneCount(3, 10)).toBe(2);
    expect(normalizeShowcaseSceneCount(1, 15)).toBe(2);
  });

  it("uses duration-aware defaults and honors explicit supported overrides", () => {
    expect(defaultSceneCountForDuration(5)).toBe(1);
    expect(defaultSceneCountForDuration(3)).toBe(1);
    expect(defaultSceneCountForDuration(10)).toBe(2);
    expect(defaultSceneCountForDuration(15)).toBe(3);
    expect(defaultSceneCountForDuration(30)).toBeNull();

    expect(requestedSceneCountFromText(["Make this exactly one shot."])).toBe(
      1,
    );
    expect(
      requestedSceneCountFromText(["A 10 second premium reel."]),
    ).toBeNull();
    expect(requestedSceneCountFromText(["Use 3+ scenes."])).toBe(3);

    expect(
      resolveSceneCountPreference({
        outputMode: "PRODUCT_SHOWCASE",
        targetDurationSec: 10,
      }),
    ).toBe(2);
    expect(
      resolveSceneCountPreference({
        outputMode: "PRODUCT_SHOWCASE",
        targetDurationSec: 10,
        instructions: ["Keep it to one continuous scene"],
      }),
    ).toBe(1);
    expect(
      resolveSceneCountPreference({
        outputMode: "PRODUCT_SHOWCASE",
        targetDurationSec: 15,
        instructions: ["Use two shots"],
      }),
    ).toBe(2);
  });

  it("explains that a five-second showcase is exactly one video clip", () => {
    expect(
      storyboardTimingIssue({
        outputMode: "PRODUCT_SHOWCASE",
        targetDurationSec: 5,
        durations: [5, 5],
      }),
    ).toBe(
      "A 5-second Product Showcase must use exactly one scene and one video clip.",
    );
  });

  it("keeps Razzmatazz to one exact 3-second scene", () => {
    expect(
      storyboardTimingIssue({
        outputMode: "PRODUCT_SHOWCASE",
        targetDurationSec: 3,
        durations: [3],
      }),
    ).toBeNull();
    expect(
      storyboardTimingIssue({
        outputMode: "PRODUCT_SHOWCASE",
        targetDurationSec: 3,
        durations: [5],
      }),
    ).toContain("exactly 3 seconds");
    expect(normalizeShowcaseDurations([5], 3)).toEqual([3]);
  });

  it("normalizes provider timing to the exact showcase target", () => {
    expect(normalizeShowcaseDurations([8, 8], 5)).toEqual([5]);
    expect(normalizeShowcaseDurations([8, 8, 8], 10)).toEqual([5, 5]);
    const expanded = normalizeShowcaseDurations([6], 15);
    expect(expanded).toHaveLength(2);
    expect(expanded.reduce((sum, duration) => sum + duration, 0)).toBe(15);
    expect(expanded.every((duration) => duration >= 5 && duration <= 10)).toBe(
      true,
    );
    expect(normalizeShowcaseDurations([8, 8, 8], 15)).toEqual([5, 5, 5]);
  });
});
