"use client";

import {
  AlertTriangle,
  ArrowRight,
  AudioLines,
  Check,
  ChevronDown,
  CircleDot,
  Clapperboard,
  ImageIcon,
  Link2,
  Loader2,
  PackageCheck,
  Palette,
  RefreshCw,
  Save,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  SceneInspector,
  type ContinuityMode,
  type EditableScene,
} from "@/components/studio/SceneInspector";
import { Button } from "@/components/ui/button";

type Storyboard = {
  id: string;
  title: string;
  script: string;
  productContinuity: string;
  characterContinuity: string;
  visualContinuity: string;
  bgmPrompt: string | null;
  bgmEnabled: boolean;
  status: string;
  scenes: EditableScene[];
};

type Concept = {
  id: string;
  title: string;
  selected: boolean;
  strategy?: string;
  visualStyle?: string;
  previewArtifactId?: string | null;
};

type Artifact = {
  id: string;
  mimeType: string;
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
  artifacts,
  latestStoryboardJob,
  latestPolicyJob,
}: {
  projectId: string;
  selectedConcept: Concept | null;
  storyboard: Storyboard | null;
  artifacts: Artifact[];
  latestStoryboardJob: Job | null;
  latestPolicyJob: Job | null;
}) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(latestStoryboardJob);
  const [isStarting, setIsStarting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(
    latestStoryboardJob?.error ?? null,
  );
  const [draft, setDraft] = useState<Storyboard | null>(storyboard);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(
    storyboard?.scenes[0]?.id ?? null,
  );
  const isRunning = job?.status === "QUEUED" || job?.status === "RUNNING";
  const selectedScene =
    draft?.scenes.find((scene) => scene.id === selectedSceneId) ?? null;
  const warnings = useMemo(
    () => extractWarnings(latestPolicyJob?.output ?? job?.output),
    [job?.output, latestPolicyJob?.output],
  );
  const totalDuration =
    draft?.scenes.reduce((sum, scene) => sum + scene.durationSec, 0) ?? 0;
  const artifactIds = useMemo(
    () => new Set(artifacts.map((artifact) => artifact.id)),
    [artifacts],
  );
  const generatedFrameCount =
    draft?.scenes.reduce(
      (count, scene) =>
        count +
        (["KEYFRAME_START", "KEYFRAME_END"] as const).filter((kind) =>
          scene.takes?.some(
            (take) =>
              take.kind === kind &&
              take.status === "COMPLETE" &&
              take.artifactId &&
              artifactIds.has(take.artifactId),
          ),
        ).length,
      0,
    ) ?? 0;

  useEffect(() => {
    if (!job || !isRunning) return;

    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/jobs/${job.id}`);
      if (!response.ok) return;

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
    setSaved(false);
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
    if (!draft) return;

    setIsSaving(true);
    setSaved(false);
    setError(null);

    const response = await fetch(`/api/storyboards/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        script: draft.script,
        productContinuity: draft.productContinuity,
        characterContinuity: draft.characterContinuity,
        visualContinuity: draft.visualContinuity,
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

    setDraft((current) =>
      current ? { ...current, status: "APPROVED" } : current,
    );
    setIsDirty(false);
    setSaved(true);
    router.refresh();
  }

  function updateDraft(change: Partial<Storyboard>) {
    setDraft((current) => (current ? { ...current, ...change } : current));
    setIsDirty(true);
    setSaved(false);
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
    setIsDirty(true);
    setSaved(false);
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <Clapperboard className="size-4" aria-hidden="true" />
            Story assembly
          </div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight">
            See the whole reel before you generate it
          </h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Review every first and last frame, then define how each cut carries
            product, character, and visual details into the next scene.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={!selectedConcept || isStarting || isRunning}
            onClick={generateStoryboard}
            size="sm"
            variant="outline"
          >
            {isStarting || isRunning ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : draft ? (
              <RefreshCw className="size-4" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            {draft ? "Regenerate plan" : "Generate storyboard"}
          </Button>
          {draft ? (
            <Button disabled={isSaving} onClick={saveStoryboard} size="sm">
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : saved ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              {saved
                ? "Approved"
                : draft.status === "APPROVED"
                  ? "Save changes"
                  : "Approve storyboard"}
            </Button>
          ) : null}
        </div>
      </div>

      {selectedConcept ? (
        <ConceptNorthStar concept={selectedConcept} artifacts={artifacts} />
      ) : (
        <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          Select one concept first. Its strategy and visual style become the
          north star for this storyboard.
        </div>
      )}

      {job ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-background/60 px-4 py-3 text-xs">
          <span className="flex items-center gap-2 font-medium">
            <CircleDot
              className={`size-3.5 ${isRunning ? "animate-pulse text-primary" : "text-muted-foreground"}`}
              aria-hidden="true"
            />
            {formatEnum(job.status)}
          </span>
          <span className="text-muted-foreground">
            Model {job.model ?? "pending"}
          </span>
          <span className="text-muted-foreground">Run {job.id}</span>
        </div>
      ) : null}

      {error ? (
        <div className="flex gap-2 rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>{error}</span>
        </div>
      ) : null}

      {warnings.length > 0 ? <PolicyReview warnings={warnings} /> : null}

      {draft ? (
        <>
          <details className="group rounded-xl border border-border bg-background/45">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <AudioLines
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                Story, script & soundtrack
              </span>
              <ChevronDown
                className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <div className="grid gap-4 border-t border-border p-4">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Storyboard title
                </span>
                <input
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                  value={draft.title}
                  onChange={(event) =>
                    updateDraft({ title: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Full script
                </span>
                <textarea
                  className="min-h-28 rounded-lg border border-border bg-background px-3 py-2.5 text-sm leading-6 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10"
                  value={draft.script}
                  onChange={(event) =>
                    updateDraft({ script: event.target.value })
                  }
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
                <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                  <input
                    checked={draft.bgmEnabled}
                    type="checkbox"
                    onChange={(event) =>
                      updateDraft({ bgmEnabled: event.target.checked })
                    }
                  />
                  Background music
                </label>
                <input
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
                  disabled={!draft.bgmEnabled}
                  placeholder="Soundtrack mood and pacing"
                  value={draft.bgmPrompt ?? ""}
                  onChange={(event) =>
                    updateDraft({ bgmPrompt: event.target.value })
                  }
                />
              </div>
            </div>
          </details>

          <section className="overflow-hidden rounded-xl border border-border bg-background/45">
            <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Link2 className="size-4 text-primary" aria-hidden="true" />
                  Continuity bible
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  These invariants are injected into every keyframe and motion
                  prompt. Scene-level intentional changes override only what the
                  plot requires.
                </p>
              </div>
              <span className="w-fit rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                3 continuity locks
              </span>
            </div>
            <div className="grid gap-3 p-4 lg:grid-cols-3">
              <ContinuityField
                icon={PackageCheck}
                label="Product lock"
                value={draft.productContinuity}
                onChange={(value) => updateDraft({ productContinuity: value })}
              />
              <ContinuityField
                icon={UserRoundCheck}
                label="Character lock"
                value={draft.characterContinuity}
                onChange={(value) =>
                  updateDraft({ characterContinuity: value })
                }
              />
              <ContinuityField
                icon={Palette}
                label="Visual world"
                value={draft.visualContinuity}
                onChange={(value) => updateDraft({ visualContinuity: value })}
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-[#0c0e0d]">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Clapperboard
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  Filmstrip
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {draft.scenes.length} scenes · {totalDuration}s ·{" "}
                  {generatedFrameCount}/{draft.scenes.length * 2} generated
                  frames
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className={`size-2 rounded-full ${isDirty ? "bg-amber-400" : "bg-primary"}`}
                />
                {isDirty
                  ? "Unsaved changes"
                  : draft.status === "APPROVED"
                    ? "Approved for production"
                    : "Ready for review"}
              </div>
            </div>
            <div className="overflow-x-auto p-4 pb-5">
              <div className="flex min-w-max items-stretch">
                {draft.scenes.map((scene, index) => (
                  <div className="flex items-stretch" key={scene.id}>
                    <SceneFilmCard
                      artifacts={artifactIds}
                      isSelected={scene.id === selectedSceneId}
                      onSelect={() => setSelectedSceneId(scene.id)}
                      scene={scene}
                    />
                    {index < draft.scenes.length - 1 ? (
                      <StitchConnector nextScene={draft.scenes[index + 1]!} />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(420px,1.15fr)]">
            <SelectedSceneSummary scene={selectedScene} />
            <SceneInspector scene={selectedScene} onChange={updateScene} />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Check className="size-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Approval unlocks production
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Saving approves all scenes and makes their continuity-aware
                  first and last frame briefs available to keyframe generation.
                </p>
              </div>
            </div>
            <Button disabled={isSaving} onClick={saveStoryboard} size="sm">
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
              {draft.status === "APPROVED"
                ? "Save & keep approved"
                : "Approve storyboard"}
            </Button>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Sparkles
            className="mx-auto size-5 text-primary"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-medium">
            Your visual plan starts here
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
            Generate a storyboard from the selected concept to create a
            continuity-aware first-to-last-frame plan.
          </p>
        </div>
      )}
    </div>
  );
}

function ConceptNorthStar({
  concept,
  artifacts,
}: {
  concept: Concept;
  artifacts: Artifact[];
}) {
  const hasPreview = Boolean(
    concept.previewArtifactId &&
    artifacts.some((artifact) => artifact.id === concept.previewArtifactId),
  );

  return (
    <div className="grid overflow-hidden rounded-xl border border-border bg-gradient-to-r from-primary/[0.09] via-background/70 to-background/40 sm:grid-cols-[92px_minmax(0,1fr)]">
      <div className="relative hidden min-h-28 overflow-hidden border-r border-border bg-muted sm:block">
        {hasPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt="Selected concept preview"
            className="absolute inset-0 size-full object-cover"
            src={`/api/artifacts/${concept.previewArtifactId}/file`}
          />
        ) : (
          <Sparkles
            className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-primary"
            aria-hidden="true"
          />
        )}
      </div>
      <div className="p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
          Selected direction
        </p>
        <div className="mt-1 flex flex-col gap-1 lg:flex-row lg:items-baseline lg:gap-3">
          <p className="text-sm font-semibold">{concept.title}</p>
          {concept.visualStyle ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {concept.visualStyle}
            </p>
          ) : null}
        </div>
        {concept.strategy ? (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {concept.strategy}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ContinuityField({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: typeof PackageCheck;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 rounded-xl border border-border bg-card/70 p-3.5">
      <span className="flex items-center gap-2 text-xs font-semibold">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        {label}
      </span>
      <textarea
        className="min-h-28 resize-y border-0 bg-transparent text-xs leading-5 text-muted-foreground outline-none"
        maxLength={700}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="text-right text-[10px] text-muted-foreground">
        {value.length}/700
      </span>
    </label>
  );
}

function SceneFilmCard({
  scene,
  artifacts,
  isSelected,
  onSelect,
}: {
  scene: EditableScene;
  artifacts: Set<string>;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={isSelected}
      className={`w-[326px] rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        isSelected
          ? "border-primary bg-primary/[0.08] shadow-[0_0_0_1px_rgba(183,255,60,0.08)]"
          : "border-border bg-card/75 hover:border-border/80 hover:bg-card"
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Scene {String(scene.index).padStart(2, "0")}
        </span>
        <span className="rounded-full bg-background/80 px-2 py-1 text-[10px] text-muted-foreground">
          {scene.durationSec}s
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <FramePreview
          artifacts={artifacts}
          label="First"
          position="KEYFRAME_START"
          scene={scene}
        />
        <FramePreview
          artifacts={artifacts}
          label="Last"
          position="KEYFRAME_END"
          scene={scene}
        />
      </div>
      <p className="mt-3 line-clamp-2 min-h-10 text-sm font-medium leading-5">
        {scene.captionText}
      </p>
      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
        {scene.videoMotionPrompt}
      </p>
    </button>
  );
}

function FramePreview({
  scene,
  position,
  label,
  artifacts,
}: {
  scene: EditableScene;
  position: "KEYFRAME_START" | "KEYFRAME_END";
  label: string;
  artifacts: Set<string>;
}) {
  const take = scene.takes?.find(
    (candidate) =>
      candidate.kind === position &&
      candidate.status === "COMPLETE" &&
      candidate.artifactId &&
      artifacts.has(candidate.artifactId),
  );
  const prompt =
    position === "KEYFRAME_START"
      ? scene.startFramePrompt
      : scene.endFramePrompt;

  return (
    <div className="relative aspect-[9/14] overflow-hidden rounded-lg border border-border bg-gradient-to-br from-muted via-background to-primary/10">
      {take?.artifactId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`Scene ${scene.index} ${label.toLowerCase()} frame`}
          className="absolute inset-0 size-full object-cover"
          src={`/api/artifacts/${take.artifactId}/file`}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col justify-end p-2.5">
          <ImageIcon
            className="mb-auto size-4 text-primary/70"
            aria-hidden="true"
          />
          <p className="line-clamp-4 text-[9px] leading-3.5 text-muted-foreground">
            {prompt}
          </p>
        </div>
      )}
      <span className="absolute left-2 top-2 rounded-md border border-white/10 bg-black/65 px-1.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur">
        {label}
      </span>
      <span className="absolute bottom-2 right-2 rounded-md bg-black/65 px-1.5 py-1 text-[8px] text-white/70 backdrop-blur">
        {take
          ? scene.selectedKeyframeTakeId
            ? "Generated"
            : "Previous take"
          : "Frame brief"}
      </span>
    </div>
  );
}

function StitchConnector({ nextScene }: { nextScene: EditableScene }) {
  const styles: Record<ContinuityMode, string> = {
    CONTINUOUS: "border-primary/25 bg-primary/10 text-primary",
    MATCH_CUT: "border-sky-400/25 bg-sky-400/10 text-sky-300",
    INTENTIONAL_CHANGE: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  };

  return (
    <div className="flex w-28 shrink-0 flex-col items-center justify-center gap-2 px-3 text-center">
      <div className="flex w-full items-center gap-1 text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        <ArrowRight className="size-4" aria-hidden="true" />
        <span className="h-px flex-1 bg-border" />
      </div>
      <span
        className={`rounded-lg border px-2 py-1.5 text-[9px] font-semibold uppercase leading-3 tracking-[0.1em] ${styles[nextScene.continuityMode]}`}
      >
        {formatEnum(nextScene.continuityMode)}
      </span>
    </div>
  );
}

function SelectedSceneSummary({ scene }: { scene: EditableScene | null }) {
  if (!scene) return null;

  return (
    <div className="rounded-xl border border-border bg-background/45 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
        Selected scene
      </p>
      <h3 className="mt-2 text-lg font-semibold">
        Scene {scene.index} · {scene.durationSec} seconds
      </h3>
      <div className="mt-4 grid gap-4">
        <SummaryBlock label="Voiceover" value={scene.voiceoverText} />
        <SummaryBlock label="Motion" value={scene.videoMotionPrompt} />
        <SummaryBlock
          label={
            scene.continuityMode === "INTENTIONAL_CHANGE"
              ? "Intentional change"
              : "Continuity handoff"
          }
          value={scene.continuityNotes}
        />
      </div>
    </div>
  );
}

function SummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6">{value}</p>
    </div>
  );
}

function PolicyReview({ warnings }: { warnings: PolicyWarning[] }) {
  const blockers = warnings.filter(
    (warning) => warning.severity === "blocker",
  ).length;

  return (
    <details className="group rounded-xl border border-amber-400/25 bg-amber-400/[0.06]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 font-medium text-amber-200">
          <AlertTriangle className="size-4" aria-hidden="true" />
          Claim & policy review · {warnings.length}{" "}
          {warnings.length === 1 ? "note" : "notes"}
          {blockers ? ` · ${blockers} blocker` : ""}
        </span>
        <ChevronDown
          className="size-4 text-amber-200/70 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="grid gap-2 border-t border-amber-400/20 p-3">
        {warnings.map((warning, index) => (
          <div
            className="rounded-lg bg-background/55 p-3 text-sm"
            key={`${warning.message}-${index}`}
          >
            <p className="font-medium">
              {formatEnum(warning.severity)}
              {warning.sceneIndex ? ` · Scene ${warning.sceneIndex}` : ""}
            </p>
            <p className="mt-1 text-muted-foreground">{warning.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {warning.mitigation}
            </p>
          </div>
        ))}
      </div>
    </details>
  );
}

function extractWarnings(value: unknown): PolicyWarning[] {
  if (!value || typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const warnings = Array.isArray(record.warnings) ? record.warnings : [];

  return warnings
    .map((warning) => {
      if (!warning || typeof warning !== "object") return null;

      const item = warning as Record<string, unknown>;
      const severity = String(item.severity);

      return {
        severity:
          severity === "blocker" ||
          severity === "warning" ||
          severity === "info"
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
