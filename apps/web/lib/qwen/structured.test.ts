import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const qwenChatCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/qwen/client", () => {
  class QwenClientError extends Error {
    constructor(
      message: string,
      public readonly status?: number,
    ) {
      super(message);
    }
  }

  return {
    parseQwenJson: (value: string) => JSON.parse(value),
    QwenClientError,
    qwenChatCompletion,
    QWEN_STRUCTURED_MODEL: "structured-test-model",
  };
});

import { generateStructuredWithQwen } from "@/lib/qwen/structured";

describe("structured generation recovery", () => {
  beforeEach(() => qwenChatCompletion.mockReset());

  it("uses bounded deterministic recovery when the model repair is still invalid", async () => {
    qwenChatCompletion
      .mockResolvedValueOnce({
        content: JSON.stringify({ name: "" }),
        model: "test-model",
        providerRequestId: "initial",
        elapsedMs: 10,
        usage: { input: 1 },
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({ name: "x" }),
        model: "test-model",
        providerRequestId: "repair",
        elapsedMs: 12,
        usage: { input: 2 },
      });

    const schema = z.object({ name: z.string().min(3) });
    const result = await generateStructuredWithQwen({
      operation: "test_structured_recovery",
      schema,
      schemaName: "test_schema",
      system: "Return JSON.",
      user: "Return a valid name.",
      recoverAfterRepair: () => ({ name: "Recovered internally" }),
    });

    expect(qwenChatCompletion).toHaveBeenCalledTimes(2);
    expect(result.data).toEqual({ name: "Recovered internally" });
    expect(result.structuredRecovery).toBe("DETERMINISTIC");
    expect(result.providerRequestId).toBe("repair");
  });
});
