export function isRetryableVideoSubmissionError(error: unknown) {
  if (error instanceof TypeError) return true;
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return [
    "fetch failed",
    "network",
    "rate limit",
    "temporarily unavailable",
    "did not include a task id",
  ].some((fragment) => message.includes(fragment));
}
