-- Preserve existing storyboard copy while changing its meaning from two
-- constrained image endpoints to one scene anchor plus a natural exit brief.
ALTER TABLE "Scene"
RENAME COLUMN "startFramePrompt" TO "anchorFramePrompt";

ALTER TABLE "Scene"
RENAME COLUMN "endFramePrompt" TO "transitionOutPrompt";

-- Very old builds could store the selected closing take in the shared
-- keyframe pointer. Repair it to the matching opening/anchor attempt first.
UPDATE "Scene" AS scene
SET "selectedKeyframeTakeId" = anchor_take."id"
FROM "Take" AS selected_take, "Take" AS anchor_take
WHERE scene."selectedKeyframeTakeId" = selected_take."id"
  AND selected_take."kind" = 'KEYFRAME_END'
  AND anchor_take."sceneId" = scene."id"
  AND anchor_take."kind" = 'KEYFRAME_START'
  AND anchor_take."attempt" = selected_take."attempt"
  AND anchor_take."status" = 'COMPLETE'
  AND anchor_take."artifactId" IS NOT NULL;

-- Also recover an anchor when only the split closing-frame pointer survived.
UPDATE "Scene" AS scene
SET "selectedKeyframeTakeId" = anchor_take."id"
FROM "Take" AS selected_end, "Take" AS anchor_take
WHERE scene."selectedKeyframeTakeId" IS NULL
  AND scene."selectedEndFrameTakeId" = selected_end."id"
  AND selected_end."kind" = 'KEYFRAME_END'
  AND anchor_take."sceneId" = scene."id"
  AND anchor_take."kind" = 'KEYFRAME_START'
  AND anchor_take."attempt" = selected_end."attempt"
  AND anchor_take."status" = 'COMPLETE'
  AND anchor_take."artifactId" IS NOT NULL;

UPDATE "Take"
SET "selected" = false
WHERE "kind" = 'KEYFRAME_END';

UPDATE "Take" AS take
SET "selected" = true
FROM "Scene" AS scene
WHERE scene."selectedKeyframeTakeId" = take."id"
  AND take."kind" = 'KEYFRAME_START';

-- Legacy KEYFRAME_END takes remain in Take/Artifact history. New production
-- no longer selects or submits a closing still to image-to-video generation.
ALTER TABLE "Scene"
DROP COLUMN "selectedEndFrameTakeId";
