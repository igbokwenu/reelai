"use client";

import {
  Aperture,
  AlertTriangle,
  ArrowRight,
  Check,
  FileImage,
  Globe2,
  Info,
  Loader2,
  PackageOpen,
  Palette,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ConceptCard } from "@/components/studio/ConceptCard";
import { Button } from "@/components/ui/button";

type Concept = {
  id: string;
  title: string;
  hook: string;
  strategy: string;
  narrativeArc: string;
  visualStyle: string;
  estimatedScenes: number;
  estimatedDuration: number;
  previewPrompt: string;
  previewArtifactId: string | null;
  showcaseMotionPlan?: unknown;
  selected: boolean;
  rationale: string;
};

type Artifact = {
  id: string;
  mimeType: string;
  metadata?: unknown;
};

type Source = {
  id: string;
  type: string;
  artifactId: string | null;
  url: string | null;
  metadata?: unknown;
};

type Job = {
  id: string;
  type: string;
  status: string;
  model: string | null;
  error: string | null;
};

export function ConceptTable({
  projectId,
  hasBrandKit,
  concepts,
  artifacts,
  latestConceptJob,
  sources,
  autoMode: initialAutoMode,
  cinematicBoost: initialCinematicBoost,
  brandKitConfirmedAt,
  businessName,
  websiteUrl,
  outputMode,
  razzmatazzMode,
}: {
  projectId: string;
  hasBrandKit: boolean;
  concepts: Concept[];
  artifacts: Artifact[];
  latestConceptJob: Job | null;
  sources: Source[];
  autoMode: boolean;
  cinematicBoost: boolean;
  brandKitConfirmedAt: Date | string | null;
  businessName: string;
  websiteUrl: string | null;
  outputMode: "STANDARD" | "PRODUCT_SHOWCASE";
  razzmatazzMode: boolean;
}) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(latestConceptJob);
  const [isStarting, setIsStarting] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(
    concepts.find((concept) => concept.selected)?.id ?? null,
  );
  const [showBrandHandoff, setShowBrandHandoff] = useState(false);
  const [readyToProceed, setReadyToProceed] = useState(false);
  const [brandConfirmed, setBrandConfirmed] = useState(
    Boolean(brandKitConfirmedAt),
  );
  const [autoMode, setAutoMode] = useState(initialAutoMode);
  const [cinematicBoost, setCinematicBoost] = useState(initialCinematicBoost);
  const [isSavingBoost, setIsSavingBoost] = useState(false);
  const [isProceeding, setIsProceeding] = useState(false);
  const [error, setError] = useState<string | null>(
    latestConceptJob?.error ?? null,
  );
  const isRunning = job?.status === "QUEUED" || job?.status === "RUNNING";
  const artifactById = useMemo(
    () => new Map(artifacts.map((artifact) => [artifact.id, artifact])),
    [artifacts],
  );
  const hasUploadedBrandVisuals = sources.some((source) =>
    Boolean(source.artifactId),
  );
  const hasProductReference = sources.some(
    (source) => source.type === "PRODUCT_IMAGE" && source.artifactId,
  );
  const hasLegacyPreviews = concepts.some((concept) => {
    const artifact = concept.previewArtifactId
      ? artifactById.get(concept.previewArtifactId)
      : null;
    return artifact && isLegacyPreview(artifact, hasProductReference);
  });

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
        setError(data.job.error ?? "Creative concept generation failed.");
        router.refresh();
      }
    }, 1500);

    return () => window.clearInterval(interval);
  }, [isRunning, job, router]);

  async function generateConcepts() {
    setIsStarting(true);
    setError(null);

    const response = await fetch(`/api/projects/${projectId}/concepts`, {
      method: "POST",
    });
    const data = (await response.json()) as { job?: Job; error?: string };

    setIsStarting(false);

    if (!response.ok || !data.job) {
      setError(data.error ?? "Creative concepts could not start.");
      return;
    }

    setJob(data.job);

    if (data.job.status === "FAILED") {
      setError(data.job.error ?? "Creative concept generation failed.");
    }

    router.refresh();
  }

  async function updateCinematicBoost(enabled: boolean) {
    const previous = cinematicBoost;
    setCinematicBoost(enabled);
    setIsSavingBoost(true);
    setError(null);

    const response = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cinematicBoost: enabled }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setIsSavingBoost(false);

    if (!response.ok) {
      setCinematicBoost(previous);
      setError(data.error ?? "Cinematic Boost could not be saved.");
      return;
    }

    router.refresh();
  }

  async function selectConcept(conceptId: string) {
    setSelectingId(conceptId);
    setError(null);

    const response = await fetch(
      `/api/projects/${projectId}/concepts/${conceptId}/select`,
      { method: "POST" },
    );
    const data = (await response.json()) as { error?: string };

    setSelectingId(null);

    if (!response.ok) {
      setError(data.error ?? "Concept selection failed.");
      return;
    }

    setSelectedConceptId(conceptId);
    setReadyToProceed(true);
    if (!brandConfirmed) {
      setShowBrandHandoff(true);
    }
  }

  async function proceedFromBrandHandoff() {
    setIsProceeding(true);
    setError(null);
    const response = await fetch(`/api/projects/${projectId}/auto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", enabled: autoMode }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setIsProceeding(false);
    if (!response.ok) {
      setError(data.error ?? "Reel AI could not continue from this concept.");
      return;
    }

    setBrandConfirmed(true);
    setReadyToProceed(false);
    setShowBrandHandoff(false);
    router.refresh();
    if (!autoMode) navigateTo("storyboard");
  }

  function updateBrandAssets() {
    setShowBrandHandoff(false);
    navigateTo("assets");
  }

  async function regenerateConcept(conceptId: string, adjustmentNote: string) {
    setRegeneratingId(conceptId);
    setError(null);

    const response = await fetch(
      `/api/projects/${projectId}/concepts/${conceptId}/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustmentNote }),
      },
    );
    const data = (await response.json()) as { job?: Job; error?: string };

    setRegeneratingId(null);

    if (!response.ok || !data.job) {
      setError(data.error ?? "Concept regeneration could not start.");
      return false;
    }

    setJob(data.job);
    if (data.job.status === "FAILED") {
      setError(data.job.error ?? "Concept regeneration failed.");
      return false;
    }

    router.refresh();
    return true;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium">Creative Director</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare three divergent directions through their real Scene 1
            opening frames. Edit or regenerate any one without disturbing the
            other two.
          </p>
        </div>
        <Button
          disabled={
            !hasBrandKit ||
            isStarting ||
            isRunning ||
            isSavingBoost ||
            regeneratingId !== null
          }
          onClick={generateConcepts}
          size="sm"
          tooltip={
            concepts.length === 3
              ? "Replaces all three concepts with new directions from the current Brand Kit."
              : "Creates three distinct creative directions from the current Brand Kit."
          }
          tooltipSide="bottom"
          variant={concepts.length === 3 ? "outline" : "default"}
        >
          {isStarting || isRunning ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-4" aria-hidden="true" />
          )}
          {isStarting || isRunning
            ? razzmatazzMode
              ? "Crafting & polishing…"
              : "Developing & polishing…"
            : concepts.length === 3
              ? "Replace all 3"
              : "Generate 3 Concepts"}
        </Button>
      </div>

      <label
        className={`group relative flex cursor-pointer items-start justify-between gap-5 overflow-hidden rounded-2xl border p-4 transition-all sm:p-5 ${
          cinematicBoost
            ? "border-primary/35 bg-[radial-gradient(circle_at_top_left,rgba(183,255,60,0.16),transparent_44%),linear-gradient(135deg,rgba(183,255,60,0.07),rgba(255,255,255,0.015))] shadow-[0_18px_50px_rgba(0,0,0,0.18)]"
            : "border-border bg-background/45 hover:border-primary/20"
        }`}
      >
        <span className="flex min-w-0 gap-3.5">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
              cinematicBoost
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/15"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Aperture className="size-5" aria-hidden="true" />
          </span>
          <span>
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">Cinematic Boost</span>
              <span className="rounded-full border border-primary/20 bg-primary/[0.08] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-primary">
                {isSavingBoost
                  ? "Saving…"
                  : cinematicBoost
                    ? "Boost saved"
                    : "Creative intensity"}
              </span>
            </span>
            <span className="mt-1.5 block max-w-2xl text-xs leading-5 text-muted-foreground">
              Push the next concepts and every downstream shot toward bolder
              lighting, more surprising but physically credible motion, and
              expressive scene transitions—while keeping product and brand
              details exact.
            </span>
          </span>
        </span>
        <span className="relative mt-1 shrink-0">
          <input
            aria-label="Enable Cinematic Boost"
            checked={cinematicBoost}
            className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            disabled={isSavingBoost || isRunning || isStarting}
            onChange={(event) => updateCinematicBoost(event.target.checked)}
            type="checkbox"
          />
          <span className="pointer-events-none block h-7 w-12 rounded-full bg-muted ring-1 ring-border transition-colors peer-checked:bg-primary peer-disabled:opacity-60" />
          <span className="pointer-events-none absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 peer-checked:bg-primary-foreground" />
        </span>
      </label>

      {job ? (
        <div className="grid gap-2 rounded-md border border-border bg-background/60 p-3 text-sm md:grid-cols-3">
          <span className="font-medium">{formatEnum(job.status)}</span>
          <span className="text-muted-foreground">
            Model: {job.model ?? "pending"}
          </span>
          <span className="text-muted-foreground">Job: {job.id}</span>
        </div>
      ) : null}

      {error ? (
        <div className="flex gap-2 rounded-md border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>{error}</span>
        </div>
      ) : null}

      {!hasUploadedBrandVisuals ? (
        <div className="flex gap-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">Website-only grounding is active</p>
            <p className="mt-1 leading-5 text-muted-foreground">
              Concepts use unbranded lifestyle imagery and must not invent
              product UI, logos, badges, uniforms, or product details. Upload a
              logo, product image, or interface reference to authorize those
              elements.
            </p>
          </div>
        </div>
      ) : null}

      {hasLegacyPreviews ? (
        <div className="flex gap-3 rounded-md border border-amber-400/25 bg-amber-400/5 p-3 text-sm text-amber-100">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            One or more directions do not yet have a production-ready,
            product-grounded opening frame. Regenerate only the affected card to
            apply the current safeguards.
          </span>
        </div>
      ) : null}

      {!hasBrandKit ? (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Generate a Brand Kit first. Concepts are grounded in brand tone,
          claims, and policy risks.
        </div>
      ) : null}

      {outputMode === "PRODUCT_SHOWCASE" ? (
        <div className="flex gap-3 rounded-2xl border border-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(183,255,60,0.10),transparent_42%),rgba(183,255,60,0.035)] p-4 text-sm">
          <ShieldCheck
            className="mt-0.5 size-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">
              Motion feasibility is planned up front
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              Each direction declares one hero action, one calm camera behavior,
              human presence, and a category-aware separation decision. If a
              person appears, they are the only person in the showcase. Risky
              electronic, screen, and fabric teardown is blocked before video
              generation.
            </p>
          </div>
        </div>
      ) : null}

      {selectedConceptId && readyToProceed && !showBrandHandoff ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-primary/25 bg-primary/[0.065] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Palette className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium">
                {brandConfirmed
                  ? "Ready to build this direction"
                  : "One final grounding check"}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {brandConfirmed
                  ? autoMode
                    ? "Auto mode will take this concept through the full production pipeline."
                    : "Step-by-step mode will open the editable storyboard next."
                  : "Confirm the brand material Reel AI should carry into every scene before generation begins."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {brandConfirmed ? (
              <label className="flex h-8 cursor-pointer items-center gap-2 rounded-full border border-border bg-background/50 px-3 text-xs text-muted-foreground">
                <input
                  checked={autoMode}
                  className="size-3.5 accent-primary"
                  onChange={(event) => setAutoMode(event.target.checked)}
                  type="checkbox"
                />
                Auto mode
              </label>
            ) : null}
            <Button
              disabled={isProceeding}
              onClick={
                brandConfirmed
                  ? proceedFromBrandHandoff
                  : () => setShowBrandHandoff(true)
              }
              size="sm"
            >
              {isProceeding ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {brandConfirmed
                ? autoMode
                  ? "Generate my reel"
                  : "Continue step by step"
                : "Review & proceed"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}

      {concepts.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {concepts.map((concept) => (
            <ConceptCard
              artifact={
                concept.previewArtifactId
                  ? (artifactById.get(concept.previewArtifactId) ?? null)
                  : null
              }
              concept={{
                ...concept,
                selected: concept.id === selectedConceptId,
              }}
              outputMode={outputMode}
              isBusy={
                isStarting ||
                isRunning ||
                selectingId !== null ||
                regeneratingId !== null
              }
              isRegenerating={regeneratingId === concept.id}
              key={concept.id}
              onRegenerate={regenerateConcept}
              onSelect={selectConcept}
              requiresRegeneration={
                isLegacyPreview(
                  concept.previewArtifactId
                    ? (artifactById.get(concept.previewArtifactId) ?? null)
                    : null,
                  hasProductReference,
                ) ||
                (outputMode === "PRODUCT_SHOWCASE" &&
                  !concept.showcaseMotionPlan)
              }
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          No creative directions yet. This phase starts with three competing
          strategies, not one generic script.
        </div>
      )}

      {showBrandHandoff ? (
        <BrandKitHandoff
          autoMode={autoMode}
          businessName={businessName}
          error={error}
          isProceeding={isProceeding}
          onAutoModeChange={setAutoMode}
          onClose={() => setShowBrandHandoff(false)}
          onProceed={proceedFromBrandHandoff}
          onUpdateBrand={updateBrandAssets}
          sources={sources}
          websiteUrl={websiteUrl}
        />
      ) : null}
    </div>
  );
}

function BrandKitHandoff({
  businessName,
  websiteUrl,
  sources,
  autoMode,
  isProceeding,
  error,
  onAutoModeChange,
  onProceed,
  onUpdateBrand,
  onClose,
}: {
  businessName: string;
  websiteUrl: string | null;
  sources: Source[];
  autoMode: boolean;
  isProceeding: boolean;
  error: string | null;
  onAutoModeChange: (enabled: boolean) => void;
  onProceed: () => void;
  onUpdateBrand: () => void;
  onClose: () => void;
}) {
  const visualSources = sources.filter((source) => source.artifactId);
  const websiteSources = sources.filter(
    (source) => source.type === "WEBSITE" && source.url,
  );

  return (
    <div
      aria-labelledby="brand-handoff-title"
      aria-modal="true"
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/75 p-0 backdrop-blur-md sm:items-center sm:p-5"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      role="dialog"
    >
      <div className="relative max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-border bg-card shadow-[0_30px_100px_rgba(0,0,0,0.65)] sm:rounded-3xl">
        <div className="relative overflow-hidden border-b border-border bg-[radial-gradient(circle_at_top_left,rgba(183,255,60,0.14),transparent_38%),linear-gradient(135deg,rgba(22,26,20,1),rgba(15,17,16,1))] px-5 py-6 sm:px-7">
          <button
            aria-label="Close brand material review"
            autoFocus
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full border border-white/10 bg-black/20 text-muted-foreground transition-colors hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
            <Check className="size-5" aria-hidden="true" />
          </div>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Ready for production
          </p>
          <h2
            className="mt-2 max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl"
            id="brand-handoff-title"
          >
            Your brand, carried through every scene
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Reel AI will use these verified {businessName} materials to guide
            visual continuity, product details, colors, and the final brand
            lockup. You can add more before any production spend begins.
          </p>
        </div>

        <div className="grid gap-5 p-5 sm:p-7">
          <div className="grid gap-3 sm:grid-cols-2">
            <AssetSummary
              detail={
                websiteSources[0]?.url ?? websiteUrl ?? "No website provided"
              }
              icon={Globe2}
              label="Website evidence"
              ready={Boolean(websiteSources.length || websiteUrl)}
            />
            <AssetSummary
              detail={assetBreakdown(visualSources)}
              icon={FileImage}
              label="Uploaded brand assets"
              ready={visualSources.length > 0}
            />
          </div>

          {visualSources.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Available to generation · {visualSources.length}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {visualSources.map((source) => (
                  <span
                    className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground"
                    key={source.id}
                  >
                    {formatEnum(source.type)}
                    {sourceName(source) ? ` · ${sourceName(source)}` : ""}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.055] p-4 text-sm">
              <PackageOpen
                className="mt-0.5 size-4 shrink-0 text-amber-200"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium text-amber-100">
                  Website-only visuals
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Reel AI can proceed with safe, unbranded lifestyle imagery.
                  Add a logo or product image now for more exact brand
                  continuity and a visual end-card mark.
                </p>
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/[0.055] p-4">
            <span className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <WandSparkles className="size-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-medium">Auto mode</span>
                <span className="mt-1 block max-w-lg text-xs leading-5 text-muted-foreground">
                  Continue from storyboard through scene anchors, clips,
                  narration, and final render automatically. You can review or
                  regenerate every part afterward.
                </span>
              </span>
            </span>
            <span className="relative mt-1 shrink-0">
              <input
                checked={autoMode}
                className="peer sr-only"
                onChange={(event) => onAutoModeChange(event.target.checked)}
                type="checkbox"
              />
              <span className="block h-6 w-11 rounded-full bg-muted ring-1 ring-border transition-colors peer-checked:bg-primary" />
              <span className="absolute left-1 top-1 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5 peer-checked:bg-primary-foreground" />
            </span>
          </label>

          {error ? (
            <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              disabled={isProceeding}
              onClick={onUpdateBrand}
              variant="outline"
            >
              <Palette className="size-4" aria-hidden="true" />
              Add brand material
            </Button>
            <Button disabled={isProceeding} onClick={onProceed}>
              {isProceeding ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : autoMode ? (
                <Sparkles className="size-4" aria-hidden="true" />
              ) : (
                <ArrowRight className="size-4" aria-hidden="true" />
              )}
              {autoMode ? "Generate my reel" : "Continue step by step"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssetSummary({
  icon: Icon,
  label,
  detail,
  ready,
}: {
  icon: typeof Globe2;
  label: string;
  detail: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/55 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${ready ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
        >
          {ready ? "Ready" : "Optional"}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium">{label}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function assetBreakdown(sources: Source[]) {
  if (sources.length === 0) return "No uploads yet";
  const counts = new Map<string, number>();
  for (const source of sources) {
    counts.set(source.type, (counts.get(source.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => `${count} ${formatEnum(type).toLowerCase()}`)
    .join(" · ");
}

function sourceName(source: Source) {
  const metadata = source.metadata as {
    originalName?: unknown;
    label?: unknown;
  } | null;
  const value = metadata?.originalName ?? metadata?.label;
  return typeof value === "string" ? value : null;
}

function navigateTo(stage: "storyboard" | "assets") {
  window.dispatchEvent(
    new CustomEvent("reelai:navigate-stage", { detail: { stage } }),
  );
}

function isLegacyPreview(
  artifact: Artifact | null,
  requireLiveProductFrame = false,
) {
  if (!artifact) return true;
  const metadata = artifact.metadata as {
    groundingMode?: unknown;
    providerFallback?: unknown;
  } | null;
  return (
    typeof metadata?.groundingMode !== "string" ||
    (requireLiveProductFrame &&
      (metadata.groundingMode !== "product-reference-locked" ||
        typeof metadata?.providerFallback === "string"))
  );
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
