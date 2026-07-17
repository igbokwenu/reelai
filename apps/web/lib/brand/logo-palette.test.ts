import { describe, expect, it } from "vitest";

import { applyLogoDominantColor } from "./logo-palette";

describe("logo-led working palette", () => {
  const palette = [
    { name: "Charcoal", hex: "#20262D", usage: "Primary text" },
    { name: "Soft light", hex: "#F4F1EA", usage: "Background" },
  ];

  it("promotes the analyzed dominant logo color to the first palette slot", () => {
    expect(
      applyLogoDominantColor(palette, [
        {
          kind: "LOGO_VISION",
          text: "DOMINANT_LOGO_COLOR: #B7FF3C\nA vivid green wordmark.",
        },
      ])[0],
    ).toMatchObject({ hex: "#B7FF3C", name: "Logo dominant" });
  });

  it("leaves the palette unchanged without explicit logo evidence", () => {
    expect(
      applyLogoDominantColor(palette, [
        { kind: "PRODUCT_IMAGE_VISION", text: "Dominant blue packaging." },
      ]),
    ).toEqual(palette);
  });
});
