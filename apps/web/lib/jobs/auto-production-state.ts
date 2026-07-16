export const AUTO_PHASES = [
  "STORYBOARD",
  "KEYFRAMES",
  "CLIPS",
  "NARRATION",
  "RENDER",
] as const;

export type AutoPhase = (typeof AUTO_PHASES)[number] | "COMPLETE";
export type AutoRunStatus =
  "RUNNING" | "WAITING_RETRY" | "COMPLETE" | "FAILED" | "CANCELLED";

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

export function retryDelayMs(attempt: number, baseMs = 3_000, maxMs = 30_000) {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
}

export function isAutoRunActive(status: string) {
  return status === "RUNNING" || status === "WAITING_RETRY";
}

const NON_RETRYABLE_AUTO_FAILURE =
  /shorten|must be approved|not found|select (?:exactly )?one|before (?:proceeding|resuming)|policy|requires human review|upload the/i;

const CREATIVE_OUTPUT_VALIDATION_FAILURE =
  /schema mismatch|after automatic repair/i;

/**
 * Provider outages and polling failures can improve on retry. Creative output
 * gets one fresh reroll after local/schema repair; user-input failures do not.
 */
export function isRetryableAutoFailure(message: string) {
  return !NON_RETRYABLE_AUTO_FAILURE.test(message);
}

export function isCreativeOutputValidationFailure(message: string) {
  return CREATIVE_OUTPUT_VALIDATION_FAILURE.test(message);
}

export function creativeOutputAttemptLimit(message: string) {
  return isCreativeOutputValidationFailure(message) ? 2 : undefined;
}

const TECHNICAL_CREATIVE_VALIDATION =
  /schema mismatch|too small: expected|too big: expected|invalid_type|expected string to have/i;

export function presentAutoFailure(message: string) {
  if (!TECHNICAL_CREATIVE_VALIDATION.test(message)) return message;

  return "Reel AI couldn't complete the creative plan after automatic repair. Your concept and brand assets are safe; retry this phase to continue.";
}
