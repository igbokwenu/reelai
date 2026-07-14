import { describe, expect, it } from "vitest";

import {
  fitNarrationToScene,
  MAX_NARRATION_PLAYBACK_RATE,
  NARRATION_LEAD_IN_SEC,
} from "./narration-timing";

describe("fitNarrationToScene", () => {
  it("keeps a naturally fitting line at its original pace", () => {
    expect(
      fitNarrationToScene({ sceneDurationSec: 8, sourceDurationSec: 5.2 }),
    ).toEqual({
      offsetSec: NARRATION_LEAD_IN_SEC,
      playbackRate: 1,
      sourceDurationSec: 5.2,
      audibleDurationSec: 5.2,
    });
  });

  it("uses a small bounded speed adjustment to finish inside the scene", () => {
    const timing = fitNarrationToScene({
      sceneDurationSec: 5,
      sourceDurationSec: 5,
    });

    expect(timing.playbackRate).toBeGreaterThan(1);
    expect(timing.playbackRate).toBeLessThanOrEqual(
      MAX_NARRATION_PLAYBACK_RATE,
    );
    expect(timing.offsetSec + timing.audibleDurationSec).toBeLessThan(5);
  });

  it("rejects speech that would require an unnatural speed-up", () => {
    expect(() =>
      fitNarrationToScene({ sceneDurationSec: 5, sourceDurationSec: 7 }),
    ).toThrow(/natural pace/);
  });
});
