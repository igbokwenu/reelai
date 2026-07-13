CREATE TYPE "ContinuityMode" AS ENUM ('CONTINUOUS', 'MATCH_CUT', 'INTENTIONAL_CHANGE');

ALTER TABLE "Storyboard"
ADD COLUMN "productContinuity" TEXT NOT NULL DEFAULT 'Preserve recurring product shape, materials, colors, proportions, and identifying details across scenes.',
ADD COLUMN "characterContinuity" TEXT NOT NULL DEFAULT 'Preserve recurring character identity, wardrobe, hair, age, and defining features across scenes.',
ADD COLUMN "visualContinuity" TEXT NOT NULL DEFAULT 'Preserve the locked brand palette, lighting, lens language, texture, and time of day across scenes.';

ALTER TABLE "Scene"
ADD COLUMN "continuityMode" "ContinuityMode" NOT NULL DEFAULT 'CONTINUOUS';
