import "server-only";

import { performance } from "node:perf_hooks";

import { qwenEndpoint } from "@/lib/qwen/endpoints";
import { hasQwenManagedUrl } from "@/lib/qwen/uploads";

export const QWEN_IMAGE_BASE_URL = qwenEndpoint(
  process.env.QWEN_IMAGE_BASE_URL,
  "https://dashscope-intl.aliyuncs.com/api/v1",
);

export type QwenImageResult = {
  imageUrl: string;
  providerRequestId: string | null;
  elapsedMs: number;
  model: string;
  attempts: number;
};

export class QwenImageError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly providerRequestId?: string | null,
    public readonly attempts = 1,
  ) {
    super(message);
    this.name = "QwenImageError";
  }
}

export async function generateImageWithQwen({
  operation,
  model,
  prompt,
  imageUrls = [],
  size = "720*1280",
}: {
  operation: string;
  model: string;
  prompt: string;
  imageUrls?: string[];
  size?: string;
}): Promise<QwenImageResult> {
  const apiKey = getQwenApiKey();
  const startedAt = performance.now();
  const requestBody = {
    model,
    input: {
      messages: [
        {
          role: "user",
          content: [
            { text: prompt },
            ...imageUrls.slice(0, 3).map((image) => ({ image })),
          ],
        },
      ],
    },
    parameters: {
      size,
      n: 1,
      ...(imageUrls.length === 0 ? { thinking_mode: true } : {}),
      watermark: false,
    },
  };
  const { response, attempts } = await fetchImageWithRetry({
    apiKey,
    body: requestBody,
  });
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
    throw new QwenImageError(
      sanitizeImageProviderError(response.status),
      response.status,
      providerRequestId,
      attempts,
    );
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
    throw new QwenImageError(
      "QwenCloud completed the image request without returning an image. Try again.",
      response.status,
      providerRequestId,
      attempts,
    );
  }

  console.info("QwenCloud image operation", {
    operation,
    model,
    status: "complete",
    elapsedMs,
    providerRequestId,
  });

  return { imageUrl, providerRequestId, elapsedMs, model, attempts };
}

async function fetchImageWithRetry({
  apiKey,
  body,
}: {
  apiKey: string;
  body: Record<string, unknown>;
}) {
  let response: Response | null = null;
  let lastNetworkError = false;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await fetch(
        `${QWEN_IMAGE_BASE_URL}/services/aigc/multimodal-generation/generation`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...(hasQwenManagedUrl(body)
              ? { "X-DashScope-OssResourceResolve": "enable" }
              : {}),
          },
          body: JSON.stringify(body),
        },
      );
      lastNetworkError = false;

      if (response.status !== 429 && response.status < 500) {
        return { response, attempts: attempt };
      }
    } catch {
      lastNetworkError = true;
    }

    if (attempt < 3) {
      await new Promise((resolve) =>
        setTimeout(resolve, 500 * 2 ** (attempt - 1)),
      );
    }
  }

  if (lastNetworkError || !response) {
    throw new QwenImageError(
      "QwenCloud image generation could not be reached. Try again in a moment.",
      undefined,
      null,
      3,
    );
  }

  return { response, attempts: 3 };
}

function sanitizeImageProviderError(status: number) {
  if (status === 401 || status === 403) {
    return "QwenCloud image authentication failed. Verify the server-side API key.";
  }
  if (status === 429) {
    return "QwenCloud image capacity or quota is temporarily unavailable. Try again shortly.";
  }
  if (status >= 500) {
    return "QwenCloud image generation is temporarily unavailable. Try again shortly.";
  }
  return "QwenCloud rejected the image request. Review the source image and prompt.";
}

function getQwenApiKey() {
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey || apiKey.toLowerCase().includes("placeholder")) {
    throw new Error("QwenCloud API key is not configured on the server.");
  }

  return apiKey;
}
