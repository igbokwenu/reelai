export type StoryboardOutputMode = "STANDARD" | "PRODUCT_SHOWCASE";

export function storyboardSceneRange(outputMode: StoryboardOutputMode) {
  return outputMode === "PRODUCT_SHOWCASE"
    ? { min: 1, max: 3 }
    : { min: 2, max: 4 };
}

export function storyboardTimingIssue({
  outputMode,
  targetDurationSec,
  durations,
}: {
  outputMode: StoryboardOutputMode;
  targetDurationSec: number;
  durations: number[];
}) {
  const range = storyboardSceneRange(outputMode);
  if (durations.length < range.min || durations.length > range.max) {
    return outputMode === "PRODUCT_SHOWCASE"
      ? "Product Showcase needs 1 to 3 scenes."
      : "A standard reel needs 2 to 4 scenes.";
  }

  if (durations.some((duration) => duration < 5 || duration > 10)) {
    return "Every scene must last 5 to 10 seconds.";
  }

  const total = durations.reduce((sum, duration) => sum + duration, 0);
  if (outputMode === "PRODUCT_SHOWCASE") {
    return total === targetDurationSec
      ? null
      : `Product Showcase must total exactly ${targetDurationSec} seconds; it currently totals ${total} seconds.`;
  }

  return total >= 15 && total <= 30
    ? null
    : `A standard reel must total 15 to 30 seconds; it currently totals ${total} seconds.`;
}

export function isStoryboardTimingValid(input: {
  outputMode: StoryboardOutputMode;
  targetDurationSec: number;
  durations: number[];
}) {
  return storyboardTimingIssue(input) === null;
}

export function normalizeShowcaseSceneCount(
  requestedCount: number,
  targetDurationSec: number,
) {
  const target = clamp(Math.round(targetDurationSec), 5, 15);
  const min = Math.max(1, Math.ceil(target / 10));
  const max = Math.min(3, Math.floor(target / 5));
  return clamp(Math.round(requestedCount), min, max);
}

export function normalizeShowcaseDurations(
  durations: number[],
  targetDurationSec: number,
) {
  const target = clamp(Math.round(targetDurationSec), 5, 15);
  const count = normalizeShowcaseSceneCount(durations.length || 1, target);
  const normalized = Array.from({ length: count }, (_, index) =>
    clamp(Math.round(durations[index] ?? target / count), 5, 10),
  );

  let difference = target - normalized.reduce((sum, value) => sum + value, 0);
  while (difference !== 0) {
    let changed = false;
    for (let index = normalized.length - 1; index >= 0; index -= 1) {
      if (difference > 0 && normalized[index]! < 10) {
        normalized[index] += 1;
        difference -= 1;
        changed = true;
      } else if (difference < 0 && normalized[index]! > 5) {
        normalized[index] -= 1;
        difference += 1;
        changed = true;
      }
      if (difference === 0) break;
    }
    if (!changed) break;
  }

  return normalized;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
