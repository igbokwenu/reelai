-- Scene narration is generated, measured, and scheduled independently so its
-- spoken content cannot drift across scene boundaries in the final render.
ALTER TABLE "Scene" ADD COLUMN "narrationArtifactId" TEXT;
