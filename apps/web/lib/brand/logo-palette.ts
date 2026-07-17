import type { BrandKitOutput } from "@/lib/schemas/brand-kit";

type VisualContext = {
  kind: string;
  text: string;
};

export function applyLogoDominantColor(
  palette: BrandKitOutput["palette"],
  contexts: VisualContext[],
) {
  const logoAnalysis = contexts.find(
    (context) => context.kind === "LOGO_VISION",
  );
  const dominantHex = logoAnalysis?.text.match(
    /DOMINANT_LOGO_COLOR\s*:\s*(#[0-9A-Fa-f]{6})/i,
  )?.[1];
  if (!dominantHex) return palette;

  const normalizedHex = dominantHex.toUpperCase();
  const existing = palette.find(
    (item) => item.hex.toUpperCase() === normalizedHex,
  );
  const dominant = existing
    ? {
        ...existing,
        hex: normalizedHex,
        usage: "Primary logo-led brand accent and recurring visual cue",
      }
    : {
        name: "Logo dominant",
        hex: normalizedHex,
        usage: "Primary logo-led brand accent and recurring visual cue",
      };

  return [
    dominant,
    ...palette.filter((item) => item.hex.toUpperCase() !== normalizedHex),
  ].slice(0, 6);
}
