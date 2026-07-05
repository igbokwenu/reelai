import "server-only";

import { z, type ZodType } from "zod";

import {
  parseQwenJson,
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
  const result = await qwenChatCompletion({
    operation,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: schemaName,
        schema: z.toJSONSchema(schema),
        strict: true,
      },
    },
  });

  return {
    data: parse(parseQwenJson(result.content)),
    model: result.model,
    providerRequestId: result.providerRequestId,
    elapsedMs: result.elapsedMs,
    usage: result.usage,
  };
}
