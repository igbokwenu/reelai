import { describe, expect, it } from "vitest";

import {
  buildGroundingRecoveryInstructions,
  findConceptGroundingViolations,
  getGroundingCapabilities,
  hardenImagePrompt,
  recoverGroundedCreativeOutput,
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

  it("does not mistake explicit visual prohibitions for asset requests", () => {
    expect(
      findConceptGroundingViolations(
        [
          {
            startFramePrompt:
              "Warm human scene with no logo, wordmark, phone, or device screen.",
            endFramePrompt:
              "Reserve clean negative space for the logo to be composited later; keep the image logo-free until then.",
            continuityNotes:
              "Do not render branded clothing or product packaging; graphics are composited later.",
            policyNote: "Never claim a guaranteed result.",
          },
        ],
        websiteOnly,
      ),
    ).toEqual([]);
  });

  it("still detects an affirmative request after a contrasting prohibition", () => {
    expect(
      findConceptGroundingViolations(
        [
          {
            startFramePrompt:
              "Do not show a logo, but use a branded uniform in the final shot.",
          },
        ],
        websiteOnly,
      ),
    ).toEqual(["Concept 1 requests branding without a logo reference."]);
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
      safeVisualMotifs(
        ["clean product detail", "human workflow context"],
        websiteOnly,
      ),
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
        [
          {
            strategy:
              "Show the app interface and verified caregivers with the logo",
          },
        ],
        grounded,
      ),
    ).toEqual([]);
  });

  it("builds and applies a source-safe fallback without requiring uploads", () => {
    const violations = findConceptGroundingViolations(
      [
        {
          visual:
            "A branded uniform beside a phone dashboard and product close-up with a guaranteed result.",
        },
      ],
      websiteOnly,
    );
    const recovered = recoverGroundedCreativeOutput(
      {
        visual:
          "A branded uniform beside a phone dashboard and product close-up with a guaranteed result.",
      },
      websiteOnly,
    );

    expect(violations).toHaveLength(4);
    expect(findConceptGroundingViolations([recovered], websiteOnly)).toEqual(
      [],
    );
    expect(recovered.visual).toContain("plain neutral wardrobe");
    expect(recovered.visual).toContain("real-world human interaction");
    expect(recovered.visual).toContain("tactile environmental detail");
    expect(recovered.visual).toContain("designed to help");
    expect(
      buildGroundingRecoveryInstructions(violations, websiteOnly),
    ).toContain("Reserve clean negative space");
  });
});
