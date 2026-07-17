"use client";

import {
  Aperture,
  CheckCircle2,
  CircleAlert,
  ImageIcon,
  Loader2,
  LockKeyhole,
  MousePointer2,
  PencilLine,
  RefreshCw,
  ShieldCheck,
  UserRound,
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
  showcaseMotionPlan?: unknown;
  selected: boolean;
  rationale: string;
};

type Artifact = {
  id: string;
  mimeType: string;
  metadata?: unknown;
};

export function ConceptCard({
  concept,
  artifact,
  onSelect,
  isRegenerating,
  isBusy,
  requiresRegeneration,
  outputMode,
  onRegenerate,
}: {
  concept: Concept;
  artifact: Artifact | null;
  onSelect: (conceptId: string) => void;
  onRegenerate: (conceptId: string, adjustmentNote: string) => Promise<boolean>;
  isRegenerating: boolean;
  isBusy: boolean;
  requiresRegeneration: boolean;
  outputMode: "STANDARD" | "PRODUCT_SHOWCASE";
}) {
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const previewHref = artifact ? `/api/artifacts/${artifact.id}/file` : null;
  const motionPlan = parseMotionPlan(concept.showcaseMotionPlan);
  const frameMetadata = parseOpeningFrameMetadata(artifact?.metadata);

  return (
    <article className="grid min-h-full gap-3 rounded-md border border-border bg-background/50 p-3">
      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-black/20">
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
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/75 via-black/25 to-transparent p-3">
          <span className="rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
            Scene 01 · Opening frame
          </span>
          {frameMetadata.productReferenceCount > 0 &&
          !frameMetadata.providerFallback ? (
            <span className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/90 px-2 py-1 text-[9px] font-semibold text-primary-foreground">
              <LockKeyhole className="size-3" aria-hidden="true" />
              Product locked
            </span>
          ) : frameMetadata.providerFallback ? (
            <span className="flex items-center gap-1 rounded-full border border-amber-200/30 bg-amber-500/90 px-2 py-1 text-[9px] font-semibold text-white">
              <CircleAlert className="size-3" aria-hidden="true" />
              Retry available
            </span>
          ) : null}
        </div>
        <div className="absolute inset-x-3 bottom-3 rounded-lg border border-white/10 bg-black/65 px-3 py-2 text-[10px] leading-4 text-white/80 backdrop-blur-md">
          {frameMetadata.providerFallback
            ? openingFrameFallbackMessage(frameMetadata.failureStage)
            : "This exact image becomes the first frame of the selected reel."}
        </div>
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

      {outputMode === "PRODUCT_SHOWCASE" ? (
        motionPlan ? (
          <section className="relative overflow-hidden rounded-xl border border-primary/20 bg-[radial-gradient(circle_at_top_right,rgba(183,255,60,0.13),transparent_44%),linear-gradient(145deg,rgba(183,255,60,0.055),rgba(255,255,255,0.012))] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <ShieldCheck className="size-3.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                    Motion treatment
                  </p>
                  <p className="text-xs font-medium">
                    Production-safe by design
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-primary/20 bg-primary/[0.08] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-primary">
                Guarded
              </span>
            </div>

            <div className="mt-3 grid gap-2">
              <MotionDetail label="Hero action" value={motionPlan.heroAction} />
              <MotionDetail
                label="Supporting motion"
                value={motionPlan.supportingMotion}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <MotionChip
                icon={Aperture}
                value={formatMotionValue(motionPlan.cameraBehavior)}
              />
              <MotionChip
                icon={UserRound}
                value={
                  motionPlan.humanPresence === "ONE_PERSON"
                    ? "One person only"
                    : "Product only"
                }
              />
              <MotionChip
                icon={ShieldCheck}
                value={separationLabel(motionPlan.separationTreatment)}
              />
            </div>

            <p className="mt-3 border-t border-primary/10 pt-3 text-[11px] leading-5 text-muted-foreground">
              {motionPlan.safetyRationale}
            </p>
          </section>
        ) : (
          <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-3 text-xs leading-5 text-amber-100">
            Regenerate this legacy direction to add the current motion safety
            plan before selection.
          </div>
        )
      ) : null}

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
            tooltip="Edit the creative direction and regenerate only this concept and its opening frame."
            tooltipSide="bottom"
            variant="outline"
          >
            {isRegenerating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <PencilLine className="size-4" aria-hidden="true" />
            )}
            Edit & regenerate
          </Button>
        </div>
      </div>
    </article>
  );
}

function parseOpeningFrameMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      productReferenceCount: 0,
      providerFallback: false,
      failureStage: null,
    };
  }
  const metadata = value as Record<string, unknown>;
  return {
    productReferenceCount:
      typeof metadata.productReferenceCount === "number"
        ? metadata.productReferenceCount
        : 0,
    providerFallback: typeof metadata.providerFallback === "string",
    failureStage:
      typeof metadata.failureStage === "string" ? metadata.failureStage : null,
  };
}

function openingFrameFallbackMessage(stage: string | null) {
  switch (stage) {
    case "reference":
      return "Product image could not be prepared · check the asset and retry this concept";
    case "generation":
      return "Image service was unavailable · retry this concept without changing its direction";
    case "review":
      return "Product match needs another pass · retry this concept";
    case "download":
      return "Image delivery was interrupted · retry this concept";
    default:
      return "Opening frame unavailable · retry this concept before production";
  }
}

type MotionPlan = {
  heroAction: string;
  supportingMotion: string;
  cameraBehavior: string;
  humanPresence: "NO_PERSON" | "ONE_PERSON";
  separationTreatment:
    "AVOID" | "FOOD_LAYER_SEPARATION" | "VISIBLE_COMPONENT_SEPARATION";
  safetyRationale: string;
};

function parseMotionPlan(value: unknown): MotionPlan | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const plan = value as Record<string, unknown>;
  if (
    typeof plan.heroAction !== "string" ||
    typeof plan.supportingMotion !== "string" ||
    typeof plan.cameraBehavior !== "string" ||
    (plan.humanPresence !== "NO_PERSON" &&
      plan.humanPresence !== "ONE_PERSON") ||
    (plan.separationTreatment !== "AVOID" &&
      plan.separationTreatment !== "FOOD_LAYER_SEPARATION" &&
      plan.separationTreatment !== "VISIBLE_COMPONENT_SEPARATION") ||
    typeof plan.safetyRationale !== "string"
  ) {
    return null;
  }
  return plan as MotionPlan;
}

function MotionDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.055] bg-black/10 px-2.5 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xs leading-5 text-foreground/90">{value}</p>
    </div>
  );
}

function MotionChip({
  icon: Icon,
  value,
}: {
  icon: typeof Aperture;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-background/45 px-2 py-1 text-[10px] text-muted-foreground">
      <Icon className="size-3 text-primary" aria-hidden="true" />
      {value}
    </span>
  );
}

function formatMotionValue(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function separationLabel(value: MotionPlan["separationTreatment"]) {
  if (value === "FOOD_LAYER_SEPARATION") return "Food layers eligible";
  if (value === "VISIBLE_COMPONENT_SEPARATION") {
    return "Visible parts eligible";
  }
  return "No teardown";
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
