"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Save,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  SceneInspector,
  type EditableScene,
} from "@/components/studio/SceneInspector";
import { Button } from "@/components/ui/button";

type Storyboard = {
  id: string;
  title: string;
  script: string;
  bgmPrompt: string | null;
  bgmEnabled: boolean;
  status: string;
  scenes: EditableScene[];
};

type Concept = {
  id: string;
  title: string;
  selected: boolean;
};

type Job = {
  id: string;
  type: string;
  status: string;
  model: string | null;
  error: string | null;
  output: unknown;
};

type PolicyWarning = {
  severity: "info" | "warning" | "blocker";
  sceneIndex: number | null;
  message: string;
  mitigation: string;
};

export function StoryboardTimeline({
  projectId,
  selectedConcept,
  storyboard,
  latestStoryboardJob,
  latestPolicyJob,
}: {
  projectId: string;
  selectedConcept: Concept | null;
  storyboard: Storyboard | null;
  latestStoryboardJob: Job | null;
  latestPolicyJob: Job | null;
}) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(latestStoryboardJob);
  const [isStarting, setIsStarting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(latestStoryboardJob?.error ?? null);
  const [draft, setDraft] = useState<Storyboard | null>(storyboard);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(
    storyboard?.scenes[0]?.id ?? null,
  );
  const isRunning = job?.status === "QUEUED" || job?.status === "RUNNING";
  const selectedScene = draft?.scenes.find((scene) => scene.id === selectedSceneId) ?? null;
  const warnings = useMemo(
    () => extractWarnings(latestPolicyJob?.output ?? job?.output),
    [job?.output, latestPolicyJob?.output],
  );
  const totalDuration = draft?.scenes.reduce(
    (sum, scene) => sum + scene.durationSec,
    0,
  ) ?? 0;

  useEffect(() => {
    if (!job || !isRunning) {
      return;
    }

    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/${job.id}`);

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as { job: Job };
      setJob(data.job);

      if (data.job.status === "COMPLETE") {
        setError(null);
        router.refresh();
      }

      if (data.job.status === "FAILED") {
        setError(data.job.error ?? "Storyboard generation failed.");
        router.refresh();
      }
    }, 1500);

    return () => window.clearInterval(interval);
  }, [isRunning, job, router]);

  async function generateStoryboard() {
    setIsStarting(true);
    setError(null);

    const response = await fetch(`/api/projects/${projectId}/storyboard`, {
      method: "POST",
    });
    const data = (await response.json()) as { job?: Job; error?: string };

    setIsStarting(false);

    if (!response.ok || !data.job) {
      setError(data.error ?? "Storyboard generation could not start.");
      return;
    }

    setJob(data.job);

    if (data.job.status === "FAILED") {
      setError(data.job.error ?? "Storyboard generation failed.");
    }

    router.refresh();
  }

  async function saveStoryboard() {
    if (!draft) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const response = await fetch(`/api/storyboards/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        script: draft.script,
        bgmEnabled: draft.bgmEnabled,
        bgmPrompt: draft.bgmPrompt,
        scenes: draft.scenes,
      }),
    });
    const data = (await response.json()) as { error?: string };

    setIsSaving(false);

    if (!response.ok) {
      setError(data.error ?? "Storyboard save failed.");
      return;
    }

    router.refresh();
  }

  function updateScene(scene: EditableScene) {
    setDraft((current) =>
      current
        ? {
            ...current,
            scenes: current.scenes.map((item) =>
              item.id === scene.id ? scene : item,
            ),
          }
        : current,
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium">Storyboard Editor</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Human approval loop: select concept, generate storyboard, review policy notes, then approve for generation.
          </p>
        </div>
        <Button
          disabled={!selectedConcept || isStarting || isRunning}
          onClick={generateStoryboard}
          size="sm"
        >
          {isStarting || isRunning ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-4" aria-hidden="true" />
          )}
          {draft ? "Regenerate Storyboard" : "Generate Storyboard"}
        </Button>
      </div>

      {selectedConcept ? (
        <div className="rounded-md border border-border bg-background/60 p-3 text-sm">
          <span className="text-muted-foreground">Selected direction: </span>
          <span className="font-medium">{selectedConcept.title}</span>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Select exactly one concept before storyboard generation becomes available.
        </div>
      )}

      {job ? (
        <div className="grid gap-2 rounded-md border border-border bg-background/60 p-3 text-sm md:grid-cols-3">
          <span className="font-medium">{formatEnum(job.status)}</span>
          <span className="text-muted-foreground">Model: {job.model ?? "pending"}</span>
          <span className="text-muted-foreground">Job: {job.id}</span>
        </div>
      ) : null}

      {error ? (
        <div className="flex gap-2 rounded-md border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="grid gap-2 rounded-md border border-amber-400/35 bg-amber-400/10 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-200">
            <AlertTriangle className="size-4" aria-hidden="true" />
            Claim and policy review
          </div>
          {warnings.map((warning, index) => (
            <div className="rounded-md bg-background/50 p-2 text-sm" key={`${warning.message}-${index}`}>
              <p className="font-medium">
                {formatEnum(warning.severity)}
                {warning.sceneIndex ? `, scene ${warning.sceneIndex}` : ""}
              </p>
              <p className="mt-1 text-muted-foreground">{warning.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">{warning.mitigation}</p>
            </div>
          ))}
        </div>
      ) : null}

      {draft ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-md border border-border bg-background/50 p-4">
              <label className="grid gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Storyboard Title
                </span>
                <input
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Script
                </span>
                <textarea
                  className="min-h-24 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={draft.script}
                  onChange={(event) =>
                    setDraft({ ...draft, script: event.target.value })
                  }
                />
              </label>
              <div className="grid gap-3 md:grid-cols-[140px_minmax(0,1fr)]">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    checked={draft.bgmEnabled}
                    type="checkbox"
                    onChange={(event) =>
                      setDraft({ ...draft, bgmEnabled: event.target.checked })
                    }
                  />
                  BGM enabled
                </label>
                <input
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="BGM prompt"
                  value={draft.bgmPrompt ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, bgmPrompt: event.target.value })
                  }
                />
              </div>
            </div>

            <div className="rounded-md border border-border bg-background/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ScrollText className="size-4 text-primary" aria-hidden="true" />
                  {draft.scenes.length} scenes, {totalDuration}s
                </div>
                <Button disabled={isSaving} onClick={saveStoryboard} size="sm">
                  {isSaving ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-4" aria-hidden="true" />
                  )}
                  Save Edits
                </Button>
              </div>
              <div className="grid gap-3">
                {draft.scenes.map((scene) => (
                  <button
                    className={`rounded-md border p-3 text-left transition-colors ${
                      scene.id === selectedSceneId
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:bg-accent"
                    }`}
                    key={scene.id}
                    onClick={() => setSelectedSceneId(scene.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">Scene {scene.index}</span>
                      <span className="text-xs text-muted-foreground">{scene.durationSec}s</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{scene.captionText}</p>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {scene.videoMotionPrompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                Approval checkpoint
              </div>
              <p className="mt-1 text-muted-foreground">
                Review and save scenes here before Phase 5 keyframe/video generation.
              </p>
            </div>
          </div>

          <SceneInspector scene={selectedScene} onChange={updateScene} />
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          No storyboard yet. Generate one after selecting a concept.
        </div>
      )}
    </div>
  );
}

function extractWarnings(value: unknown): PolicyWarning[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const warnings = Array.isArray(record.warnings) ? record.warnings : [];

  return warnings
    .map((warning) => {
      if (!warning || typeof warning !== "object") {
        return null;
      }

      const item = warning as Record<string, unknown>;
      const severity = String(item.severity);

      return {
        severity:
          severity === "blocker" || severity === "warning" || severity === "info"
            ? severity
            : "info",
        sceneIndex:
          typeof item.sceneIndex === "number" ? item.sceneIndex : null,
        message: String(item.message ?? "Policy review note"),
        mitigation: String(item.mitigation ?? "Review before generation."),
      } satisfies PolicyWarning;
    })
    .filter((warning): warning is PolicyWarning => Boolean(warning));
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
