import { describe, expect, it } from "vitest";

import {
  findConceptGroundingViolations,
  getGroundingCapabilities,
  hardenImagePrompt,
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

  it("rejects fabricated UI and unsupported trust badges before image spend", () => {
    const violations = findConceptGroundingViolations(
      [
        {
          strategy: "A phone app interface with profile browsing",
          narrativeArc: "Show verified caregivers and the logo",
        },
      ],
      websiteOnly,
    );
    expect(violations).toHaveLength(3);
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
