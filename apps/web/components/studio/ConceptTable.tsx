"use client";

import {
  AlertTriangle,
  Info,
  Loader2,
  ShieldCheck,
  Sparkles,
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
  selected: boolean;
  rationale: string;
};

type Artifact = {
  id: string;
  mimeType: string;
  metadata?: unknown;
};

type Source = { type: string; artifactId: string | null };

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
}: {
  projectId: string;
  hasBrandKit: boolean;
  concepts: Concept[];
  artifacts: Artifact[];
  latestConceptJob: Job | null;
  sources: Source[];
}) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(latestConceptJob);
  const [isStarting, setIsStarting] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
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
  const hasLegacyPreviews = concepts.some((concept) => {
    const artifact = concept.previewArtifactId
      ? artifactById.get(concept.previewArtifactId)
      : null;
    const metadata = artifact?.metadata as { groundingMode?: unknown } | null;
    return artifact && typeof metadata?.groundingMode !== "string";
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

    router.refresh();
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
            Generate exactly three divergent directions, then pick one before
            storyboard spend.
          </p>
        </div>
        <Button
          disabled={
            !hasBrandKit || isStarting || isRunning || regeneratingId !== null
          }
          onClick={generateConcepts}
          size="sm"
          tooltip={
            concepts.length === 3
              ? "Replaces all three concepts with new directions from the current Brand Kit."
              : "Creates three distinct creative directions from the current Brand Kit."
          }
          tooltipSide="bottom"
        >
          {isStarting || isRunning ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-4" aria-hidden="true" />
          )}
          {concepts.length === 3
            ? "Regenerate 3 Concepts"
            : "Generate 3 Concepts"}
        </Button>
      </div>

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
            These previews were created before visual grounding metadata was
            recorded. Regenerate the concepts to apply the current safeguards.
          </span>
        </div>
      ) : null}

      {!hasBrandKit ? (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Generate a Brand Kit first. Concepts are grounded in brand tone,
          claims, and policy risks.
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
              concept={concept}
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
              requiresRegeneration={isLegacyPreview(
                concept.previewArtifactId
                  ? (artifactById.get(concept.previewArtifactId) ?? null)
                  : null,
              )}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          No creative directions yet. This phase starts with three competing
          strategies, not one generic script.
        </div>
      )}
    </div>
  );
}

function isLegacyPreview(artifact: Artifact | null) {
  if (!artifact) return true;
  const metadata = artifact.metadata as { groundingMode?: unknown } | null;
  return typeof metadata?.groundingMode !== "string";
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
