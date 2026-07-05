-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VideoStyle" AS ENUM ('REALISTIC', 'THREE_D_ANIMATION');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'RESEARCHING', 'CONCEPTING', 'STORYBOARDING', 'GENERATING', 'RENDERING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('WEBSITE', 'UPLOAD', 'LOGO', 'PRODUCT_IMAGE', 'DOCUMENT', 'REFERENCE_AD');

-- CreateEnum
CREATE TYPE "StoryboardStatus" AS ENUM ('DRAFT', 'APPROVED', 'GENERATING', 'COMPLETE');

-- CreateEnum
CREATE TYPE "SceneStatus" AS ENUM ('DRAFT', 'APPROVED', 'GENERATING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "SafeZonePreset" AS ENUM ('TIKTOK_REELS', 'YOUTUBE_SHORTS', 'NONE');

-- CreateEnum
CREATE TYPE "TakeKind" AS ENUM ('KEYFRAME_START', 'KEYFRAME_END', 'VIDEO');

-- CreateEnum
CREATE TYPE "TakeStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('BRAND_KIT', 'CONCEPTS', 'KEYFRAME', 'VIDEO', 'TTS', 'RENDER', 'POLICY_REVIEW');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_PROVIDER', 'COMPLETE', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'THUMBNAIL', 'FINAL_RENDER');

-- CreateEnum
CREATE TYPE "RenderStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "targetAudience" TEXT,
    "offer" TEXT,
    "videoLengthSec" INTEGER NOT NULL DEFAULT 30,
    "style" "VideoStyle" NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandKit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "valueProps" JSONB NOT NULL,
    "audience" TEXT,
    "tone" TEXT NOT NULL,
    "palette" JSONB NOT NULL,
    "visualMotifs" JSONB NOT NULL,
    "claims" JSONB NOT NULL,
    "policyRisks" JSONB NOT NULL,
    "sourceCitations" JSONB NOT NULL,
    "lockedStyle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandKit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandSource" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "url" TEXT,
    "artifactId" TEXT,
    "extractedText" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeConcept" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "narrativeArc" TEXT NOT NULL,
    "visualStyle" TEXT NOT NULL,
    "estimatedScenes" INTEGER NOT NULL,
    "estimatedDuration" INTEGER NOT NULL,
    "previewPrompt" TEXT NOT NULL,
    "previewArtifactId" TEXT,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Storyboard" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "bgmPrompt" TEXT,
    "bgmEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "StoryboardStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Storyboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL,
    "storyboardId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "captionText" TEXT NOT NULL,
    "voiceoverText" TEXT NOT NULL,
    "startFramePrompt" TEXT NOT NULL,
    "endFramePrompt" TEXT NOT NULL,
    "videoMotionPrompt" TEXT NOT NULL,
    "lockedStyleLanguage" TEXT NOT NULL,
    "safeZonePreset" "SafeZonePreset" NOT NULL DEFAULT 'TIKTOK_REELS',
    "status" "SceneStatus" NOT NULL DEFAULT 'DRAFT',
    "selectedKeyframeTakeId" TEXT,
    "selectedVideoTakeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Take" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "kind" "TakeKind" NOT NULL,
    "attempt" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "artifactId" TEXT,
    "status" "TakeStatus" NOT NULL DEFAULT 'QUEUED',
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Take_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "model" TEXT,
    "providerTaskId" TEXT,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "ossKey" TEXT NOT NULL,
    "publicUrl" TEXT,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" DOUBLE PRECISION,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Render" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "artifactId" TEXT,
    "status" "RenderStatus" NOT NULL DEFAULT 'QUEUED',
    "format" TEXT NOT NULL DEFAULT '9:16',
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Render_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandKit_projectId_key" ON "BrandKit"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Storyboard_projectId_key" ON "Storyboard"("projectId");

-- AddForeignKey
ALTER TABLE "BrandKit" ADD CONSTRAINT "BrandKit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandSource" ADD CONSTRAINT "BrandSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeConcept" ADD CONSTRAINT "CreativeConcept_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_storyboardId_fkey" FOREIGN KEY ("storyboardId") REFERENCES "Storyboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Take" ADD CONSTRAINT "Take_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Render" ADD CONSTRAINT "Render_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
