import { describe, expect, it } from "vitest";

import {
  planContinuityInvalidation,
  type ContinuityScene,
} from "./continuity-invalidation";

const scenes: ContinuityScene[] = [1, 2, 3].map((index) => ({
  id: `scene-${index}`,
  index,
  durationSec: 6,
  shotPrompt: `Urgent focus: the founder lifts one bottle as the camera slowly pushes in`,
  continuityNotes: `Continuity details for scene ${index}`,
  continuityMode: "CONTINUOUS",
}));

describe("planContinuityInvalidation", () => {
  it("cascades a shot-direction change through downstream scenes", () => {
    const patch = {
      ...scenes[1]!,
      shotPrompt:
        "Quiet confidence: the founder sets down one bottle as the camera remains fixed",
    };
    const result = planContinuityInvalidation(scenes, [patch], false);

    expect(result.get("scene-1")).toEqual({ anchor: false, video: false });
    expect(result.get("scene-2")).toEqual({ anchor: true, video: true });
    expect(result.get("scene-3")).toEqual({ anchor: true, video: true });
  });

  it("keeps anchors when only timing changes", () => {
    const patch = { ...scenes[1]!, durationSec: 8 };
    const result = planContinuityInvalidation(scenes, [patch], false);

    expect(result.get("scene-2")).toEqual({ anchor: false, video: true });
    expect(result.get("scene-3")).toEqual({ anchor: false, video: false });
  });

  it("invalidates the full chain when the continuity bible changes", () => {
    const result = planContinuityInvalidation(scenes, [], true);
    expect([...result.values()]).toEqual([
      { anchor: true, video: true },
      { anchor: true, video: true },
      { anchor: true, video: true },
    ]);
  });
});
