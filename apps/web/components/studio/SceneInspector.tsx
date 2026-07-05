"use client";

import type { ReactNode } from "react";
import {
  Captions,
  Clock,
  Film,
  Mic2,
  StickyNote,
  type LucideIcon,
} from "lucide-react";

export type EditableScene = {
  id: string;
  index: number;
  durationSec: number;
  captionText: string;
  voiceoverText: string;
  startFramePrompt: string;
  endFramePrompt: string;
  videoMotionPrompt: string;
  continuityNotes: string;
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
      <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        Select a storyboard scene to edit caption, voiceover, prompts, duration, and continuity notes.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div>
        <p className="text-sm font-medium">Scene {scene.index} Inspector</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Changes persist to the storyboard and will guide later keyframe/video generation.
        </p>
      </div>

      <Field label="Duration" icon={Clock}>
        <input
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          max={15}
          min={4}
          type="number"
          value={scene.durationSec}
          onChange={(event) =>
            onChange({
              ...scene,
              durationSec: Number(event.target.value),
            })
          }
        />
      </Field>

      <Field label="Caption" icon={Captions}>
        <textarea
          className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={scene.captionText}
          onChange={(event) =>
            onChange({ ...scene, captionText: event.target.value })
          }
        />
      </Field>

      <Field label="Voiceover" icon={Mic2}>
        <textarea
          className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={scene.voiceoverText}
          onChange={(event) =>
            onChange({ ...scene, voiceoverText: event.target.value })
          }
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {scene.voiceoverText.length}/600 characters
        </p>
      </Field>

      <Field label="Start Frame Prompt" icon={Film}>
        <textarea
          className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={scene.startFramePrompt}
          onChange={(event) =>
            onChange({ ...scene, startFramePrompt: event.target.value })
          }
        />
      </Field>

      <Field label="End Frame Prompt" icon={Film}>
        <textarea
          className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={scene.endFramePrompt}
          onChange={(event) =>
            onChange({ ...scene, endFramePrompt: event.target.value })
          }
        />
      </Field>

      <Field label="Motion Prompt" icon={Film}>
        <textarea
          className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={scene.videoMotionPrompt}
          onChange={(event) =>
            onChange({ ...scene, videoMotionPrompt: event.target.value })
          }
        />
      </Field>

      <Field label="Continuity Notes" icon={StickyNote}>
        <textarea
          className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={scene.continuityNotes}
          onChange={(event) =>
            onChange({ ...scene, continuityNotes: event.target.value })
          }
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </span>
      {children}
    </label>
  );
}
