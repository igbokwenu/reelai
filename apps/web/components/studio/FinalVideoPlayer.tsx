"use client";

import {
  AlertTriangle,
  Captions,
  Download,
  Film,
  Loader2,
  Music2,
  PlayCircle,
  ShieldCheck,
  Volume2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { isStoryboardTimingValid } from "@/lib/storyboards/timing";

type Artifact = {
  id: string;
  type: string;
  mimeType: string;
  publicUrl: string | null;
  durationSec: number | null;
  metadata: unknown;
};

type Render = {
  id: string;
  artifactId: string | null;
  status: string;
  format: string;
  settings: unknown;
};

type Scene = {
  id: string;
  index: number;
  durationSec: number;
  status: string;
  captionText: string;
  voiceoverText: string;
  selectedVideoTakeId: string | null;
  takes: Array<{
    id: string;
    kind: string;
    status: string;
    artifactId: string | null;
  }>;
};

type Storyboard = {
  id: string;
  status: string;
  bgmEnabled: boolean;
  scenes: Scene[];
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

export function FinalVideoPlayer({
  projectId,
  storyboard,
  artifacts,
  renders,
  latestNarrationJob,
  latestRenderJob,
  outputMode = "STANDARD",
  targetDurationSec,
}: {
  projectId: string;
  storyboard: Storyboard | null;
  artifacts: Artifact[];
  renders: Render[];
  latestNarrationJob: Job | null;
  latestRenderJob: Job | null;
  outputMode?: "STANDARD" | "PRODUCT_SHOWCASE";
  targetDurationSec: number;
}) {
  const router = useRouter();
  const [narrationJob, setNarrationJob] = useState<Job | null>(
    latestNarrationJob,
  );
  const [renderJob, setRenderJob] = useState<Job | null>(latestRenderJob);
  const [starting, setStarting] = useState<"narration" | "render" | null>(null);
  const [aiDisclosureEnabled, setAiDisclosureEnabled] = useState(true);
  const [bgmEnabled, setBgmEnabled] = useState(false);
  const [error, setError] = useState<string | null>(
    latestNarrationJob?.error ?? latestRenderJob?.error ?? null,
  );
  const activeJob = [narrationJob, renderJob].find((job) =>
    ["QUEUED", "RUNNING", "WAITING_PROVIDER"].includes(job?.status ?? ""),
  );
  const legacyNarrationArtifact = useMemo(
    () => findNarrationArtifact(artifacts, narrationJob),
    [artifacts, narrationJob],
  );
  const sceneNarrations = useMemo(
    () =>
      findSceneNarrations(artifacts, narrationJob, storyboard?.scenes ?? []),
    [artifacts, narrationJob, storyboard?.scenes],
  );
  const completeRender =
    renders.find(
      (render) => render.status === "COMPLETE" && render.artifactId,
    ) ?? null;
  const finalArtifact = completeRender?.artifactId
    ? (artifacts.find(
        (artifact) => artifact.id === completeRender.artifactId,
      ) ?? null)
    : null;
  const thumbnailArtifact = findThumbnailArtifact(artifacts, completeRender);
  const completedScenes =
    storyboard?.scenes.filter((scene) => scene.status === "COMPLETE") ?? [];
  const canRender = Boolean(
    storyboard &&
    isStoryboardTimingValid({
      outputMode,
      targetDurationSec,
      durations: storyboard.scenes.map((scene) => scene.durationSec),
    }) &&
    storyboard.scenes.every(
      (scene) =>
        scene.status === "COMPLETE" &&
        scene.takes.some(
          (take) =>
            take.id === scene.selectedVideoTakeId &&
            take.kind === "VIDEO" &&
            take.status === "COMPLETE" &&
            take.artifactId,
        ),
    ),
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

      if (data.job.type === "TTS") {
        setNarrationJob(data.job);
      }

      if (data.job.type === "RENDER") {
        setRenderJob(data.job);
      }

      if (data.job.status === "COMPLETE") {
        setError(null);
        router.refresh();
      }

      if (data.job.status === "FAILED") {
        setError(data.job.error ?? "Final export step failed.");
        router.refresh();
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [activeJob, router]);

  async function startNarration() {
    setStarting("narration");
    setError(null);

    const response = await fetch(`/api/projects/${projectId}/narration`, {
      method: "POST",
    });
    const data = (await response.json()) as { job?: Job; error?: string };
    setStarting(null);

    if (!response.ok || !data.job) {
      setError(data.error ?? "Narration could not start.");
      return;
    }

    setNarrationJob(data.job);
    if (data.job.status === "FAILED") {
      setError(data.job.error ?? "Scene narration generation failed.");
    }
    router.refresh();
  }

  async function startRender() {
    setStarting("render");
    setError(null);

    const response = await fetch(`/api/projects/${projectId}/render`, {
      body: JSON.stringify({ aiDisclosureEnabled, bgmEnabled }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const data = (await response.json()) as { job?: Job; error?: string };
    setStarting(null);

    if (!response.ok || !data.job) {
      setError(data.error ?? "Final render could not start.");
      return;
    }

    setRenderJob(data.job);
    if (data.job.status === "FAILED") {
      setError(data.job.error ?? "Final render failed.");
    }
    router.refresh();
  }

  if (!storyboard) {
    return (
      <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        Generate the storyboard and scene videos before final export.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium">Final Export</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Narration, final-scene closer, safe zones, disclosure, and a 9:16
            MP4.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={starting !== null || Boolean(activeJob)}
            onClick={startNarration}
            size="sm"
            tooltip="Generates a timed voice track for each scene that has voiceover text."
            tooltipSide="bottom"
          >
            {starting === "narration" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Volume2 className="size-4" aria-hidden="true" />
            )}
            Generate Scene Narration
          </Button>
          <Button
            disabled={!canRender || starting !== null || Boolean(activeJob)}
            onClick={startRender}
            size="sm"
            tooltip="Combines selected clips, captions, narration, disclosure, and optional music into the final 9:16 MP4."
            tooltipSide="bottom"
          >
            {starting === "render" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <PlayCircle className="size-4" aria-hidden="true" />
            )}
            Render Reel
          </Button>
        </div>
      </div>

      <div className="grid gap-2 rounded-md border border-border bg-background/60 p-3 text-sm md:grid-cols-4">
        <StatusTile
          label="Narration"
          value={formatStatus(narrationJob?.status)}
        />
        <StatusTile
          label="Scenes"
          value={`${completedScenes.length}/${storyboard.scenes.length} complete`}
        />
        <StatusTile label="Safe zones" value="TikTok/Reels" />
        <StatusTile label="Render" value={formatStatus(renderJob?.status)} />
      </div>

      {error ? (
        <div className="flex gap-2 rounded-md border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-md border border-border bg-background/50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Volume2 className="size-4 text-primary" aria-hidden="true" />
            Scene Narration Preview
          </div>
          {sceneNarrations.length > 0 ? (
            <div className="grid gap-3">
              {sceneNarrations.map(({ artifact, scene, timing }) => (
                <div
                  className="rounded-md border border-border bg-card/55 p-3"
                  key={scene.id}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                      Scene {scene.index}
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {formatSeconds(timing.sourceDurationSec)} source
                      {timing.playbackRate > 1
                        ? ` · ${timing.playbackRate.toFixed(2)}× fitted`
                        : " · natural pace"}
                    </span>
                  </div>
                  <audio
                    className="w-full"
                    controls
                    preload="metadata"
                    src={`/api/artifacts/${artifact.id}/file`}
                  />
                  <Waveform artifact={artifact} />
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {scene.voiceoverText}
                  </p>
                </div>
              ))}
            </div>
          ) : legacyNarrationArtifact ? (
            <>
              <audio
                className="w-full"
                controls
                preload="metadata"
                src={`/api/artifacts/${legacyNarrationArtifact.id}/file`}
              />
              <Waveform artifact={legacyNarrationArtifact} />
              <p className="mt-2 text-xs text-muted-foreground">
                {legacyNarrationArtifact.durationSec
                  ? `${Math.round(legacyNarrationArtifact.durationSec)}s legacy narration`
                  : "Duration metadata pending"}{" "}
                · Regenerate to use scene-locked timing
              </p>
            </>
          ) : narrationJob?.status === "COMPLETE" &&
            storyboard.scenes.every((scene) => !scene.voiceoverText.trim()) ? (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              All scenes are intentionally silent. The reel can be rendered with
              the final closer
              {outputMode === "PRODUCT_SHOWCASE" ? "." : " and optional BGM."}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              No scene narration artifacts yet.
            </div>
          )}
        </div>

        <div className="grid gap-3 rounded-md border border-border bg-background/50 p-4 text-sm">
          <label className="flex items-center gap-3">
            <input
              checked={aiDisclosureEnabled}
              className="size-4 accent-primary"
              onChange={(event) => setAiDisclosureEnabled(event.target.checked)}
              type="checkbox"
            />
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              AI disclosure
            </span>
          </label>
          <label className="flex items-center gap-3">
            <input
              checked={bgmEnabled}
              className="size-4 accent-primary"
              disabled={outputMode === "PRODUCT_SHOWCASE"}
              onChange={(event) => setBgmEnabled(event.target.checked)}
              type="checkbox"
            />
            <span className="flex items-center gap-2">
              <Music2 className="size-4 text-primary" aria-hidden="true" />
              {outputMode === "PRODUCT_SHOWCASE"
                ? "Voiceover-only audio"
                : "Include built-in sample BGM"}
            </span>
          </label>
          <div className="flex items-start gap-2 rounded-md border border-border p-3 text-muted-foreground">
            <Captions
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>
              {outputMode === "PRODUCT_SHOWCASE"
                ? "Product source clips are kept silent and muted during composition; scene narration supplies the final audio."
                : "The BGM option uses a stored neutral sample bed; it does not require generated music."}
            </span>
          </div>
        </div>
      </div>

      {finalArtifact ? (
        <div className="grid gap-4 rounded-md border border-border bg-card p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">Final 9:16 MP4</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Stored as FINAL_RENDER · {finalArtifact.mimeType}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/library">
                  <Film className="size-4" aria-hidden="true" />
                  View in library
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                tooltip="Downloads the latest finished reel as an MP4 file."
                tooltipSide="bottom"
              >
                <a href={`/api/artifacts/${finalArtifact.id}/file`} download>
                  <Download className="size-4" aria-hidden="true" />
                  Download MP4
                </a>
              </Button>
            </div>
          </div>
          <video
            className="aspect-[9/16] max-h-[720px] w-full rounded-md border border-border bg-black object-contain"
            controls
            poster={
              thumbnailArtifact
                ? `/api/artifacts/${thumbnailArtifact.id}/file`
                : undefined
            }
            preload="metadata"
            src={`/api/artifacts/${finalArtifact.id}/file`}
          />
        </div>
      ) : null}
    </div>
  );
}

function Waveform({ artifact }: { artifact: Artifact }) {
  const waveform = readWaveform(artifact);

  return (
    <div className="mt-3 flex h-16 items-end gap-1 rounded-md border border-border bg-card px-3 py-2">
      {waveform.map((value, index) => (
        <div
          className="w-full rounded-t-sm bg-primary/80"
          key={`${value}-${index}`}
          style={{ height: `${Math.max(8, value * 52)}px` }}
        />
      ))}
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

function findNarrationArtifact(artifacts: Artifact[], job: Job | null) {
  const output = asRecord(job?.output);
  const id = output?.narrationArtifactId;

  if (typeof id === "string") {
    return artifacts.find((artifact) => artifact.id === id) ?? null;
  }

  return (
    artifacts.find(
      (artifact) =>
        artifact.type === "AUDIO" &&
        asRecord(artifact.metadata)?.operation === "narration_tts",
    ) ?? null
  );
}

function findSceneNarrations(
  artifacts: Artifact[],
  job: Job | null,
  scenes: Scene[],
) {
  const output = asRecord(job?.output);
  const manifest = output?.sceneNarrations;
  if (!Array.isArray(manifest)) return [];

  const artifactById = new Map(
    artifacts.map((artifact) => [artifact.id, artifact]),
  );
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));

  return manifest.flatMap((value) => {
    const record = asRecord(value);
    const artifact =
      typeof record?.artifactId === "string"
        ? artifactById.get(record.artifactId)
        : null;
    const scene =
      typeof record?.sceneId === "string"
        ? sceneById.get(record.sceneId)
        : null;
    if (!record || !artifact || !scene) return [];

    return [
      {
        artifact,
        scene,
        timing: {
          playbackRate:
            typeof record.playbackRate === "number" ? record.playbackRate : 1,
          sourceDurationSec:
            typeof record.sourceDurationSec === "number"
              ? record.sourceDurationSec
              : (artifact.durationSec ?? 0),
        },
      },
    ];
  });
}

function findThumbnailArtifact(artifacts: Artifact[], render: Render | null) {
  const settings = asRecord(render?.settings);
  const id = settings?.thumbnailArtifactId;

  if (typeof id === "string") {
    return artifacts.find((artifact) => artifact.id === id) ?? null;
  }

  return artifacts.find((artifact) => artifact.type === "THUMBNAIL") ?? null;
}

function readWaveform(artifact: Artifact) {
  const metadata = asRecord(artifact.metadata);
  const waveform = metadata?.waveform;

  if (Array.isArray(waveform)) {
    return waveform
      .filter((value): value is number => typeof value === "number")
      .slice(0, 48);
  }

  return Array.from(
    { length: 48 },
    (_, index) => 0.25 + ((index * 17) % 55) / 100,
  );
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatStatus(value: string | null | undefined) {
  if (!value) {
    return "Not started";
  }

  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSeconds(value: number) {
  return `${value.toFixed(1)}s`;
}
