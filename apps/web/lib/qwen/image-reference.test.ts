import { afterEach, describe, expect, it, vi } from "vitest";

import { generateImageWithQwen } from "./image";

describe("Qwen image references", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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
