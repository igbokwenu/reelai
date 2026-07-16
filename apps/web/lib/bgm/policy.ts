export type BgmOutputMode = "STANDARD" | "PRODUCT_SHOWCASE";

/**
 * Product Showcase intentionally demonstrates the complete Reel AI mix on its
 * first final render. Standard reels continue to honor their storyboard choice.
 */
export function getInitialFinalBgmEnabled(
  outputMode: BgmOutputMode,
  storyboardEnabled: boolean | null | undefined,
) {
  return outputMode === "PRODUCT_SHOWCASE" || Boolean(storyboardEnabled);
}

/**
 * API callers may omit the setting. Showcase defaults on; an explicit false
 * always wins so users can create a voiceover-only re-render.
 */
export function resolveFinalBgmEnabled(
  outputMode: BgmOutputMode,
  requested: boolean | undefined,
) {
  return requested ?? outputMode === "PRODUCT_SHOWCASE";
}
