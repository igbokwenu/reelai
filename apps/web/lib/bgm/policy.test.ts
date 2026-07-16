import { describe, expect, it } from "vitest";

import { getInitialFinalBgmEnabled, resolveFinalBgmEnabled } from "./policy";

describe("final BGM policy", () => {
  it("defaults Product Showcase on even for legacy voiceover-only storyboards", () => {
    expect(getInitialFinalBgmEnabled("PRODUCT_SHOWCASE", false)).toBe(true);
    expect(resolveFinalBgmEnabled("PRODUCT_SHOWCASE", undefined)).toBe(true);
  });

  it("honors an explicit Product Showcase opt-out", () => {
    expect(resolveFinalBgmEnabled("PRODUCT_SHOWCASE", false)).toBe(false);
  });

  it("keeps the existing Standard reel defaults", () => {
    expect(getInitialFinalBgmEnabled("STANDARD", false)).toBe(false);
    expect(getInitialFinalBgmEnabled("STANDARD", true)).toBe(true);
    expect(resolveFinalBgmEnabled("STANDARD", undefined)).toBe(false);
  });
});
