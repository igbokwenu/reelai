"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clapperboard,
  ImagePlus,
  Loader2,
  RefreshCw,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  TakeCompare,
  type TakeArtifact,
  type TakeCompareScene,
} from "@/components/studio/TakeCompare";
import { Button } from "@/components/ui/button";

type Storyboard = {
  id: string;
  status: string;
  scenes: TakeCompareScene[];
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
  storyboard,
  artifacts,
  latestKeyframeJob,
  latestVideoJob,
}: {
  projectId: string;
  storyboard: Storyboard | null;
  artifacts: TakeArtifact[];
  latestKeyframeJob: Job | null;
  latestVideoJob: Job | null;
}) {
  const router = useRouter();
  const [keyframeJob, setKeyframeJob] = useState<Job | null>(latestKeyframeJob);
  const [videoJob, setVideoJob] = useState<Job | null>(latestVideoJob);
  const [starting, setStarting] = useState<"keyframes" | "videos" | null>(null);
  const [error, setError] = useState<string | null>(
    latestKeyframeJob?.error ?? latestVideoJob?.error ?? null,
  );
  const activeJob = [keyframeJob, videoJob].find((job) =>
    ["QUEUED", "RUNNING", "WAITING_PROVIDER"].includes(job?.status ?? ""),
  );
  const scenes = storyboard?.scenes ?? [];
  const approvedScenes = scenes.filter((scene) => scene.status === "APPROVED");
  const hasSelectedKeyframes =
    approvedScenes.length > 0 &&
    approvedScenes.every((scene) => scene.selectedKeyframeTakeId);
  const runDetails = useMemo(
    () => [keyframeJob, videoJob].filter(Boolean) as Job[],
    [keyframeJob, videoJob],
  );

  useEffect(() => {
    if (!activeJob) {
      return;
    }

    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/${activeJob.id}`);

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as { job: Job };

      if (data.job.type === "KEYFRAME") {
        setKeyframeJob(data.job);
      }

      if (data.job.type === "VIDEO") {
        setVideoJob(data.job);
      }

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

    const endpoint =
      kind === "keyframes"
        ? `/api/projects/${projectId}/keyframes`
        : `/api/projects/${projectId}/videos`;
    const response = await fetch(endpoint, { method: "POST" });
    const data = (await response.json()) as { job?: Job; error?: string };

    setStarting(null);

    if (!response.ok || !data.job) {
      setError(data.error ?? "Generation could not start.");
      return;
    }

    if (kind === "keyframes") {
      setKeyframeJob(data.job);
    } else {
      setVideoJob(data.job);
    }

    if (data.job.status === "FAILED") {
      setError(data.job.error ?? "Generation failed.");
    }

    router.refresh();
  }

  if (!storyboard) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        Generate and save an approved storyboard before opening production.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium">Generation Console</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Additive production: regenerating creates new takes and keeps prior artifacts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={
              storyboard.status !== "APPROVED" ||
              approvedScenes.length < 2 ||
              approvedScenes.length > 4 ||
              starting !== null ||
              Boolean(activeJob)
            }
            onClick={() => startGeneration("keyframes")}
            size="sm"
          >
            {starting === "keyframes" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="size-4" aria-hidden="true" />
            )}
            Generate Keyframes
          </Button>
          <Button
            disabled={
              !hasSelectedKeyframes ||
              starting !== null ||
              Boolean(activeJob)
            }
            onClick={() => startGeneration("videos")}
            size="sm"
          >
            {starting === "videos" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Video className="size-4" aria-hidden="true" />
            )}
            Submit I2V Clips
          </Button>
        </div>
      </div>

      <div className="grid gap-2 rounded-md border border-border bg-background/60 p-3 text-sm md:grid-cols-4">
        <StatusTile label="Storyboard" value={formatEnum(storyboard.status)} />
        <StatusTile label="Scenes" value={`${approvedScenes.length}/4 approved`} />
        <StatusTile
          label="Keyframes"
          value={hasSelectedKeyframes ? "Selected" : "Needed"}
        />
        <StatusTile
          label="Video Polling"
          value={videoJob?.status ? formatEnum(videoJob.status) : "Not started"}
        />
      </div>

      {error ? (
        <div className="flex gap-2 rounded-md border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {runDetails.length > 0 ? (
        <div className="grid gap-2 rounded-md border border-border bg-background/60 p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clapperboard className="size-4 text-primary" aria-hidden="true" />
            Run details
          </div>
          {runDetails.map((job) => (
            <div
              className="grid gap-2 rounded-md border border-border bg-card p-3 text-sm md:grid-cols-[120px_120px_minmax(0,1fr)]"
              key={job.id}
            >
              <span className="font-medium">{formatEnum(job.type)}</span>
              <span className="text-muted-foreground">
                {formatEnum(job.status)}
              </span>
              <span className="break-all text-muted-foreground">
                Model {job.model ?? "pending"} · Task{" "}
                {job.providerTaskId ?? job.id}
              </span>
              {job.status === "COMPLETE" ? (
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              ) : job.status === "WAITING_PROVIDER" || job.status === "RUNNING" ? (
                <RefreshCw className="size-4 animate-spin text-primary" aria-hidden="true" />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4">
        {scenes.map((scene) => (
          <div
            className="rounded-md border border-border bg-background/50 p-4"
            key={scene.id}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Scene {scene.index}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {scene.captionText}
                </p>
              </div>
              <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
                {formatEnum(scene.status)}
              </span>
            </div>
            <TakeCompare artifacts={artifacts} scene={scene} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-medium">{value}</p>
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
