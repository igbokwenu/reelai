export const AUTO_PHASES = [
  "STORYBOARD",
  "KEYFRAMES",
  "CLIPS",
  "NARRATION",
  "RENDER",
] as const;

export type AutoPhase = (typeof AUTO_PHASES)[number] | "COMPLETE";
export type AutoRunStatus =
  | "RUNNING"
  | "WAITING_RETRY"
  | "COMPLETE"
  | "FAILED"
  | "CANCELLED";

export function nextAutoPhase(phase: AutoPhase): AutoPhase {
  const index = AUTO_PHASES.indexOf(phase as (typeof AUTO_PHASES)[number]);
  return index < 0 || index === AUTO_PHASES.length - 1
    ? "COMPLETE"
    : AUTO_PHASES[index + 1]!;
}

export function autoProgress(phase: AutoPhase, status: AutoRunStatus) {
  if (status === "COMPLETE" || phase === "COMPLETE") return 100;
  const index = AUTO_PHASES.indexOf(phase as (typeof AUTO_PHASES)[number]);
  return index < 0 ? 0 : Math.round((index / AUTO_PHASES.length) * 100);
}

export function retryDelayMs(
  attempt: number,
  baseMs = 3_000,
  maxMs = 30_000,
) {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
}

export function isAutoRunActive(status: string) {
  return status === "RUNNING" || status === "WAITING_RETRY";
}
