"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clapperboard,
  ImagePlus,
  Loader2,
  Mic2,
  RefreshCw,
  Sparkles,
  Video,
  WandSparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  AUTO_PHASES,
  autoProgress,
  type AutoPhase,
  type AutoRunStatus,
} from "@/lib/jobs/auto-production-state";

export type AutoRunView = {
  id: string;
  status: string;
  phase: string;
  currentJobId: string | null;
  attempt: number;
  maxAttempts: number;
  nextAttemptAt: Date | string | null;
  error: string | null;
  startedAt: Date | string;
  completedAt: Date | string | null;
};

const PHASE_DETAILS = {
  STORYBOARD: {
    label: "Storyboard",
    active: "Directing the story",
    description:
      "Writing the scene plan, captions, voiceover, and continuity bible.",
    icon: Clapperboard,
    stage: "storyboard",
  },
  KEYFRAMES: {
    label: "Scene anchors",
    active: "Designing the visual world",
    description:
      "Creating continuity-aware anchor frames from your approved brand material.",
    icon: ImagePlus,
    stage: "production",
  },
  CLIPS: {
    label: "Video clips",
    active: "Bringing every scene to life",
    description:
      "Generating and checking each motion clip; completed scenes stay preserved.",
    icon: Video,
    stage: "production",
  },
  NARRATION: {
    label: "Narration",
    active: "Fitting the voice track",
    description:
      "Synthesizing scene-locked narration and fitting its timing naturally.",
    icon: Mic2,
    stage: "final",
  },
  RENDER: {
    label: "Final reel",
    active: "Finishing your reel",
    description:
      "Composing clips, captions, audio, branding, and disclosure in Remotion.",
    icon: WandSparkles,
    stage: "final",
  },
} as const;

