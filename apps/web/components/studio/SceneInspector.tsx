"use client";

import type { ReactNode } from "react";
import { Captions, Clock3, Film, type LucideIcon } from "lucide-react";

export type ContinuityMode = "CONTINUOUS" | "MATCH_CUT" | "INTENTIONAL_CHANGE";

export type EditableScene = {
  id: string;
  index: number;
  durationSec: number;
  captionText: string;
  voiceoverText: string;
  shotPrompt: string;
  continuityNotes: string;
  continuityMode: ContinuityMode;
  status?: string;
  selectedKeyframeTakeId?: string | null;
  takes?: Array<{
    id: string;
    kind: "KEYFRAME_START" | "KEYFRAME_END" | "VIDEO";
    artifactId: string | null;
    status: string;
    createdAt: Date | string;
  }>;
};

export function SceneInspector({
  scene,
  onChange,
}: {
  scene: EditableScene | null;
  onChange: (scene: EditableScene) => void;
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
                onChange({ ...scene, durationSec: Number(event.target.value) })
              }
            />
            <span className="text-xs text-muted-foreground">sec</span>
          </label>
        </div>
      </div>

      <div className="grid gap-5 p-4">
        <section className="grid gap-3">
          <SectionLabel icon={Captions} label="Story & sound" />
          <Field label="On-screen caption">
            <textarea
              className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
              maxLength={140}
              value={scene.captionText}
              onChange={(event) =>
                onChange({ ...scene, captionText: event.target.value })
              }
            />
            <Counter current={scene.captionText.length} max={140} />
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
