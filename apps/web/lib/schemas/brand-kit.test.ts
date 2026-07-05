import { describe, expect, it } from "vitest";

import { brandKitOutputSchema, parseBrandKitOutput } from "./brand-kit";

describe("brandKitOutputSchema", () => {
  it("accepts the structured Brand Kit shape saved by the agent", () => {
    expect(() =>
      brandKitOutputSchema.parse({
        summary:
          "Northstar Coffee is a small-batch cold brew subscription brand for busy founders who want a polished, reliable coffee ritual without slowing down.",
        valueProps: [
          {
            label: "Small-batch convenience",
            detail:
              "Positions cold brew as a ready ritual for teams and founders who need quality without cafe runs.",
          },
          {
            label: "Founder-friendly energy",
            detail:
              "Connects the offer to creative and operational focus rather than unsupported health claims.",
          },
        ],
        audience: "Busy founders and creative teams",
        tone: "Warm, focused, premium, and lightly editorial.",
        palette: [
          { name: "Cold Brew", hex: "#2A1810", usage: "Primary depth" },
          { name: "Cream", hex: "#F4E7D3", usage: "Background warmth" },
        ],
        visualMotifs: ["condensation", "morning desk", "glass bottle"],
        claims: [
          {
            claim: "Small-batch cold brew subscription",
            support: "Included in the project intake offer.",
            confidence: "high",
          },
        ],
        policyRisks: [
          {
            risk: "Avoid medical or productivity guarantees.",
            severity: "medium",
            mitigation:
              "Frame benefits as ritual, taste, and convenience rather than guaranteed performance.",
          },
        ],
        sourceCitations: [
          {
            sourceId: "project-intake",
            label: "Project intake",
            note: "Business, audience, and offer came from the intake form.",
          },
        ],
        lockedStyle:
          "Realistic vertical footage with tactile coffee details, warm contrast, clean captions, and founder-workday pacing.",
      }),
    ).not.toThrow();
  });

  it("rejects malformed palette colors before persistence", () => {
    const parsed = brandKitOutputSchema.safeParse({
      summary:
        "Northstar Coffee is a small-batch cold brew subscription brand for busy founders who want a polished, reliable coffee ritual without slowing down.",
      valueProps: [
        { label: "Convenience", detail: "A practical subscription angle." },
        { label: "Quality", detail: "A premium small-batch positioning." },
      ],
      audience: "Busy founders",
      tone: "Warm and focused",
      palette: [
        { name: "Bad color", hex: "brown", usage: "Primary depth" },
        { name: "Cream", hex: "#F4E7D3", usage: "Background warmth" },
      ],
      visualMotifs: ["coffee", "desk"],
      claims: [
        { claim: "Cold brew subscription", support: "Project intake", confidence: "high" },
      ],
      policyRisks: [
        { risk: "Avoid guarantees", severity: "low", mitigation: "Use cautious copy." },
      ],
      sourceCitations: [
        { sourceId: "project-intake", label: "Project intake", note: "Intake source." },
      ],
      lockedStyle:
        "Realistic vertical footage with tactile coffee details and clean caption pacing.",
    });

    expect(parsed.success).toBe(false);
  });

  it("normalizes wrapped model output aliases into the strict save shape", () => {
    const parsed = parseBrandKitOutput({
      brand_kit: {
        brand_summary:
          "Northstar Coffee sells small-batch cold brew subscriptions to busy founders and creative teams, positioning the offer around convenience, taste, and daily ritual.",
        value_props: [
          {
            label: "Cold brew subscription",
            detail:
              "A recurring coffee offer that can be framed as a convenient workday ritual.",
          },
          {
            label: "Small batch feel",
            detail:
              "The source context supports a warmer premium craft angle for the ad.",
          },
        ],
        audience: "Busy founders and creative teams",
        tone: "Warm, focused, practical, and brand-safe.",
        palette: [
          { name: "Coffee", hex: "#2A1810", usage: "Primary brand depth" },
          { name: "Cream", hex: "#F4E7D3", usage: "Soft background" },
        ],
        visual_motifs: ["cold brew bottle", "focused desk", "morning light"],
        claims: [
          {
            claim: "Small-batch cold brew subscription",
            support: "Project intake offer",
            confidence: "High",
          },
        ],
        policy_risks: [
          {
            risk: "Avoid productivity guarantees",
            severity: "Medium",
            mitigation: "Frame copy around convenience and ritual.",
          },
        ],
        source_citations: [
          {
            source_id: "project-intake",
            label: "Project intake",
            note: "Used for business, audience, and offer.",
          },
        ],
        locked_style:
          "Realistic vertical coffee ad with tactile close-ups, warm workday lighting, clean captions, and measured pacing.",
      },
    });

    expect(parsed.summary).toContain("Northstar Coffee");
    expect(parsed.claims[0]?.confidence).toBe("high");
    expect(parsed.policyRisks[0]?.severity).toBe("medium");
    expect(parsed.sourceCitations[0]?.sourceId).toBe("project-intake");
  });

  it("normalizes nulls and alternate no-offer fields instead of throwing", () => {
    const parsed = parseBrandKitOutput({
      result: {
        overview: null,
        key_messages: null,
        audience: null,
        tone: null,
        colors: null,
        visual_language: null,
        supported_claims: [
          {
            text: "Brand positioning should be grounded in source context.",
            evidence: "Website and intake context.",
            confidence: "Medium",
          },
        ],
        ad_policy_risks: [
          {
            issue: "Avoid invented product claims when offer is blank.",
            severity: "High",
            recommendation: "Use cautious brand positioning.",
          },
        ],
        references: [
          {
            id: "project-intake",
            title: "Project intake",
            detail: "Business and audience context.",
          },
        ],
        style_guide: null,
      },
    });

    expect(parsed.summary.length).toBeGreaterThanOrEqual(40);
    expect(parsed.valueProps).toHaveLength(2);
    expect(parsed.claims[0]?.confidence).toBe("medium");
    expect(parsed.policyRisks[0]?.severity).toBe("high");
  });

  it("normalizes implementation-guide Brand Kit output with long fields", () => {
    const longDetail =
      "This is a deliberately long model-generated value proposition that explains the customer, the offer, the emotional angle, the visual proof, and the short-form ad strategy in far more words than the persistence schema allows, because real structured model output often includes prose that is useful but too verbose for the database field limits.";
    const parsed = parseBrandKitOutput({
      brandKit: {
        summary:
          "A source-grounded business summary that is intentionally useful for a short-form ad studio and gives later agents enough context to create brand-safe concepts.",
        valueProps: [longDetail, { title: "Trust", description: longDetail }],
        targetAudience: "Founders, operators, and creative teams",
        tone: "Clear, helpful, energetic, and practical.",
        palette: [
          { hex: "#101010", label: "Charcoal" },
          { hex: "#B6FF4D", label: "Signal lime" },
        ],
        visualMotifs: [
          "workflow screenshots and product close-ups with clean captions",
          "human handoff moments and source-grounded brand proof",
        ],
        claims: [
          {
            claim:
              "The product helps teams plan short-form ads from source materials without starting from a blank page.",
            evidence: longDetail,
            source: "Uploaded brand kit and project intake",
            risk: "medium",
          },
        ],
        policyRisks: [
          {
            category: "Unsupported outcome claims",
            reason:
              "Avoid saying the tool guarantees sales, virality, platform approval, or measurable revenue lift.",
            severity: "warning",
          },
          {
            category: "Regulated claims",
            reason: "Do not imply medical, legal, or financial outcomes.",
            severity: "blocker",
          },
        ],
        lockedStyleLanguage:
          "Vertical editorial studio style with tactile product context, source-grounded text overlays, confident pacing, and conservative claims.",
        sourceCitations: [
          { label: "Project intake", url: "https://example.com" },
        ],
      },
    });

    expect(parsed.audience).toBe("Founders, operators, and creative teams");
    expect(parsed.valueProps[0]?.detail.length).toBeLessThanOrEqual(280);
    expect(parsed.palette[0]?.name).toBe("Charcoal");
    expect(parsed.claims[0]?.support.length).toBeLessThanOrEqual(260);
    expect(parsed.policyRisks[0]?.severity).toBe("medium");
    expect(parsed.policyRisks[1]?.severity).toBe("high");
    expect(parsed.lockedStyle).toContain("Vertical editorial");
  });
});