export function AutoGenerationPanel({
  projectId,
  initialRun,
  onReviewStage,
}: {
  projectId: string;
  initialRun: AutoRunView | null;
  onReviewStage: (stage: "storyboard" | "production" | "final") => void;
}) {
  const router = useRouter();
  const [run, setRun] = useState(initialRun);
  const runRef = useRef(initialRun);
  const [isResuming, setIsResuming] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const isActive = run && ["RUNNING", "WAITING_RETRY"].includes(run.status);
  useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const response = await fetch(`/api/projects/${projectId}/auto`, {
          cache: "no-store",
        });
        const data = (await response.json().catch(() => ({}))) as {
          run?: AutoRunView | null;
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error ?? "Auto mode could not report progress.");
        if (cancelled) return;

        if (data.run) {
          const previous = runRef.current;
          const changed =
            previous &&
            (previous.phase !== data.run.phase ||
              previous.status !== data.run.status);
          runRef.current = data.run;
          setRun(data.run);
          if (changed) router.refresh();
        }
        setRequestError(null);
      } catch (error) {
        if (!cancelled) {
          setRequestError(
            error instanceof Error
              ? error.message
              : "Progress is temporarily unavailable.",
          );
        }
      } finally {
        if (!cancelled) timer = window.setTimeout(poll, 2_500);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [isActive, projectId, router]);

  const phase = (run?.phase ?? "STORYBOARD") as AutoPhase;
  const status = (run?.status ?? "RUNNING") as AutoRunStatus;
  const progress = autoProgress(phase, status);
  const current = phase === "COMPLETE" ? null : PHASE_DETAILS[phase];
  const phaseIndex = AUTO_PHASES.indexOf(phase as (typeof AUTO_PHASES)[number]);
  const retryAt = run?.nextAttemptAt ? new Date(run.nextAttemptAt) : null;
  const retryLabel =
    !retryAt || retryAt <= new Date()
      ? "Retrying now"
      : `Retrying shortly · attempt ${(run?.attempt ?? 0) + 1} of ${run?.maxAttempts ?? 3}`;

  if (!run) return null;

  async function resume() {
    setIsResuming(true);
    setRequestError(null);
    const response = await fetch(`/api/projects/${projectId}/auto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resume" }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      run?: AutoRunView;
      error?: string;
    };
    setIsResuming(false);
    if (!response.ok || !data.run) {
      setRequestError(data.error ?? "Auto mode could not resume.");
      return;
    }
    runRef.current = data.run;
    setRun(data.run);
    router.refresh();
  }

  return (
    <section className="auto-run-panel relative mb-5 overflow-hidden rounded-3xl border border-primary/20 bg-[radial-gradient(circle_at_top_left,rgba(183,255,60,0.13),transparent_38%),linear-gradient(135deg,rgba(20,24,18,0.98),rgba(11,13,12,0.98))] shadow-2xl shadow-black/30">
      <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="relative p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              {status === "COMPLETE" ? (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              ) : status === "FAILED" ? (
                <AlertTriangle className="size-4" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              Auto director
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              {status === "COMPLETE"
                ? "Your reel is ready"
                : status === "FAILED"
                  ? `${current?.label ?? "Generation"} needs your attention`
                  : (current?.active ?? "Building your reel")}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {status === "COMPLETE"
                ? "The complete reel is ready to watch. Every storyboard scene, anchor, clip, and narration track remains editable below."
                : status === "FAILED"
                  ? "Nothing completed has been lost. Review the detail below, make an edit if needed, then resume from this phase."
                  : current?.description}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {status === "FAILED" ? (
              <>
                {current ? (
                  <Button
                    onClick={() => onReviewStage(current.stage)}
                    size="sm"
                    variant="outline"
                  >
                    Review {current.label}
                  </Button>
                ) : null}
                <Button disabled={isResuming} onClick={resume} size="sm">
                  {isResuming ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <RefreshCw className="size-4" aria-hidden="true" />
                  )}
                  Resume auto mode
                </Button>
              </>
            ) : status === "COMPLETE" ? (
              <Button onClick={() => onReviewStage("final")} size="sm">
                <PlayReelIcon />
                Watch final reel
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div
            className="h-full rounded-full bg-primary shadow-[0_0_18px_rgba(183,255,60,0.5)] transition-[width] duration-700"
            style={{
              width: `${Math.max(status === "RUNNING" ? 4 : 0, progress)}%`,
            }}
          />
        </div>

        <ol className="mt-5 grid gap-2 sm:grid-cols-5">
          {AUTO_PHASES.map((item, index) => {
            const detail = PHASE_DETAILS[item];
            const Icon = detail.icon;
            const complete = status === "COMPLETE" || index < phaseIndex;
            const active = index === phaseIndex && status !== "COMPLETE";
            return (
              <li
                className={`rounded-xl border px-3 py-3 transition-colors ${
                  active
                    ? "border-primary/35 bg-primary/[0.08]"
                    : complete
                      ? "border-white/[0.08] bg-white/[0.035]"
                      : "border-transparent bg-black/10"
                }`}
                key={item}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`flex size-7 items-center justify-center rounded-lg ${
                      complete
                        ? "bg-primary text-primary-foreground"
                        : active
                          ? "bg-primary/15 text-primary"
                          : "bg-white/[0.05] text-muted-foreground"
                    }`}
                  >
                    {complete ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : active && status !== "FAILED" ? (
                      <Loader2
                        className="size-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Icon className="size-3.5" aria-hidden="true" />
                    )}
                  </span>
                  <span
                    className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {detail.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {status === "WAITING_RETRY" ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2.5 text-xs text-amber-100">
            <RefreshCw className="size-3.5" aria-hidden="true" />
            <span>{retryLabel}. Completed work is preserved.</span>
          </div>
        ) : null}
        {run.error && status === "FAILED" ? (
          <div className="mt-4 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <span>{run.error}</span>
          </div>
        ) : null}
        {requestError ? (
          <p className="mt-3 text-xs text-amber-200">
            {requestError} Reel AI will keep checking.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function PlayReelIcon() {
  return <Video className="size-4" aria-hidden="true" />;
}
