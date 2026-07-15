import "server-only";

import { z, ZodError, type ZodType } from "zod";

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
  jsonSchema,
  system,
  user,
  model = QWEN_STRUCTURED_MODEL,
  parse = (value) => schema.parse(value),
}: {
  operation: string;
  schema: ZodType<T>;
  schemaName: string;
  jsonSchema?: Record<string, unknown>;
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
      schema: jsonSchema ?? z.toJSONSchema(schema),
      strict: true,
    },
  };
  const requestStructuredCompletion = async (
    requestOperation: string,
    requestMessages: typeof messages,
  ) => {
    try {
      return await qwenChatCompletion({
        operation: requestOperation,
        model,
        messages: requestMessages,
        enableThinking: false,
        responseFormat: schemaResponseFormat,
      });
    } catch (error) {
      if (!(error instanceof QwenClientError) || error.status !== 400) {
        throw error;
      }

      console.warn(
        `[${requestOperation}] Strict JSON schema failed, falling back to json_object mode`,
      );
      return qwenChatCompletion({
        operation: `${requestOperation}_json_object_fallback`,
        model,
        messages: requestMessages,
        enableThinking: false,
        responseFormat: { type: "json_object" },
      });
    }
  };
  let result = await requestStructuredCompletion(operation, messages);

  const parsed = parseQwenJson(result.content);
  let data: T;

  try {
    data = parse(parsed);
  } catch (error) {
    if (!(error instanceof ZodError)) {
      throw error;
    }

    const repaired = await requestStructuredCompletion(
      `${operation}_schema_repair`,
      [
        {
          role: "system" as const,
          content:
            "You repair JSON so it exactly satisfies the requested schema. Preserve the creative intent, do not add private facts, and return JSON only.",
        },
        {
          role: "user" as const,
          content: [
            `The previous ${schemaName} JSON failed validation.`,
            `Validation issues: ${formatZodIssues(error)}`,
            "Original requirements (these remain mandatory during repair):",
            user,
            "Rewrite it to satisfy every required field with substantive, non-empty content.",
            "Invalid JSON:",
            JSON.stringify(parsed),
          ].join("\n\n"),
        },
      ],
    );

    data = parse(parseQwenJson(repaired.content));
    result = repaired;
  }

  return {
    data,
    model: result.model,
    providerRequestId: result.providerRequestId,
    elapsedMs: result.elapsedMs,
    usage: result.usage,
  };
}

function formatZodIssues(error: ZodError) {
  return error.issues
    .slice(0, 8)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}
