"use client";

import { CheckCircle2, ImageIcon, MousePointer2 } from "lucide-react";

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

export function ConceptCard({
  concept,
  artifact,
  onSelect,
  isSelecting,
}: {
  concept: Concept;
  artifact: Artifact | null;
  onSelect: (conceptId: string) => void;
  isSelecting: boolean;
}) {
  const previewHref = artifact
    ? `/api/artifacts/${artifact.id}/file`
    : null;

  return (
    <article className="grid min-h-full gap-3 rounded-md border border-border bg-background/50 p-3">
      <div className="overflow-hidden rounded-md border border-border bg-card">
        {previewHref ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`${concept.title} preview frame`}
            className="aspect-[9/16] w-full object-cover"
            src={previewHref}
          />
        ) : (
          <div className="flex aspect-[9/16] items-center justify-center text-muted-foreground">
            <ImageIcon className="size-7" aria-hidden="true" />
          </div>
        )}
      </div>

      <div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold leading-tight">{concept.title}</h3>
          {concept.selected ? (
            <CheckCircle2 className="size-5 shrink-0 text-primary" aria-label="Selected" />
          ) : null}
        </div>
        <p className="mt-2 text-sm font-medium text-primary">{concept.hook}</p>
      </div>

      <dl className="grid gap-2 text-sm">
        <Info label="Strategy" value={concept.strategy} />
        <Info label="Narrative Arc" value={concept.narrativeArc} />
        <Info label="Visual Style" value={concept.visualStyle} />
        <Info
          label="Plan"
          value={`${concept.estimatedScenes} scenes, ${concept.estimatedDuration}s`}
        />
        <Info label="Rationale" value={concept.rationale} />
      </dl>

      <div className="mt-auto">
        <Button
          disabled={concept.selected || isSelecting}
          onClick={() => onSelect(concept.id)}
          size="sm"
          variant={concept.selected ? "outline" : "default"}
        >
          {concept.selected ? (
            <CheckCircle2 className="size-4" aria-hidden="true" />
          ) : (
            <MousePointer2 className="size-4" aria-hidden="true" />
          )}
          {concept.selected ? "Selected Direction" : "Select Direction"}
        </Button>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 leading-5 text-muted-foreground">{value}</dd>
    </div>
  );
}
