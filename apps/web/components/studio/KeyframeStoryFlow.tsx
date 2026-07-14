"use client";

import {
  Check,
  ChevronDown,
  Clock3,
  Film,
  ImageIcon,
  Link2,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import type {
  SceneTake,
  TakeArtifact,
  TakeCompareScene,
} from "@/components/studio/TakeCompare";
import { Button } from "@/components/ui/button";

export type ProductionScene = TakeCompareScene & {
  durationSec: number;
  voiceoverText: string;
  shotPrompt: string;
  continuityNotes: string;
  continuityMode: "CONTINUOUS" | "MATCH_CUT" | "INTENTIONAL_CHANGE";
};

export function KeyframeStoryFlow({
  scenes,
  artifacts,
  savingSceneId,
  retryingSceneId,
  isProductionBusy,
  onSaveScene,
  onRetrySceneVideo,
}: {
  scenes: ProductionScene[];
  artifacts: TakeArtifact[];
  savingSceneId: string | null;
  retryingSceneId: string | null;
  isProductionBusy: boolean;
  onSaveScene: (scene: ProductionScene) => Promise<boolean>;
  onRetrySceneVideo: (sceneId: string) => Promise<void>;
}) {
  const artifactById = new Map(
    artifacts.map((artifact) => [artifact.id, artifact]),
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background/45">
      <div className="flex flex-col gap-3 border-b border-border bg-gradient-to-r from-primary/[0.08] via-transparent to-transparent px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            Recommended story flow
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Every clip follows one concise direction: one subject, one action,
            and one camera move from a continuity-locked anchor.
          </p>
        </div>
        <span className="w-fit rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
          {scenes.length} scenes · one sequence
        </span>
      </div>

      <div className="overflow-x-auto p-4">
        <div className="flex min-w-max items-stretch gap-3">
          {scenes.map((scene, index) => {
            const anchorTake = getCurrentAnchor(scene);
            const selectedVideo = scene.takes.find(
              (take) =>
                take.id === scene.selectedVideoTakeId &&
                take.kind === "VIDEO" &&
                take.status === "COMPLETE" &&
                take.artifactId,
            );
            const failedVideo = scene.takes.find(
              (take) => take.kind === "VIDEO" && take.status === "FAILED",
            );
            const isReady = Boolean(anchorTake?.artifactId);
            const needsVideo = isReady && !selectedVideo;

            return (
              <article
                className="relative flex min-h-full w-[280px] shrink-0 flex-col rounded-xl border border-border bg-card/80 p-3 shadow-xl shadow-black/10 sm:w-[300px] xl:w-[320px]"
                key={scene.id}
              >
                {index > 0 ? (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-background/70 px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    <Link2
                      className="size-3.5 text-primary"
                      aria-hidden="true"
                    />
                    {transitionLabel(scene.continuityMode)}
                  </div>
                ) : (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/[0.07] px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                    <Film className="size-3.5" aria-hidden="true" />
                    Story opens here
                  </div>
                )}

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                      Scene {String(scene.index).padStart(2, "0")}
                    </p>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm font-medium leading-5">
                      {scene.captionText}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground">
                    <Clock3 className="size-3" aria-hidden="true" />
                    {scene.durationSec}s
                  </span>
                </div>

                <div className="mt-3">
                  <FramePreview
                    artifactById={artifactById}
                    label="Scene anchor"
                    take={anchorTake}
                  />
                </div>
                <p className="mt-3 rounded-lg border border-border bg-background/55 p-2.5 text-[11px] leading-5 text-muted-foreground">
                  {scene.shotPrompt}
                </p>

                <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                  <span
                    className={
                      isReady
                        ? "flex items-center gap-1.5 text-primary"
                        : "text-muted-foreground"
                    }
                  >
                    {isReady ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : (
                      <ImageIcon className="size-3.5" aria-hidden="true" />
                    )}
                    {isReady ? "Anchor ready" : "Anchor not generated"}
                  </span>
                  <span className="text-muted-foreground">
                    {formatEnum(scene.status)}
                  </span>
                </div>

                {selectedVideo?.artifactId ? (
                  <video
                    aria-label={`Selected clip for scene ${scene.index}`}
                    className="mt-3 aspect-[9/16] w-full rounded-lg border border-border bg-black object-contain"
                    controls
                    muted
                    playsInline
                    preload="metadata"
                    src={`/api/artifacts/${selectedVideo.artifactId}/file`}
                  />
                ) : null}

                {needsVideo ? (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-400/25 bg-amber-400/[0.08] p-2.5">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-amber-200">
                        {failedVideo
                          ? "Scene clip needs a retry"
                          : "Scene clip not created"}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[9px] leading-4 text-muted-foreground">
                        {failedVideo?.notes ??
                          "Generate only this scene while preserving completed clips."}
                      </p>
                    </div>
                    <Button
                      className="shrink-0"
                      disabled={isProductionBusy}
                      onClick={() => onRetrySceneVideo(scene.id)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {retryingSceneId === scene.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      {failedVideo ? "Retry clip" : "Create clip"}
                    </Button>
                  </div>
                ) : null}

                <SceneTuner
                  isSaving={savingSceneId === scene.id}
                  onSave={onSaveScene}
                  scene={scene}
                />

                <GenerationHistory
                  artifactById={artifactById}
                  currentIds={
                    new Set(
                      [anchorTake?.id, selectedVideo?.id].filter(
                        (id): id is string => Boolean(id),
                      ),
                    )
                  }
                  takes={scene.takes}
                />
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FramePreview({
  label,
  take,
  artifactById,
}: {
  label: string;
  take: SceneTake | null;
  artifactById: Map<string, TakeArtifact>;
}) {
  const artifact = take?.artifactId ? artifactById.get(take.artifactId) : null;

  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-background/70">
      <div className="flex items-center justify-between px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
        {label}
        {take?.status === "RUNNING" || take?.status === "QUEUED" ? (
          <Loader2
            className="size-3 animate-spin text-primary"
            aria-hidden="true"
          />
        ) : null}
      </div>
      {artifact ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`${label} frame`}
          className="aspect-[9/16] w-full object-cover"
          src={`/api/artifacts/${artifact.id}/file`}
        />
      ) : (
        <div className="flex aspect-[9/16] items-center justify-center bg-gradient-to-br from-muted to-background px-3 text-center text-[10px] leading-4 text-muted-foreground">
          {take?.status === "FAILED"
            ? "Generation needs a retry"
            : "Generated frame will appear here"}
        </div>
      )}
    </figure>
  );
}

function SceneTuner({
  scene,
  isSaving,
  onSave,
}: {
  scene: ProductionScene;
  isSaving: boolean;
  onSave: (scene: ProductionScene) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(scene);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaved(false);
    const ok = await onSave(draft);
    setSaved(ok);
  }

  return (
    <details className="group mt-3 rounded-lg border border-border bg-background/45">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Fine-tune scene
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 border-t border-border p-3">
        <TuningField label="One simple shot sentence">
          <textarea
            className="min-h-24 w-full rounded-md border border-border bg-background px-2.5 py-2 text-xs leading-5 outline-none focus:border-primary/60"
            maxLength={280}
            value={draft.shotPrompt}
            onChange={(event) =>
              setDraft({ ...draft, shotPrompt: event.target.value })
            }
          />
        </TuningField>
        <p className="text-[10px] leading-4 text-muted-foreground">
          Mood first, then one primary subject, one action, and one camera move
          · 8–36 words.
        </p>
        <TuningField label="Seconds">
          <input
            className="h-9 w-20 rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary/60"
            max={10}
            min={5}
            type="number"
            value={draft.durationSec}
            onChange={(event) =>
              setDraft({ ...draft, durationSec: Number(event.target.value) })
            }
          />
        </TuningField>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] leading-4 text-muted-foreground">
            Shot edits regenerate this anchor, clip, and dependent downstream
            scenes.
          </p>
          <Button disabled={isSaving} onClick={save} size="sm" type="button">
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : saved ? (
              <Check className="size-3.5" />
            ) : (
              <Save className="size-3.5" />
            )}
            {saved ? "Saved" : "Save tune"}
          </Button>
        </div>
      </div>
    </details>
  );
}

function GenerationHistory({
  takes,
  currentIds,
  artifactById,
}: {
  takes: SceneTake[];
  currentIds: Set<string>;
  artifactById: Map<string, TakeArtifact>;
}) {
  const previous = takes.filter(
    (take) => take.artifactId && !currentIds.has(take.id),
  );

  if (previous.length === 0) return null;

  return (
    <details className="group mt-2">
      <summary className="flex cursor-pointer list-none items-center justify-between px-1 py-2 text-[10px] text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span>{previous.length} previous generation(s) preserved</span>
        <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid grid-cols-4 gap-1.5 pb-1">
        {previous.slice(0, 8).map((take) => {
          const artifact = take.artifactId
            ? artifactById.get(take.artifactId)
            : null;
          if (!artifact) return null;

          return artifact.mimeType.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`${formatEnum(take.kind)} attempt ${take.attempt}`}
              className="aspect-[9/16] w-full rounded-md border border-border object-cover opacity-70"
              key={take.id}
              src={`/api/artifacts/${artifact.id}/file`}
            />
          ) : (
            <div
              className="flex aspect-[9/16] items-center justify-center rounded-md border border-border bg-background text-muted-foreground"
              key={take.id}
              title={`Video attempt ${take.attempt}`}
            >
              <Film className="size-4" aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </details>
  );
}

function TuningField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function getCurrentAnchor(scene: ProductionScene) {
  return (
    scene.takes.find(
      (take) =>
        take.id === scene.selectedKeyframeTakeId &&
        take.kind === "KEYFRAME_START" &&
        take.status === "COMPLETE" &&
        take.artifactId,
    ) ?? null
  );
}

function transitionLabel(mode: ProductionScene["continuityMode"]) {
  if (mode === "MATCH_CUT") return "Matched visual handoff";
  if (mode === "INTENTIONAL_CHANGE") return "Intentional plot change";
  return "Continuous visual handoff";
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
