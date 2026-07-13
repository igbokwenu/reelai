import { describe, expect, it } from "vitest";

import {
  planContinuityInvalidation,
  type ContinuityScene,
} from "./continuity-invalidation";

const scenes: ContinuityScene[] = [1, 2, 3].map((index) => ({
  id: `scene-${index}`,
  index,
  durationSec: 6,
  anchorFramePrompt: `Anchor frame prompt for scene ${index}`,
  transitionOutPrompt: `Natural transition out for scene ${index}`,
  videoMotionPrompt: `Purposeful camera motion for scene ${index}`,
  continuityNotes: `Continuity details for scene ${index}`,
  continuityMode: "CONTINUOUS",
}));

describe("planContinuityInvalidation", () => {
  it("cascades an anchor change through downstream scenes", () => {
    const patch = {
      ...scenes[1]!,
      anchorFramePrompt: "A new scene two anchor",
    };
    const result = planContinuityInvalidation(scenes, [patch], false);

    expect(result.get("scene-1")).toEqual({ anchor: false, video: false });
    expect(result.get("scene-2")).toEqual({ anchor: true, video: true });
    expect(result.get("scene-3")).toEqual({ anchor: true, video: true });
  });

  it("invalidates the current clip and later anchors for a handoff change", () => {
    const patch = {
      ...scenes[0]!,
      transitionOutPrompt: "Exit scene one on a faster rightward move",
    };
    const result = planContinuityInvalidation(scenes, [patch], false);

    expect(result.get("scene-1")).toEqual({ anchor: false, video: true });
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
