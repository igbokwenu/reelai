"use client";

import {
  ArrowRight,
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
  startFramePrompt: string;
  endFramePrompt: string;
  videoMotionPrompt: string;
  continuityNotes: string;
  continuityMode: "CONTINUOUS" | "MATCH_CUT" | "INTENTIONAL_CHANGE";
  selectedEndFrameTakeId: string | null;
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
            Each scene travels from its opening frame to its closing frame, then
            hands the visual thread to the next scene.
          </p>
        </div>
        <span className="w-fit rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
          {scenes.length} scenes · one sequence
        </span>
      </div>

      <div className="overflow-x-auto p-4">
        <div className="flex min-w-max items-stretch gap-3">
          {scenes.map((scene, index) => {
            const startTake = getCurrentFrame(scene, "KEYFRAME_START");
            const endTake = getCurrentFrame(scene, "KEYFRAME_END");
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
            const isReady = Boolean(
              startTake?.artifactId && endTake?.artifactId,
            );
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

                <div className="relative mt-3 grid grid-cols-2 gap-2">
                  <FramePreview
                    artifactById={artifactById}
                    label="Opens"
                    take={startTake}
                  />
                  <FramePreview
                    artifactById={artifactById}
                    label="Closes"
                    take={endTake}
                  />
                  <span className="absolute left-1/2 top-[42%] z-10 flex size-7 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card shadow-lg">
                    <ArrowRight
                      className="size-3.5 text-primary"
                      aria-hidden="true"
                    />
                  </span>
                </div>

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
                    {isReady ? "Endpoints ready" : "Frames not generated"}
                  </span>
                  <span className="text-muted-foreground">
                    {formatEnum(scene.status)}
                  </span>
                </div>

                {selectedVideo?.artifactId ? (
                  <video
                    aria-label={`Selected clip for scene ${scene.index}`}
                    className="mt-3 aspect-video w-full rounded-lg border border-border bg-black object-cover"
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
                      [startTake?.id, endTake?.id, selectedVideo?.id].filter(
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
        <TuningField label="Opening frame direction">
          <textarea
            className="min-h-24 w-full rounded-md border border-border bg-background px-2.5 py-2 text-xs leading-5 outline-none focus:border-primary/60"
            value={draft.startFramePrompt}
            onChange={(event) =>
              setDraft({ ...draft, startFramePrompt: event.target.value })
            }
          />
        </TuningField>
        <TuningField label="Closing frame direction">
          <textarea
            className="min-h-24 w-full rounded-md border border-border bg-background px-2.5 py-2 text-xs leading-5 outline-none focus:border-primary/60"
            value={draft.endFramePrompt}
            onChange={(event) =>
              setDraft({ ...draft, endFramePrompt: event.target.value })
            }
          />
        </TuningField>
        <TuningField label="Motion between frames">
          <textarea
            className="min-h-20 w-full rounded-md border border-border bg-background px-2.5 py-2 text-xs leading-5 outline-none focus:border-primary/60"
            value={draft.videoMotionPrompt}
            onChange={(event) =>
              setDraft({ ...draft, videoMotionPrompt: event.target.value })
            }
          />
        </TuningField>
        <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-2">
          <TuningField label="Stitch to prior scene">
            <select
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary/60"
              value={draft.continuityMode}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  continuityMode: event.target
                    .value as ProductionScene["continuityMode"],
                })
              }
            >
              <option value="CONTINUOUS">Continuous</option>
              <option value="MATCH_CUT">Match cut</option>
              <option value="INTENTIONAL_CHANGE">Plot change</option>
            </select>
          </TuningField>
          <TuningField label="Seconds">
            <input
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-primary/60"
              max={15}
              min={4}
              type="number"
              value={draft.durationSec}
              onChange={(event) =>
                setDraft({ ...draft, durationSec: Number(event.target.value) })
              }
            />
          </TuningField>
        </div>
        <TuningField label="Continuity note">
          <textarea
            className="min-h-16 w-full rounded-md border border-border bg-background px-2.5 py-2 text-xs leading-5 outline-none focus:border-primary/60"
            value={draft.continuityNotes}
            onChange={(event) =>
              setDraft({ ...draft, continuityNotes: event.target.value })
            }
          />
        </TuningField>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] leading-4 text-muted-foreground">
            Frame edits mark this scene for a fresh recommended generation.
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

function getCurrentFrame(
  scene: ProductionScene,
  kind: "KEYFRAME_START" | "KEYFRAME_END",
) {
  const selectedId =
    kind === "KEYFRAME_START"
      ? scene.selectedKeyframeTakeId
      : scene.selectedEndFrameTakeId;
  const explicitlySelected = scene.takes.find(
    (take) =>
      take.id === selectedId &&
      take.kind === kind &&
      take.status === "COMPLETE" &&
      take.artifactId,
  );

  if (explicitlySelected) return explicitlySelected;

  // Compatibility for projects created before opening/closing selections were split.
  const legacyPointer = scene.takes.find(
    (take) =>
      take.id === scene.selectedKeyframeTakeId &&
      take.status === "COMPLETE" &&
      take.artifactId,
  );
  if (!legacyPointer) return null;

  if (legacyPointer.kind === kind) return legacyPointer;

  return (
    scene.takes.find(
      (take) =>
        take.kind === kind &&
        take.attempt === legacyPointer.attempt &&
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
