"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clapperboard,
  ImagePlus,
  Loader2,
  PackageCheck,
  Palette,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  KeyframeStoryFlow,
  type ProductionScene,
} from "@/components/studio/KeyframeStoryFlow";
import type { TakeArtifact } from "@/components/studio/TakeCompare";
import { Button } from "@/components/ui/button";

type Storyboard = {
  id: string;
  title: string;
  status: string;
  productContinuity: string;
  characterContinuity: string;
  visualContinuity: string;
  scenes: ProductionScene[];
};

type Job = {
  id: string;
  type: string;
  status: string;
  model: string | null;
  providerTaskId: string | null;
  error: string | null;
  output: unknown;
};

export function GenerationConsole({
  projectId,
  conceptTitle,
  storyboard,
  artifacts,
  latestKeyframeJob,
  latestVideoJob,
}: {
  projectId: string;
  conceptTitle: string | null;
  storyboard: Storyboard | null;
  artifacts: TakeArtifact[];
  latestKeyframeJob: Job | null;
  latestVideoJob: Job | null;
}) {
  const router = useRouter();
  const [keyframeJob, setKeyframeJob] = useState<Job | null>(latestKeyframeJob);
  const [videoJob, setVideoJob] = useState<Job | null>(latestVideoJob);
  const [starting, setStarting] = useState<"keyframes" | "videos" | null>(null);
  const [savingSceneId, setSavingSceneId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    latestKeyframeJob?.error ?? latestVideoJob?.error ?? null,
  );
  const activeJob = [keyframeJob, videoJob].find((job) =>
    ["QUEUED", "RUNNING", "WAITING_PROVIDER"].includes(job?.status ?? ""),
  );
  const scenes = storyboard?.scenes ?? [];
  const productionScenes = scenes;
  const hasApprovedStory =
    productionScenes.length >= 2 &&
    productionScenes.length <= 4 &&
    productionScenes.every((scene) => scene.status !== "DRAFT");
  const hasRecommendedFrames =
    hasApprovedStory &&
    productionScenes.every((scene) => {
      const selectedStartPointer = scene.takes.find(
        (take) => take.id === scene.selectedKeyframeTakeId,
      );
      if (!isUsableFrame(selectedStartPointer)) return false;

      const start =
        selectedStartPointer.kind === "KEYFRAME_START"
          ? selectedStartPointer
          : scene.takes.find(
              (take) =>
                take.kind === "KEYFRAME_START" &&
                take.attempt === selectedStartPointer.attempt &&
                isUsableFrame(take),
            );
      const end = scene.selectedEndFrameTakeId
        ? scene.takes.find(
            (take) =>
              take.id === scene.selectedEndFrameTakeId &&
              take.kind === "KEYFRAME_END" &&
              isUsableFrame(take),
          )
        : selectedStartPointer.kind === "KEYFRAME_END"
          ? selectedStartPointer
          : scene.takes.find(
              (take) =>
                take.kind === "KEYFRAME_END" &&
                take.attempt === selectedStartPointer.attempt &&
                isUsableFrame(take),
            );
      return Boolean(start && end);
    });
  const completedClips = productionScenes.filter(
    (scene) =>
      scene.status === "COMPLETE" &&
      scene.takes.some(
        (take) =>
          take.id === scene.selectedVideoTakeId &&
          take.kind === "VIDEO" &&
          take.status === "COMPLETE" &&
          take.artifactId,
      ),
  ).length;
  const runDetails = useMemo(
    () => [keyframeJob, videoJob].filter(Boolean) as Job[],
    [keyframeJob, videoJob],
  );

  useEffect(() => {
    if (!activeJob) return;

    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/${activeJob.id}`);
      if (!response.ok) return;

      const data = (await response.json()) as { job: Job };
      if (data.job.type === "KEYFRAME") setKeyframeJob(data.job);
      if (data.job.type === "VIDEO") setVideoJob(data.job);

      if (data.job.status === "COMPLETE") {
        setError(null);
        router.refresh();
      }

      if (data.job.status === "FAILED") {
        setError(data.job.error ?? "Generation failed.");
        router.refresh();
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [activeJob, router]);

  async function startGeneration(kind: "keyframes" | "videos") {
    setStarting(kind);
    setError(null);

    try {
      const endpoint =
        kind === "keyframes"
          ? `/api/projects/${projectId}/keyframes`
          : `/api/projects/${projectId}/videos`;
      const response = await fetch(endpoint, { method: "POST" });
      const data = (await response.json().catch(() => ({}))) as {
        job?: Job;
        error?: string;
      };

      if (!response.ok || !data.job) {
        setError(data.error ?? "Generation could not start. Please try again.");
        return;
      }

      if (kind === "keyframes") setKeyframeJob(data.job);
      else setVideoJob(data.job);

      if (data.job.status === "FAILED") {
        setError(data.job.error ?? "Generation failed.");
      }
      router.refresh();
    } catch {
      setError(
        "Could not reach the generation service. Check the dev server and try again.",
      );
    } finally {
      setStarting(null);
    }
  }

  async function saveScene(scene: ProductionScene) {
    if (!storyboard) return false;

    setSavingSceneId(scene.id);
    setError(null);
    const response = await fetch(`/api/storyboards/${storyboard.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenes: [
          {
            id: scene.id,
            durationSec: scene.durationSec,
            captionText: scene.captionText,
            voiceoverText: scene.voiceoverText,
            startFramePrompt: scene.startFramePrompt,
            endFramePrompt: scene.endFramePrompt,
            videoMotionPrompt: scene.videoMotionPrompt,
            continuityNotes: scene.continuityNotes,
            continuityMode: scene.continuityMode,
          },
        ],
      }),
    });
    const data = (await response.json()) as { error?: string };
    setSavingSceneId(null);

    if (!response.ok) {
      setError(data.error ?? "Scene tuning could not be saved.");
      return false;
    }

    router.refresh();
    return true;
  }

  if (!storyboard) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Generate and approve a storyboard before opening production.
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/[0.1] via-card to-card">
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="size-4" aria-hidden="true" />
              Your recommended production plan
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">
              {storyboard.title}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Built from{" "}
              {conceptTitle ? `“${conceptTitle}”` : "your selected concept"}.
              Reel AI has already chosen the visual sequence; review how it
              stitches together, fine-tune only what matters, then create the
              clips.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button
              disabled={
                !["APPROVED", "COMPLETE"].includes(storyboard.status) ||
                !hasApprovedStory ||
                starting !== null ||
                Boolean(activeJob)
              }
              onClick={() => startGeneration("keyframes")}
              size="sm"
              variant={hasRecommendedFrames ? "outline" : "default"}
            >
              {starting === "keyframes" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : hasRecommendedFrames ? (
                <RefreshCw className="size-4" aria-hidden="true" />
              ) : (
                <ImagePlus className="size-4" aria-hidden="true" />
              )}
              {hasRecommendedFrames
                ? "Refresh story frames"
                : "Create story frames"}
            </Button>
            <Button
              disabled={
                !hasRecommendedFrames || starting !== null || Boolean(activeJob)
              }
              onClick={() => startGeneration("videos")}
              size="sm"
            >
              {starting === "videos" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : completedClips === productionScenes.length ? (
                <RefreshCw className="size-4" aria-hidden="true" />
              ) : (
                <Video className="size-4" aria-hidden="true" />
              )}
              {completedClips === productionScenes.length
                ? "Recreate scene clips"
                : "Create scene clips"}
            </Button>
          </div>
        </div>

        <div className="grid border-t border-border bg-background/35 sm:grid-cols-3">
          <ProgressStep
            complete={["APPROVED", "COMPLETE"].includes(storyboard.status)}
            label="Story approved"
            step="1"
          />
          <ProgressStep
            complete={hasRecommendedFrames}
            label="Endpoints ready"
            step="2"
          />
          <ProgressStep
            complete={completedClips === productionScenes.length}
            label={`${completedClips}/${productionScenes.length} clips ready`}
            step="3"
          />
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border border-border bg-card/55 p-4 lg:grid-cols-3">
        <ContinuityLock
          icon={PackageCheck}
          label="Product identity"
          text={storyboard.productContinuity}
        />
        <ContinuityLock
          icon={UserRoundCheck}
          label="Character identity"
          text={storyboard.characterContinuity}
        />
        <ContinuityLock
          icon={Palette}
          label="Visual world"
          text={storyboard.visualContinuity}
        />
      </section>

      {error ? (
        <div className="flex gap-2 rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>{error}</span>
        </div>
      ) : null}

      <KeyframeStoryFlow
        artifacts={artifacts}
        onSaveScene={saveScene}
        savingSceneId={savingSceneId}
        scenes={scenes}
      />

      {runDetails.length > 0 ? (
        <details className="group rounded-xl border border-border bg-background/50">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <Clapperboard
                className="size-4 text-primary"
                aria-hidden="true"
              />
              Generation details
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              Models, tasks, and status
            </span>
          </summary>
          <div className="grid gap-2 border-t border-border p-3">
            {runDetails.map((job) => (
              <div
                className="grid gap-2 rounded-lg border border-border bg-card p-3 text-xs sm:grid-cols-[100px_120px_minmax(0,1fr)_auto] sm:items-center"
                key={job.id}
              >
                <span className="font-medium">{formatEnum(job.type)}</span>
                <span className="text-muted-foreground">
                  {formatEnum(job.status)}
                </span>
                <span className="break-all text-muted-foreground">
                  {job.model ?? "Model pending"} ·{" "}
                  {job.providerTaskId ?? job.id}
                </span>
                {job.status === "COMPLETE" ? (
                  <CheckCircle2
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                ) : ["WAITING_PROVIDER", "RUNNING", "QUEUED"].includes(
                    job.status,
                  ) ? (
                  <RefreshCw
                    className="size-4 animate-spin text-primary"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function isUsableFrame(
  take: ProductionScene["takes"][number] | undefined,
): take is ProductionScene["takes"][number] {
  return Boolean(
    take &&
    (take.kind === "KEYFRAME_START" || take.kind === "KEYFRAME_END") &&
    take.status === "COMPLETE" &&
    take.artifactId,
  );
}

function ProgressStep({
  step,
  label,
  complete,
}: {
  step: string;
  label: string;
  complete: boolean;
}) {
  return (
    <div className="flex items-center gap-2 border-border px-4 py-3 text-xs sm:border-r sm:last:border-r-0">
      <span
        className={`flex size-6 items-center justify-center rounded-full border text-[10px] font-semibold ${
          complete
            ? "border-primary/30 bg-primary/15 text-primary"
            : "border-border text-muted-foreground"
        }`}
      >
        {complete ? <Check className="size-3.5" aria-hidden="true" /> : step}
      </span>
      <span className={complete ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}

function ContinuityLock({
  icon: Icon,
  label,
  text,
}: {
  icon: typeof ShieldCheck;
  label: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold">{label} locked</p>
        <p className="mt-1 line-clamp-3 text-[11px] leading-5 text-muted-foreground">
          {text}
        </p>
      </div>
    </div>
  );
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
