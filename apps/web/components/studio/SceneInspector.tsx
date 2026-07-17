"use client";

import type { ReactNode } from "react";
import {
  Captions,
  Clock3,
  Film,
  ImagePlus,
  Loader2,
  RefreshCw,
  Shuffle,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export type ContinuityMode = "CONTINUOUS" | "MATCH_CUT" | "INTENTIONAL_CHANGE";
export type TransitionStyle =
  "CUT" | "FADE" | "SLIDE" | "WIPE" | "IRIS" | "CLOCK_WIPE";

export type EditableScene = {
  id: string;
  index: number;
  durationSec: number;
  captionText: string;
  voiceoverText: string;
  shotPrompt: string;
  continuityNotes: string;
  continuityMode: ContinuityMode;
  transitionStyle: TransitionStyle;
  status?: string;
  selectedKeyframeTakeId?: string | null;
  takes?: Array<{
    id: string;
    kind: "KEYFRAME_START" | "KEYFRAME_END" | "VIDEO";
    artifactId: string | null;
    status: string;
    notes?: string | null;
    createdAt: Date | string;
  }>;
};

export function SceneInspector({
  scene,
  isLastScene,
  onChange,
  onRegenerateAnchor,
  isRegeneratingAnchor,
  canRegenerateAnchor,
}: {
  scene: EditableScene | null;
  isLastScene: boolean;
  onChange: (scene: EditableScene) => void;
  onRegenerateAnchor: (sceneId: string) => Promise<void>;
  isRegeneratingAnchor: boolean;
  canRegenerateAnchor: boolean;
}) {
  if (!scene) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        Select a scene in the filmstrip to refine its edit.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background/55">
      <div className="border-b border-border bg-gradient-to-br from-white/[0.04] to-transparent p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Scene {String(scene.index).padStart(2, "0")}
            </p>
            <h3 className="mt-1 text-base font-semibold">Edit the shot</h3>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={!canRegenerateAnchor || isRegeneratingAnchor}
              onClick={() => onRegenerateAnchor(scene.id)}
              size="sm"
              tooltip={
                canRegenerateAnchor
                  ? `Regenerates only Scene ${scene.index}'s ${scene.index === 1 ? "opening frame" : "anchor"}; other scene images and clips stay preserved.`
                  : "Save and approve storyboard edits before generating this frame."
              }
              tooltipSide="bottom"
              type="button"
              variant="outline"
            >
              {isRegeneratingAnchor ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : scene.selectedKeyframeTakeId ? (
                <RefreshCw className="size-3.5" />
              ) : (
                <ImagePlus className="size-3.5" />
              )}
              {scene.selectedKeyframeTakeId
                ? `Regenerate ${scene.index === 1 ? "opening frame" : "frame"}`
                : `Generate ${scene.index === 1 ? "opening frame" : "frame"}`}
            </Button>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-background/70 px-2.5 py-2">
              <Clock3
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                aria-label="Scene duration in seconds"
                className="w-10 bg-transparent text-right text-sm font-semibold outline-none"
                max={10}
                min={5}
                type="number"
                value={scene.durationSec}
                onChange={(event) =>
                  onChange({
                    ...scene,
                    durationSec: Number(event.target.value),
                  })
                }
              />
              <span className="text-xs text-muted-foreground">sec</span>
            </label>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-4">
        <section className="grid gap-3">
          <SectionLabel icon={Captions} label="Story & sound" />
          <Field
            label={
              isLastScene
                ? "Final closer / call to action"
                : "Editorial scene label (not rendered)"
            }
          >
            <textarea
              className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
              maxLength={140}
              value={scene.captionText}
              onChange={(event) =>
                onChange({ ...scene, captionText: event.target.value })
              }
            />
            <Counter current={scene.captionText.length} max={140} />
            <p className="text-[11px] leading-5 text-muted-foreground">
              {isLastScene
                ? "This is the reel's only text overlay. Keep it concise and complementary to the narration."
                : "Used to organize the storyboard. Earlier scenes stay visually clean and rely on narration."}
            </p>
          </Field>
          <Field label="Voiceover">
            <textarea
              className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
              maxLength={600}
              value={scene.voiceoverText}
              onChange={(event) =>
                onChange({ ...scene, voiceoverText: event.target.value })
              }
            />
            <Counter current={scene.voiceoverText.length} max={600} />
            <p className="text-[11px] leading-5 text-muted-foreground">
              {wordCount(scene.voiceoverText)}/
              {Math.floor(scene.durationSec * 2.5)} recommended words for a
              natural read · leave blank for an intentionally silent scene.
            </p>
          </Field>
        </section>

        <section className="grid gap-3 border-t border-border pt-5">
          <SectionLabel icon={Film} label="AI shot direction" />
          <Field label="One directed shot sentence">
            <textarea
              className="min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
              maxLength={480}
              value={scene.shotPrompt}
              onChange={(event) =>
                onChange({ ...scene, shotPrompt: event.target.value })
              }
            />
            <p className="text-[11px] leading-5 text-muted-foreground">
              Mood first · one focal action arc · optional simple supporting
              motion · one camera behavior · 14–60 words.
            </p>
          </Field>
        </section>

        <section className="grid gap-3 border-t border-border pt-5">
          <SectionLabel icon={Shuffle} label="Scene handoff" />
          <Field label="Transition into this scene">
            <select
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-55"
              disabled={
                scene.index === 1 || scene.continuityMode === "MATCH_CUT"
              }
              value={scene.transitionStyle}
              onChange={(event) =>
                onChange({
                  ...scene,
                  transitionStyle: event.target.value as TransitionStyle,
                })
              }
            >
              <option value="CUT">Clean cut</option>
              <option value="FADE">Soft fade</option>
              <option value="SLIDE">Directional slide</option>
              <option value="WIPE">Editorial wipe</option>
              <option value="IRIS">Hero iris</option>
              <option value="CLOCK_WIPE">Circular clock wipe</option>
            </select>
            <p className="text-[11px] leading-5 text-muted-foreground">
              Reel AI chooses a restrained handoff that supports the product,
              motion, and continuity. Match cuts stay effect-free.
            </p>
          </Field>
        </section>
      </div>
    </div>
  );
}

function SectionLabel({
  label,
  icon: Icon,
}: {
  label: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-foreground">
      <Icon className="size-4 text-primary" aria-hidden="true" />
      {label}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Counter({ current, max }: { current: number; max: number }) {
  return (
    <span className="text-right text-[11px] text-muted-foreground">
      {current}/{max}
    </span>
  );
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}
