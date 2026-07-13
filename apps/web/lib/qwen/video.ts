import "server-only";

import { performance } from "node:perf_hooks";

import { qwenEndpoint } from "@/lib/qwen/endpoints";
import { isRetryableVideoSubmissionError } from "@/lib/qwen/video-retry";
import { buildVideoSubmissionBody } from "@/lib/qwen/video-request";

export const QWEN_VIDEO_BASE_URL = qwenEndpoint(
  process.env.QWEN_VIDEO_BASE_URL,
  "https://dashscope-intl.aliyuncs.com/api/v1",
);

export const QWEN_I2V_MODEL =
  process.env.QWEN_I2V_MODEL?.trim() || "wan2.7-i2v";

export type VideoTaskSubmission = {
  taskId: string;
  providerRequestId: string | null;
  elapsedMs: number;
  model: string;
};

export type VideoTaskStatus = {
  taskId: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
  videoUrl: string | null;
  message: string | null;
  providerRequestId: string | null;
};

type VideoSubmissionInput = {
  operation: string;
  model?: string;
  prompt: string;
  imageUrl: string;
  lastFrameUrl?: string;
  durationSec: number;
};

export async function submitImageToVideoTask(input: VideoSubmissionInput) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await submitImageToVideoTaskOnce(input);
    } catch (error) {
      lastError = error;
      if (attempt === 2 || !isRetryableVideoSubmissionError(error)) throw error;
      await wait(500 * 2 ** attempt);
    }
  }

  throw lastError;
}

async function submitImageToVideoTaskOnce({
  operation,
  model = QWEN_I2V_MODEL,
  prompt,
  imageUrl,
  lastFrameUrl,
  durationSec,
}: VideoSubmissionInput): Promise<VideoTaskSubmission> {
  const apiKey = getQwenApiKey();
  const startedAt = performance.now();
  const response = await fetch(
    `${QWEN_VIDEO_BASE_URL}/services/aigc/video-generation/video-synthesis`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify(
        buildVideoSubmissionBody({
          model,
          prompt,
          imageUrl,
          lastFrameUrl,
          durationSec,
        }),
      ),
    },
  );
  const elapsedMs = Math.round(performance.now() - startedAt);
  const providerRequestId = getProviderRequestId(response);

  if (!response.ok) {
    logVideoEvent({
      operation,
      model,
      status: "failed",
      elapsedMs,
      providerRequestId,
      error: `HTTP ${response.status}`,
    });
    throw new Error(sanitizeVideoProviderError(response.status));
  }

  const data = (await response.json()) as {
    output?: { task_id?: string };
  };
  const taskId = data.output?.task_id;

  if (!taskId) {
    throw new Error("QwenCloud video task response did not include a task id.");
  }

  logVideoEvent({
    operation,
    model,
    status: "submitted",
    elapsedMs,
    providerRequestId,
    taskId,
  });

  return { taskId, providerRequestId, elapsedMs, model };
}

export async function pollVideoTask(taskId: string): Promise<VideoTaskStatus> {
  const apiKey = getQwenApiKey();
  const response = await fetch(`${QWEN_VIDEO_BASE_URL}/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const providerRequestId = getProviderRequestId(response);

  if (!response.ok) {
    throw new Error(sanitizeVideoProviderError(response.status));
  }

  const data = (await response.json()) as {
    output?: {
      task_status?: string;
      video_url?: string;
      url?: string;
      message?: string;
      results?: Array<{ url?: string; video_url?: string }>;
    };
  };
  const rawStatus = data.output?.task_status ?? "UNKNOWN";
  const status = normalizeTaskStatus(rawStatus);
  const result = data.output?.results?.[0];
  const videoUrl =
    data.output?.video_url ??
    data.output?.url ??
    result?.video_url ??
    result?.url ??
    null;

  return {
    taskId,
    status,
    videoUrl,
    message: data.output?.message ?? null,
    providerRequestId,
  };
}

export function sanitizeVideoError(error: unknown) {
  if (error instanceof Error) {
    if (error instanceof TypeError || error.message.includes("fetch failed")) {
      return "Could not reach QwenCloud video generation after retrying. Try this scene again.";
    }

    if (error.message.includes("API key")) {
      return error.message;
    }

    if (error.message.includes("QwenCloud")) {
      return error.message;
    }
  }

  return "Video generation failed. Check server logs for sanitized provider metadata.";
}

function wait(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function normalizeTaskStatus(status: string): VideoTaskStatus["status"] {
  switch (status.toUpperCase()) {
    case "PENDING":
    case "QUEUED":
      return "PENDING";
    case "RUNNING":
      return "RUNNING";
    case "SUCCEEDED":
    case "SUCCESS":
      return "SUCCEEDED";
    case "FAILED":
    case "CANCELED":
    case "CANCELLED":
      return "FAILED";
    default:
      return "UNKNOWN";
  }
}

function getProviderRequestId(response: Response) {
  return (
    response.headers.get("x-request-id") ??
    response.headers.get("request-id") ??
    response.headers.get("x-dashscope-request-id")
  );
}

function getQwenApiKey() {
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey || apiKey.toLowerCase().includes("placeholder")) {
    throw new Error("QwenCloud API key is not configured on the server.");
  }

  return apiKey;
}

function sanitizeVideoProviderError(status: number) {
  if (status === 401 || status === 403) {
    return "QwenCloud authentication failed. Verify the server-side API key.";
  }

  if (status === 429) {
    return "QwenCloud video rate limit or quota was reached. Try again later.";
  }

  if (status >= 500) {
    return "QwenCloud video generation is temporarily unavailable. Try again later.";
  }

  return "QwenCloud rejected the video request. Review scene media and model settings.";
}

function logVideoEvent(event: {
  operation: string;
  model: string;
  status: "submitted" | "failed";
  elapsedMs: number;
  providerRequestId: string | null;
  taskId?: string;
  error?: string;
}) {
  console.info("QwenCloud video operation", event);
}
