import { describe, expect, it } from "vitest";

import { QWEN_TTS_MAX_CHARS, chunkTtsText } from "./tts-chunking";

describe("chunkTtsText", () => {
  it("keeps chunks within the Qwen TTS model limit", () => {
    const text = Array.from({ length: 90 }, (_, index) => {
      return `Sentence ${index + 1} has enough words for a narration chunk.`;
    }).join(" ");
    const chunks = chunkTtsText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= QWEN_TTS_MAX_CHARS)).toBe(
      true,
    );
  });

  it("normalizes empty narration to no chunks", () => {
    expect(chunkTtsText("  \n\t  ")).toEqual([]);
  });
});
