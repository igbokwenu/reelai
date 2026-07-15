"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clapperboard,
  FolderOpen,
  ImagePlus,
  LayoutTemplate,
  LockKeyhole,
  Palette,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";
import { memo, type ReactNode, useEffect, useState } from "react";

import {
  AutoGenerationPanel,
  type AutoRunView,
} from "@/components/studio/AutoGenerationPanel";
import { Button } from "@/components/ui/button";
import { GuideTooltip } from "@/components/ui/guide-tooltip";

type StageId =
  "brand" | "concepts" | "storyboard" | "production" | "final" | "assets";

type Stage = {
  id: StageId;
  eyebrow: string;
  label: string;
  description: string;
  icon: LucideIcon;
  state: "complete" | "current" | "upcoming" | "available";
};

export function ProjectWorkflow({
  brand,
  concepts,
  storyboard,
  production,
  final,
  assets,
  hasBrandKit,
  hasSelectedConcept,
  storyboardStatus,
  productionComplete,
  finalComplete,
  projectId,
  latestAutoRun,
}: {
  brand: ReactNode;
  concepts: ReactNode;
  storyboard: ReactNode;
  production: ReactNode;
  final: ReactNode;
  assets: ReactNode;
  hasBrandKit: boolean;
  hasSelectedConcept: boolean;
  storyboardStatus: string | null;
  productionComplete: boolean;
  finalComplete: boolean;
  projectId: string;
  latestAutoRun: AutoRunView | null;
}) {
  const storyboardComplete = storyboardStatus === "APPROVED";
  const autoIsActive = Boolean(
    latestAutoRun &&
    ["RUNNING", "WAITING_RETRY"].includes(latestAutoRun.status),
  );
  const stages: Stage[] = [
    {
      id: "brand",
      eyebrow: "01 · Foundation",
      label: "Brand",
      description: "Define the voice, visual language, and safe claims.",
      icon: Palette,
      state: hasBrandKit ? "complete" : "current",
    },
    {
      id: "concepts",
      eyebrow: "02 · Direction",
      label: "Concepts",
      description: "Compare three creative routes and choose one.",
      icon: LayoutTemplate,
      state: hasSelectedConcept
        ? "complete"
        : hasBrandKit
          ? "current"
          : "upcoming",
    },
    {
      id: "storyboard",
      eyebrow: "03 · Plan",
      label: "Storyboard",
      description: "Shape the script, scenes, pacing, and approvals.",
      icon: Clapperboard,
      state: storyboardComplete
        ? "complete"
        : hasSelectedConcept
          ? "current"
          : "upcoming",
    },
    {
      id: "production",
      eyebrow: "04 · Create",
      label: "Production",
      description:
        "Review the recommended visual flow, tune scenes, and create clips.",
      icon: ImagePlus,
      state: productionComplete
        ? "complete"
        : storyboardComplete
          ? "current"
          : "upcoming",
    },
    {
      id: "final",
      eyebrow: "05 · Deliver",
      label: "Final",
      description:
        "Sync scene narration and export the finished vertical reel.",
      icon: PlayCircle,
      state: finalComplete
        ? "complete"
        : productionComplete
          ? "current"
          : "upcoming",
    },
    {
      id: "assets",
      eyebrow: "Project library",
      label: "Assets",
      description: "Manage source material and generated artifacts.",
      icon: FolderOpen,
      state: "available",
    },
  ];

  const suggestedStage =
    stages.find((stage) => stage.state === "current")?.id ??
    (finalComplete ? "final" : "brand");
  const [activeId, setActiveId] = useState<StageId>(suggestedStage);
  const activeIndex = stages.findIndex((stage) => stage.id === activeId);
  const activeStage = stages[activeIndex] ?? stages[0];

  function selectStage(id: StageId) {
    setActiveId(id);
    window.requestAnimationFrame(() => {
      document.getElementById("project-workspace")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  useEffect(() => {
    function handleNavigation(event: Event) {
      const stage = (event as CustomEvent<{ stage?: StageId }>).detail?.stage;
      if (stage && stages.some((candidate) => candidate.id === stage)) {
        selectStage(stage);
      }
    }
    window.addEventListener("reelai:navigate-stage", handleNavigation);
    return () =>
      window.removeEventListener("reelai:navigate-stage", handleNavigation);
  });

  return (
    <div className="mt-6" id="project-workspace">
      {latestAutoRun ? (
        <AutoGenerationPanel
          initialRun={latestAutoRun}
          key={latestAutoRun.id}
          onReviewStage={(stage) => selectStage(stage)}
          projectId={projectId}
        />
      ) : null}
      {autoIsActive ? (
        <section className="overflow-hidden rounded-2xl border border-primary/15 bg-[linear-gradient(120deg,rgba(183,255,60,0.07),rgba(255,255,255,0.025))] px-5 py-4 shadow-xl shadow-black/10 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <LockKeyhole className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">
                Automatic production has the controls
              </p>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                Reel AI is protecting this run from conflicting edits or
                duplicate generation spend. Completed work is durable if you
                leave, and this run resumes when you return. Studio editors
                reappear automatically when the reel completes or a phase needs
                your review.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <nav
            aria-label="Project workflow"
            className="workflow-rail overflow-x-auto rounded-2xl border border-border/80 bg-card/70 p-2 shadow-2xl shadow-black/20 backdrop-blur-xl"
            role="tablist"
          >
            <div className="grid min-w-[760px] grid-cols-6 gap-1">
              {stages.map((stage) => {
                const Icon = stage.icon;
                const isActive = stage.id === activeStage.id;
                return (
                  <GuideTooltip
                    className="min-w-0"
                    content={`Opens ${stage.label}. ${stage.description}`}
                    key={stage.id}
                    side="bottom"
                  >
                    <button
                      aria-controls={`workflow-panel-${stage.id}`}
                      aria-current={isActive ? "step" : undefined}
                      aria-selected={isActive}
                      className={`group relative w-full min-w-0 rounded-xl px-3 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/10"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                      id={`workflow-tab-${stage.id}`}
                      onClick={() => selectStage(stage.id)}
                      role="tab"
                      type="button"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-lg border ${
                            isActive
                              ? "border-primary-foreground/15 bg-primary-foreground/10"
                              : stage.state === "complete"
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "border-border bg-background/60"
                          }`}
                        >
                          {stage.state === "complete" && !isActive ? (
                            <Check className="size-3.5" aria-hidden="true" />
                          ) : (
                            <Icon className="size-3.5" aria-hidden="true" />
                          )}
                        </span>
                        <span className="truncate text-sm font-semibold">
                          {stage.label}
                        </span>
                      </span>
                      <span
                        className={`mt-2 block truncate text-[10px] font-medium uppercase tracking-[0.12em] ${
                          isActive
                            ? "text-primary-foreground/65"
                            : "text-muted-foreground"
                        }`}
                      >
                        {stage.state === "complete"
                          ? "Complete"
                          : stage.state === "current"
                            ? "Ready now"
                            : stage.state === "available"
                              ? "Anytime"
                              : "Up next"}
                      </span>
                    </button>
                  </GuideTooltip>
                );
              })}
            </div>
          </nav>

          <section className="mt-4 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl shadow-black/20">
            <header className="border-b border-border bg-gradient-to-br from-white/[0.045] to-transparent px-5 py-5 sm:px-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                    {activeStage.eyebrow}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    {activeStage.label}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {activeStage.description}
                  </p>
                </div>
                <span className="w-fit rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
                  {activeIndex + 1} of {stages.length}
                </span>
              </div>
            </header>

            <div
              className="workflow-panels p-4 sm:p-7"
              data-active-stage={activeStage.id}
            >
              <StagePanels
                assets={assets}
                brand={brand}
                concepts={concepts}
                final={final}
                production={production}
                storyboard={storyboard}
              />
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-border bg-background/30 px-4 py-3 sm:px-7">
              <Button
                disabled={activeIndex === 0}
                onClick={() => selectStage(stages[activeIndex - 1].id)}
                size="sm"
                tooltip={
                  activeIndex === 0
                    ? "You are already at the first stage."
                    : `Moves to ${stages[activeIndex - 1].label}. Your edits stay preserved.`
                }
                tooltipSide="bottom"
                variant="outline"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Previous
              </Button>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Your work is preserved as you move between stages.
              </p>
              <Button
                disabled={activeIndex === stages.length - 1}
                onClick={() => selectStage(stages[activeIndex + 1].id)}
                size="sm"
                tooltip={
                  activeIndex === stages.length - 1
                    ? "You are already at the last stage."
                    : `Moves to ${stages[activeIndex + 1].label}. Your edits stay preserved.`
                }
                tooltipSide="bottom"
              >
                Next
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </footer>
          </section>
        </>
      )}
    </div>
  );
}

const StagePanels = memo(function StagePanels({
  brand,
  concepts,
  storyboard,
  production,
  final,
  assets,
}: {
  brand: ReactNode;
  concepts: ReactNode;
  storyboard: ReactNode;
  production: ReactNode;
  final: ReactNode;
  assets: ReactNode;
}) {
  return (
    <>
      <WorkflowPanel id="brand">{brand}</WorkflowPanel>
      <WorkflowPanel id="concepts">{concepts}</WorkflowPanel>
      <WorkflowPanel id="storyboard">{storyboard}</WorkflowPanel>
      <WorkflowPanel id="production">{production}</WorkflowPanel>
      <WorkflowPanel id="final">{final}</WorkflowPanel>
      <WorkflowPanel id="assets">{assets}</WorkflowPanel>
    </>
  );
});

function WorkflowPanel({ id, children }: { id: StageId; children: ReactNode }) {
  return (
    <div
      aria-labelledby={`workflow-tab-${id}`}
      data-workflow-panel={id}
      id={`workflow-panel-${id}`}
      role="tabpanel"
    >
      {children}
    </div>
  );
}
