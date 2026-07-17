UPDATE "Project"
SET "videoLengthSec" = 5
WHERE "razzmatazzMode" = true
  AND "videoLengthSec" <> 5;

UPDATE "CreativeConcept" AS concept
SET "estimatedDuration" = 5,
    "estimatedScenes" = 1
FROM "Project" AS project
WHERE concept."projectId" = project."id"
  AND project."razzmatazzMode" = true
  AND (
    concept."estimatedDuration" <> 5
    OR concept."estimatedScenes" <> 1
  );

UPDATE "Scene" AS scene
SET "durationSec" = 5
FROM "Storyboard" AS storyboard
JOIN "Project" AS project ON project."id" = storyboard."projectId"
WHERE scene."storyboardId" = storyboard."id"
  AND project."razzmatazzMode" = true
  AND scene."durationSec" <> 5
  AND (
    SELECT COUNT(*)
    FROM "Scene" AS sibling
    WHERE sibling."storyboardId" = storyboard."id"
  ) = 1;
