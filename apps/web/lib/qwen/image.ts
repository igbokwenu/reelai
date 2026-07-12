import "server-only";

import { performance } from "node:perf_hooks";

import { qwenEndpoint } from "@/lib/qwen/endpoints";

export const QWEN_IMAGE_BASE_URL =
  qwenEndpoint(
    process.env.QWEN_IMAGE_BASE_URL,
    "https://dashscope-intl.aliyuncs.com/api/v1",
  );

export type QwenImageResult = {
  imageUrl: string;
  providerRequestId: string | null;
  elapsedMs: number;
  model: string;
};

export async function generateImageWithQwen({
  operation,
  model,
  prompt,
  size = "720*1280",
}: {
  operation: string;
  model: string;
  prompt: string;
  size?: string;
}): Promise<QwenImageResult> {
  const apiKey = getQwenApiKey();
  const startedAt = performance.now();
  const response = await fetch(
    `${QWEN_IMAGE_BASE_URL}/services/aigc/multimodal-generation/generation`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: {
          messages: [
            {
              role: "user",
              content: [{ text: prompt }],
            },
          ],
        },
        parameters: {
          size,
          n: 1,
          thinking_mode: true,
          watermark: false,
        },
      }),
    },
  );
  const elapsedMs = Math.round(performance.now() - startedAt);
  const providerRequestId =
    response.headers.get("x-request-id") ??
    response.headers.get("request-id") ??
    response.headers.get("x-dashscope-request-id");

  if (!response.ok) {
    console.info("QwenCloud image operation", {
      operation,
      model,
      status: "failed",
      elapsedMs,
      providerRequestId,
      error: `HTTP ${response.status}`,
    });
    throw new Error("QwenCloud image generation failed.");
  }

  const data = (await response.json()) as {
    output?: {
      choices?: Array<{
        message?: { content?: Array<{ image?: string }> };
      }>;
    };
  };
  const imageUrl =
    data.output?.choices?.[0]?.message?.content?.find((item) => item.image)
      ?.image ?? null;

  if (!imageUrl) {
    throw new Error("QwenCloud image response did not include an image URL.");
  }

  console.info("QwenCloud image operation", {
    operation,
    model,
    status: "complete",
    elapsedMs,
    providerRequestId,
  });

  return { imageUrl, providerRequestId, elapsedMs, model };
}

function getQwenApiKey() {
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey || apiKey.toLowerCase().includes("placeholder")) {
    throw new Error("QwenCloud API key is not configured on the server.");
  }

  return apiKey;
}
