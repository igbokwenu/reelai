"use client";

import {
  CheckCircle2,
  ImageIcon,
  Loader2,
  MousePointer2,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";

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
  isRegenerating,
  isBusy,
  requiresRegeneration,
  onRegenerate,
}: {
  concept: Concept;
  artifact: Artifact | null;
  onSelect: (conceptId: string) => void;
  onRegenerate: (conceptId: string, adjustmentNote: string) => Promise<boolean>;
  isRegenerating: boolean;
  isBusy: boolean;
  requiresRegeneration: boolean;
}) {
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const previewHref = artifact ? `/api/artifacts/${artifact.id}/file` : null;

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
          <h3 className="text-base font-semibold leading-tight">
            {concept.title}
          </h3>
          {concept.selected ? (
            <CheckCircle2
              className="size-5 shrink-0 text-primary"
              aria-label="Selected"
            />
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

      <div className="mt-auto grid gap-3">
        {isAdjusting ? (
          <div className="grid gap-2 rounded-md border border-border bg-card p-3">
            <label className="grid gap-2">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Optional adjustment
              </span>
              <textarea
                autoFocus
                className="min-h-20 rounded-md border border-border bg-background px-3 py-2 text-sm"
                disabled={isRegenerating}
                maxLength={500}
                onChange={(event) => setAdjustmentNote(event.target.value)}
                placeholder="E.g. make it more playful, lead with the founder story, or expand the product-demo angle."
                value={adjustmentNote}
              />
            </label>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {adjustmentNote.length}/500
              </span>
              <div className="flex gap-2">
                <Button
                  disabled={isRegenerating}
                  onClick={() => setIsAdjusting(false)}
                  size="sm"
                  variant="ghost"
                >
                  Cancel
                </Button>
                <Button
                  disabled={isBusy}
                  onClick={async () => {
                    const succeeded = await onRegenerate(
                      concept.id,
                      adjustmentNote.trim(),
                    );
                    if (succeeded) {
                      setAdjustmentNote("");
                      setIsAdjusting(false);
                    }
                  }}
                  size="sm"
                  tooltip={
                    concept.selected
                      ? "Replaces this selected concept using your note and returns its storyboard to draft for review."
                      : "Replaces only this concept using your adjustment note."
                  }
                  tooltipSide="bottom"
                  variant="outline"
                >
                  {isRegenerating ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <RefreshCw className="size-4" aria-hidden="true" />
                  )}
                  Regenerate
                </Button>
              </div>
            </div>
            {concept.selected ? (
              <p className="text-xs leading-5 text-amber-200">
                This selected direction drives the current storyboard.
                Regenerating it returns the storyboard and its scenes to draft
                for review.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            disabled={concept.selected || isBusy || requiresRegeneration}
            onClick={() => onSelect(concept.id)}
            size="sm"
            tooltip={
              concept.selected
                ? "This direction currently drives the storyboard."
                : requiresRegeneration
                  ? "Regenerate this concept before selecting it."
                  : "Makes this the creative direction used to build the storyboard."
            }
            tooltipSide="bottom"
            variant={concept.selected ? "outline" : "default"}
          >
            {concept.selected ? (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            ) : (
              <MousePointer2 className="size-4" aria-hidden="true" />
            )}
            {concept.selected
              ? "Selected Direction"
              : requiresRegeneration
                ? "Regenerate required"
                : "Select Direction"}
          </Button>
          <Button
            disabled={isBusy || isAdjusting}
            onClick={() => setIsAdjusting(true)}
            size="sm"
            tooltip="Opens an optional note so you can regenerate only this direction."
            tooltipSide="bottom"
            variant="outline"
          >
            {isRegenerating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            Refine / Regenerate
          </Button>
        </div>
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
