import { afterEach, describe, expect, it, vi } from "vitest";

import { generateImageWithQwen, QwenImageError } from "./image";

describe("Qwen image references", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("retries transient image capacity failures before returning a placeholder-worthy error", async () => {
    vi.useFakeTimers();
    vi.stubEnv("DASHSCOPE_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output: {
              choices: [
                {
                  message: {
                    content: [{ image: "https://example.test/out.png" }],
                  },
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const pending = generateImageWithQwen({
      operation: "test_retry",
      model: "wan2.7-image-pro",
      prompt: "Generate an image",
    });
    await vi.advanceTimersByTimeAsync(500);

    await expect(pending).resolves.toMatchObject({ attempts: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-transient rejected image request", async () => {
    vi.stubEnv("DASHSCOPE_API_KEY", "test-key");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("bad request", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateImageWithQwen({
        operation: "test_bad_request",
        model: "wan2.7-image-pro",
        prompt: "Generate an image",
      }),
    ).rejects.toBeInstanceOf(QwenImageError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("enables provider OSS resolution and uses editing mode for local references", async () => {
    vi.stubEnv("DASHSCOPE_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: {
            choices: [
              {
                message: {
                  content: [{ image: "https://example.test/out.png" }],
                },
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await generateImageWithQwen({
      operation: "test_reference",
      model: "wan2.7-image-pro",
      prompt: "Preserve the exact product",
      imageUrls: ["oss://temporary/product.png"],
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({
      "X-DashScope-OssResourceResolve": "enable",
    });
    const body = JSON.parse(String(init.body)) as {
      input: { messages: Array<{ content: Array<Record<string, string>> }> };
      parameters: Record<string, unknown>;
    };
    expect(body.input.messages[0]?.content).toEqual([
      { text: "Preserve the exact product" },
      { image: "oss://temporary/product.png" },
    ]);
    expect(body.parameters.thinking_mode).toBeUndefined();
  });
});
