import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWithRetry } from "./fetch-with-retry";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWithRetry", () => {
  it("retries transient network failures", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithRetry("https://media.example/video.mp4", undefined, {
      baseDelayMs: 0,
    });

    expect(await response.text()).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry permanent client errors", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("missing", { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithRetry("https://media.example/missing", undefined, {
      baseDelayMs: 0,
    });

    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
