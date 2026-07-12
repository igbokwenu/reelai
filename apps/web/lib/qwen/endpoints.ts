export function qwenEndpoint(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized.replace(/\/+$/, "") : fallback;
}
