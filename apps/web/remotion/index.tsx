import { Composition, registerRoot } from "remotion";

import { ReelComposition } from "./ReelComposition";
import {
  getReelDurationFrames,
  REEL_FPS,
  REEL_HEIGHT,
  REEL_WIDTH,
  type ReelCompositionInput,
} from "./schema";

const defaultInput: ReelCompositionInput = {
  aiDisclosureEnabled: true,
  safeZonePreset: "TIKTOK_REELS",
  scenes: [
    {
      captionText: "Reel AI final render",
      durationSec: 5,
      startTimeSec: 0,
      videoUrl: "",
    },
  ],
};

function RemotionRoot() {
  return (
    <Composition
      component={ReelComposition}
      defaultProps={defaultInput}
      durationInFrames={getReelDurationFrames(defaultInput)}
      fps={REEL_FPS}
      height={REEL_HEIGHT}
      id="ReelComposition"
      width={REEL_WIDTH}
    />
  );
}

registerRoot(RemotionRoot);
