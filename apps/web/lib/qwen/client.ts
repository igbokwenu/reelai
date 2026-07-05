import "server-only";

import { performance } from "node:perf_hooks";

export const QWEN_BASE_URL =
  process.env.QWEN_BASE_URL ??
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

export const QWEN_STRUCTURED_MODEL = "qwen3.7-plus";
export const QWEN_VISION_MODEL = "qwen3.6-plus";

type QwenMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

type QwenChatInput = {
  operation: string;
  model: string;
  messages: QwenMessage[];
  responseFormat?: unknown;
  temperature?: number;
  maxTokens?: number;
};

type QwenChatResult = {
  content: string;
  model: string;
  providerRequestId: string | null;
  elapsedMs: number;
  usage: unknown;
};

export class QwenClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly providerRequestId?: string | null,
  ) {
    super(message);
    this.name = "QwenClientError";
  }
}

export async function qwenChatCompletion(
  input: QwenChatInput,
): Promise<QwenChatResult> {
  const apiKey = getQwenApiKey();
  const startedAt = performance.now();
  const response = await fetch(`${QWEN_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens ?? 2400,
      response_format: input.responseFormat,
    }),
  });

  const elapsedMs = Math.round(performance.now() - startedAt);
  const providerRequestId =
    response.headers.get("x-request-id") ??
    response.headers.get("request-id") ??
    response.headers.get("x-dashscope-request-id");

  if (!response.ok) {
    logQwenEvent({
      operation: input.operation,
      model: input.model,
      status: "failed",
      elapsedMs,
      providerRequestId,
      error: `HTTP ${response.status}`,
    });
    throw new QwenClientError(
      sanitizeProviderError(response.status),
      response.status,
      providerRequestId,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
    usage?: unknown;
  };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    logQwenEvent({
      operation: input.operation,
      model: input.model,
      status: "failed",
      elapsedMs,
      providerRequestId,
      error: "Empty model response",
    });
    throw new QwenClientError(
      "The model returned an empty response.",
      undefined,
      providerRequestId,
    );
  }

  logQwenEvent({
    operation: input.operation,
    model: data.model ?? input.model,
    status: "complete",
    elapsedMs,
    providerRequestId,
  });

  return {
    content,
    model: data.model ?? input.model,
    providerRequestId,
    elapsedMs,
    usage: data.usage ?? null,
  };
}

export function parseQwenJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export function sanitizeQwenError(error: unknown) {
  if (error instanceof QwenClientError) {
    return error.message;
  }

  if (error instanceof SyntaxError) {
    return "The model response could not be parsed as JSON.";
  }

  return "Brand Kit generation failed. Check server logs for sanitized provider metadata.";
}

function getQwenApiKey() {
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey || apiKey.toLowerCase().includes("placeholder")) {
    throw new QwenClientError(
      "QwenCloud API key is not configured on the server.",
    );
  }

  return apiKey;
}

function sanitizeProviderError(status: number) {
  if (status === 401 || status === 403) {
    return "QwenCloud authentication failed. Verify the server-side API key.";
  }

  if (status === 429) {
    return "QwenCloud rate limit or quota was reached. Try again later.";
  }

  if (status >= 500) {
    return "QwenCloud is temporarily unavailable. Try again later.";
  }

  return "QwenCloud rejected the request. Review source size and model settings.";
}

function logQwenEvent(event: {
  operation: string;
  model: string;
  status: "complete" | "failed";
  elapsedMs: number;
  providerRequestId: string | null;
  error?: string;
}) {
  console.info("QwenCloud operation", event);
}
