import "server-only";

import { z, type ZodType } from "zod";

import {
  parseQwenJson,
  QwenClientError,
  qwenChatCompletion,
  QWEN_STRUCTURED_MODEL,
} from "@/lib/qwen/client";

export async function generateStructuredWithQwen<T>({
  operation,
  schema,
  schemaName,
  system,
  user,
  model = QWEN_STRUCTURED_MODEL,
  parse = (value) => schema.parse(value),
}: {
  operation: string;
  schema: ZodType<T>;
  schemaName: string;
  system: string;
  user: string;
  model?: string;
  parse?: (value: unknown) => T;
}) {
  const messages = [
    { role: "system" as const, content: system },
    {
      role: "user" as const,
      content: `${user}\n\nReturn a single JSON object only. Do not wrap it in markdown.`,
    },
  ];
  const schemaResponseFormat = {
    type: "json_schema",
    json_schema: {
      name: schemaName,
      schema: z.toJSONSchema(schema),
      strict: true,
    },
  };
  let result;

  try {
    result = await qwenChatCompletion({
      operation,
      model,
      messages,
      enableThinking: false,
      responseFormat: schemaResponseFormat,
    });
  } catch (error) {
    if (!(error instanceof QwenClientError) || error.status !== 400) {
      throw error;
    }

    result = await qwenChatCompletion({
      operation: `${operation}_json_object_fallback`,
      model,
      messages,
      enableThinking: false,
      responseFormat: { type: "json_object" },
    });
  }

  return {
    data: parse(parseQwenJson(result.content)),
    model: result.model,
    providerRequestId: result.providerRequestId,
    elapsedMs: result.elapsedMs,
    usage: result.usage,
  };
}
