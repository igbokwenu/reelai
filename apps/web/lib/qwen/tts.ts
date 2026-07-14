import "server-only";

import { performance } from "node:perf_hooks";

import { qwenEndpoint } from "@/lib/qwen/endpoints";
import { QWEN_TTS_MAX_CHARS, chunkTtsText } from "@/lib/qwen/tts-chunking";

export const QWEN_TTS_MODEL = "qwen3-tts-flash";
export const QWEN_TTS_NATIVE_BASE_URL = qwenEndpoint(
  process.env.QWEN_TTS_BASE_URL,
  "https://dashscope-intl.aliyuncs.com/api/v1",
);

type TtsResult = {
  audioUrl: string;
  audioFormat: string;
  sampleRate: number | null;
  model: string;
  providerRequestId: string | null;
  elapsedMs: number;
  usage: unknown;
};

export class QwenTtsError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly providerRequestId?: string | null,
  ) {
    super(message);
    this.name = "QwenTtsError";
  }
}

export { QWEN_TTS_MAX_CHARS, chunkTtsText };

export async function synthesizeSpeechWithQwen({
  text,
  voice = "Cherry",
  model = QWEN_TTS_MODEL,
}: {
  text: string;
  voice?: string;
  model?: string;
}): Promise<TtsResult> {
  if (text.length > QWEN_TTS_MAX_CHARS) {
    throw new QwenTtsError("TTS chunk exceeds the 600 character model limit.");
  }

  const apiKey = getQwenApiKey();
  const startedAt = performance.now();
  const response = await fetch(
    `${QWEN_TTS_NATIVE_BASE_URL}/services/aigc/multimodal-generation/generation`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: {
          text,
          voice,
          language_type: "Auto",
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
    logTtsEvent({
      model,
      status: "failed",
      elapsedMs,
      providerRequestId,
      error: `HTTP ${response.status}`,
    });
    throw new QwenTtsError(
      sanitizeTtsError(response.status),
      response.status,
      providerRequestId,
    );
  }

  const data = (await response.json()) as {
    output?: {
      audio?: { url?: string; format?: string; sample_rate?: number };
    };
    usage?: unknown;
  };
  const audio = data.output?.audio;

  if (!audio?.url) {
    throw new QwenTtsError(
      "QwenCloud TTS returned no audio URL.",
      undefined,
      providerRequestId,
    );
  }

  logTtsEvent({
    model,
    status: "complete",
    elapsedMs,
    providerRequestId,
  });

  return {
    audioUrl: audio.url,
    audioFormat: audio.format ?? "wav",
    sampleRate: audio.sample_rate ?? null,
    model,
    providerRequestId,
    elapsedMs,
    usage: data.usage ?? null,
  };
}

export function sanitizeTtsFailure(error: unknown) {
  if (error instanceof QwenTtsError) {
    return error.message;
  }

  if (
    error instanceof Error &&
    /^(?:Scene \d+:|Provider narration audio|TTS WAV|TTS returned|At least one WAV)/.test(
      error.message,
    )
  ) {
    return error.message;
  }

  return "Narration generation failed. Check server logs for sanitized provider metadata.";
}

function getQwenApiKey() {
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey || apiKey.toLowerCase().includes("placeholder")) {
    throw new QwenTtsError(
      "QwenCloud API key is not configured on the server.",
    );
  }

  return apiKey;
}

function sanitizeTtsError(status: number) {
  if (status === 401 || status === 403) {
    return "QwenCloud TTS authentication failed. Verify the server-side API key.";
  }

  if (status === 429) {
    return "QwenCloud TTS rate limit or quota was reached. Try again later.";
  }

  if (status >= 500) {
    return "QwenCloud TTS is temporarily unavailable. Try again later.";
  }

  return "QwenCloud rejected the TTS request. Review narration text and voice settings.";
}

function logTtsEvent(event: {
  model: string;
  status: "complete" | "failed";
  elapsedMs: number;
  providerRequestId: string | null;
  error?: string;
}) {
  console.info("QwenCloud TTS operation", event);
}
