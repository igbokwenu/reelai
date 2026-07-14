export async function fetchWithRetry(
  input: string | URL,
  init?: RequestInit,
  {
    attempts = 3,
    baseDelayMs = 300,
  }: { attempts?: number; baseDelayMs?: number } = {},
) {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error("fetchWithRetry requires at least one attempt.");
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);

      if (!isRetryableStatus(response.status) || attempt === attempts) {
        return response;
      }

      await response.body?.cancel();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    }

    await wait(baseDelayMs * attempt);
  }

  throw lastError ?? new Error("Network request failed without a response.");
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function wait(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
