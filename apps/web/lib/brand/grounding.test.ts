import { describe, expect, it } from "vitest";

import {
  findConceptGroundingViolations,
  getGroundingCapabilities,
  hardenImagePrompt,
  safeVisualMotifs,
} from "./grounding";

describe("creative grounding", () => {
  const websiteOnly = getGroundingCapabilities(
    [{ type: "WEBSITE", artifactId: null }],
    { claims: [{ claim: "Connects families with care" }] },
  );

  it("restricts product, UI, and logo fabrication for website-only projects", () => {
    expect(websiteOnly.hasUploadedVisuals).toBe(false);
    const prompt = hardenImagePrompt("A warm family scene", websiteOnly);
    expect(prompt).toContain("do not show phones");
    expect(prompt).toContain("do not render a logo");
  });

  it("rejects fabricated UI and logos while allowing ordinary trust language", () => {
    const violations = findConceptGroundingViolations(
      [
        {
          strategy: "A phone app interface with profile browsing",
          narrativeArc: "Show verified caregivers and the logo",
        },
      ],
      websiteOnly,
    );
    expect(violations).toHaveLength(2);
  });

  it("allows plain trust descriptors but requires evidence for accreditation claims", () => {
    expect(
      findConceptGroundingViolations(
        [{ strategy: "Introduce vetted, verified, certified caregivers" }],
        websiteOnly,
      ),
    ).toEqual([]);
    expect(
      findConceptGroundingViolations(
        [{ strategy: "Introduce licensed and background-checked caregivers" }],
        websiteOnly,
      ),
    ).toHaveLength(1);
  });

  it("removes product motifs and rejects product close-ups without a reference", () => {
    expect(
      safeVisualMotifs(["clean product detail", "human workflow context"], websiteOnly),
    ).not.toContain("clean product detail");
    expect(
      findConceptGroundingViolations(
        [{ previewPrompt: "A cinematic product close-up" }],
        websiteOnly,
      ),
    ).toHaveLength(1);
  });

  it("allows referenced UI and supported claims", () => {
    const grounded = getGroundingCapabilities(
      [
        {
          type: "REFERENCE_AD",
          artifactId: "artifact-1",
          metadata: { originalName: "app-screenshot.png" },
        },
        { type: "LOGO", artifactId: "artifact-2" },
      ],
      { claims: [{ claim: "Verified caregivers" }] },
    );
    expect(
      findConceptGroundingViolations(
        [{ strategy: "Show the app interface and verified caregivers with the logo" }],
        grounded,
      ),
    ).toEqual([]);
  });
});
