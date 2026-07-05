"use client";

import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
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
}: {
  projectId: string;
  hasBrandKit: boolean;
  concepts: Concept[];
  artifacts: Artifact[];
  latestConceptJob: Job | null;
}) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(latestConceptJob);
  const [isStarting, setIsStarting] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(latestConceptJob?.error ?? null);
  const isRunning = job?.status === "QUEUED" || job?.status === "RUNNING";
  const artifactById = useMemo(
    () => new Map(artifacts.map((artifact) => [artifact.id, artifact])),
    [artifacts],
  );

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

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium">Creative Director</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate exactly three divergent directions, then pick one before storyboard spend.
          </p>
        </div>
        <Button
          disabled={!hasBrandKit || isStarting || isRunning}
          onClick={generateConcepts}
          size="sm"
        >
          {isStarting || isRunning ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-4" aria-hidden="true" />
          )}
          {concepts.length === 3 ? "Regenerate 3 Concepts" : "Generate 3 Concepts"}
        </Button>
      </div>

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

      {!hasBrandKit ? (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Generate a Brand Kit first. Concepts are grounded in brand tone, claims, and policy risks.
        </div>
      ) : null}

      {concepts.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {concepts.map((concept) => (
            <ConceptCard
              artifact={
                concept.previewArtifactId
                  ? artifactById.get(concept.previewArtifactId) ?? null
                  : null
              }
              concept={concept}
              isSelecting={selectingId === concept.id}
              key={concept.id}
              onSelect={selectConcept}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          No creative directions yet. This phase starts with three competing strategies, not one generic script.
        </div>
      )}
    </div>
  );
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
