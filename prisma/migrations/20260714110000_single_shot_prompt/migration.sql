-- A scene now has one concise model-facing shot sentence. The prior motion
-- brief is the closest compatible source for existing projects.
ALTER TABLE "Scene"
RENAME COLUMN "videoMotionPrompt" TO "shotPrompt";

ALTER TABLE "Scene"
DROP COLUMN "anchorFramePrompt",
DROP COLUMN "transitionOutPrompt";

-- Reel AI intentionally keeps generated clips inside the low-drift window.
UPDATE "Scene"
SET "durationSec" = GREATEST(5, LEAST(10, "durationSec"));
