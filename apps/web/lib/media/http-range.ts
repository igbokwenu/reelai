export function parseByteRange(value: string | null, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value ?? "");
  if (!match || size <= 0) return null;

  if (!match[1] && match[2]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    return {
      start: Math.max(0, size - suffixLength),
      end: size - 1,
    };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  const end = Math.min(size - 1, requestedEnd);

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return null;
  if (start < 0 || end < start || start >= size) return null;
  return { start, end };
}
