CREATE TYPE "TransitionStyle" AS ENUM (
    'CUT',
    'FADE',
    'SLIDE',
    'WIPE',
    'IRIS',
    'CLOCK_WIPE'
);

ALTER TABLE "Project"
ADD COLUMN "cinematicBoost" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Scene"
ADD COLUMN "transitionStyle" "TransitionStyle" NOT NULL DEFAULT 'CUT';
