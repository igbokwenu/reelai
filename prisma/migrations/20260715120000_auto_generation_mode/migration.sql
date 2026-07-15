-- Persist the user's preferred workflow and the one-time Brand Kit handoff.
ALTER TABLE "Project"
ADD COLUMN "autoMode" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "brandKitConfirmedAt" TIMESTAMP(3);

-- Auto runs are intentionally separate from provider GenerationJobs. One run
-- coordinates several durable jobs and can resume without recreating outputs.
CREATE TABLE "AutoGenerationRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "phase" TEXT NOT NULL DEFAULT 'STORYBOARD',
    "currentJobId" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoGenerationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutoGenerationRun_projectId_createdAt_idx"
ON "AutoGenerationRun"("projectId", "createdAt");

CREATE INDEX "AutoGenerationRun_status_nextAttemptAt_idx"
ON "AutoGenerationRun"("status", "nextAttemptAt");

ALTER TABLE "AutoGenerationRun"
ADD CONSTRAINT "AutoGenerationRun_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
