export type StoryboardOutputMode = "STANDARD" | "PRODUCT_SHOWCASE";

export function storyboardSceneRange(outputMode: StoryboardOutputMode) {
  return outputMode === "PRODUCT_SHOWCASE"
    ? { min: 1, max: 3 }
    : { min: 2, max: 4 };
}

export function productShowcaseSceneRange(targetDurationSec: number) {
  const target = clamp(Math.round(targetDurationSec), 5, 15);
  return {
    min: Math.max(1, Math.ceil(target / 10)),
    max: Math.min(3, Math.floor(target / 5)),
  };
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
  const range =
    outputMode === "PRODUCT_SHOWCASE"
      ? productShowcaseSceneRange(targetDurationSec)
      : storyboardSceneRange(outputMode);
  if (durations.length < range.min || durations.length > range.max) {
    if (outputMode === "PRODUCT_SHOWCASE") {
      return targetDurationSec === 5
        ? "A 5-second Product Showcase must use exactly one scene and one video clip."
        : `A ${targetDurationSec}-second Product Showcase needs ${range.min} to ${range.max} scenes.`;
    }
    return "A standard reel needs 2 to 4 scenes.";
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
  const { min, max } = productShowcaseSceneRange(target);
  return clamp(Math.round(requestedCount), min, max);
}

/**
 * Returns Reel AI's editorial default for the short formats where scene count
 * materially changes the shape of the concept. Longer standard reels keep the
 * existing flexible 2-4 scene contract.
 */
export function defaultSceneCountForDuration(targetDurationSec: number) {
  const target = Math.round(targetDurationSec);
  if (target === 5) return 1;
  if (target === 10) return 2;
  if (target === 15) return 3;
  return null;
}

/**
 * Reads only explicit scene/shot/clip requests. Bare numbers and duration
 * phrases are intentionally ignored so "10 seconds" cannot become 10 scenes.
 */
export function requestedSceneCountFromText(
  values: Array<string | null | undefined>,
) {
  const text = values.filter(Boolean).join("\n").toLowerCase();
  if (!text.trim()) return null;

  const wordNumber =
    "(?:one|two|three|four|five|six|seven|eight|nine|ten|single)";
  const numeric = "(?:[1-9]|10)";
  const match = text.match(
    new RegExp(
      `(?:exactly\\s+|at\\s+least\\s+|minimum\\s+of\\s+|use\\s+|with\\s+|want\\s+)?(${numeric}|${wordNumber})(?:\\s*\\+)?\\s+(?:(?:continuous|video|distinct|separate)\\s+)?(?:scene|shot|clip)s?\\b`,
      "i",
    ),
  );
  if (!match?.[1]) return null;

  const numbers: Record<string, number> = {
    single: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  return numbers[match[1]] ?? Number(match[1]);
}

export function resolveSceneCountPreference({
  outputMode,
  targetDurationSec,
  instructions = [],
}: {
  outputMode: StoryboardOutputMode;
  targetDurationSec: number;
  instructions?: Array<string | null | undefined>;
}) {
  const requested = requestedSceneCountFromText(instructions);
  const defaultCount = defaultSceneCountForDuration(targetDurationSec);
  const range =
    outputMode === "PRODUCT_SHOWCASE"
      ? productShowcaseSceneRange(targetDurationSec)
      : storyboardSceneRange(outputMode);
  const preferred = requested ?? defaultCount;

  return preferred === null
    ? null
    : Math.min(range.max, Math.max(range.min, preferred));
}

export function normalizeShowcaseDurations(
  durations: number[],
  targetDurationSec: number,
  preferredSceneCount?: number | null,
) {
  const target = clamp(Math.round(targetDurationSec), 5, 15);
  const count = normalizeShowcaseSceneCount(
    preferredSceneCount ?? (durations.length || 1),
    target,
  );
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
