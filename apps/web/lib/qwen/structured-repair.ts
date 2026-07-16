export function preserveOriginalValues(
  original: unknown,
  repaired: unknown,
): unknown {
  if (
    repaired === undefined ||
    repaired === null ||
    (typeof repaired === "string" && repaired.trim().length === 0)
  ) {
    return original;
  }

  if (Array.isArray(repaired)) {
    if (!Array.isArray(original)) return repaired;
    return repaired.map((item, index) =>
      preserveOriginalValues(original[index], item),
    );
  }

  if (repaired && typeof repaired === "object" && !Array.isArray(repaired)) {
    const repairedRecord = repaired as Record<string, unknown>;
    const originalRecord =
      original && typeof original === "object" && !Array.isArray(original)
        ? (original as Record<string, unknown>)
        : {};
    const keys = new Set([
      ...Object.keys(originalRecord),
      ...Object.keys(repairedRecord),
    ]);
    return Object.fromEntries(
      [...keys].map((key) => [
        key,
        preserveOriginalValues(originalRecord[key], repairedRecord[key]),
      ]),
    );
  }

  return repaired;
}
