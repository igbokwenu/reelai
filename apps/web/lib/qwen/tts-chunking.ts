export const QWEN_TTS_MAX_CHARS = 600;

export function chunkTtsText(text: string, maxChars = QWEN_TTS_MAX_CHARS) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let remaining = normalized;

  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars + 1);
    const splitAt = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
      window.lastIndexOf("; "),
      window.lastIndexOf(", "),
      window.lastIndexOf(" "),
    );
    const end = splitAt > 120 ? splitAt + 1 : maxChars;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}
