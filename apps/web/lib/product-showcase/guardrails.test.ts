import { describe, expect, it } from "vitest";

import {
  buildShowcaseMotionGuardrailBrief,
  findShowcaseConceptViolations,
  findShowcaseStoryboardViolations,
  type ShowcaseMotionPlan,
} from "./guardrails";

const safePlan: ShowcaseMotionPlan = {
  heroAction: "The bottle turns slowly through a narrow light sweep.",
  supportingMotion: "One soft reflection moves across the label.",
  cameraBehavior: "SLOW_PUSH_IN",
  humanPresence: "NO_PERSON",
  separationTreatment: "AVOID",
  safetyRationale:
    "The motion keeps the silhouette stable while producing a clear premium reveal.",
};

describe("Product Showcase motion guardrails", () => {
  it("allows restrained visible ingredient separation for layered food", () => {
    const plan: ShowcaseMotionPlan = {
      ...safePlan,
      heroAction:
        "The burger's verified ingredient layers lift slightly on one vertical axis, then settle once.",
      separationTreatment: "FOOD_LAYER_SEPARATION",
    };
    expect(
      findShowcaseConceptViolations(
        [
          {
            title: "Layered appetite",
            strategy:
              "Use a controlled ingredient-layer reveal before the intact burger settles into its hero pose.",
            motionPlan: plan,
          },
        ],
        [{ name: "Classic cheeseburger", details: "bun, patty, and cheese" }],
      ),
    ).toEqual([]);
  });

  it("blocks teardown for electronics and fabric", () => {
    const teardownPlan: ShowcaseMotionPlan = {
      ...safePlan,
      heroAction:
        "The headphones explode into floating internal components before reassembly.",
      separationTreatment: "VISIBLE_COMPONENT_SEPARATION",
    };
    const violations = findShowcaseConceptViolations(
      [{ title: "Inside out", motionPlan: teardownPlan }],
      [{ name: "Wireless headphones" }],
    );
    expect(violations.join(" ")).toMatch(/teardown|components/i);
  });

  it("uses the first intake product as the separation authority", () => {
    const violations = findShowcaseConceptViolations(
      [
        {
          title: "Mixed collection",
          motionPlan: {
            ...safePlan,
            heroAction:
              "The phone separates into layers while the burger remains static.",
            separationTreatment: "FOOD_LAYER_SEPARATION",
          },
        },
      ],
      [{ name: "Smartphone" }, { name: "Classic burger" }],
    );
    expect(violations.join(" ")).toMatch(/non-food product/i);
  });

  it("does not mistake an explicit avoidance rationale for teardown", () => {
    expect(
      findShowcaseConceptViolations(
        [
          {
            title: "Precision light",
            narrativeArc:
              "Avoid exploded views; the intact headphones rotate slowly and settle in a clean hero frame.",
            motionPlan: {
              ...safePlan,
              safetyRationale:
                "No teardown or internal components are shown; a calm rotation keeps the product exact.",
            },
          },
        ],
        [{ name: "Wireless headphones" }],
      ),
    ).toEqual([]);
  });

  it("blocks multiple humans and overloaded screen choreography", () => {
    const violations = findShowcaseStoryboardViolations(
      {
        continuityBible: {
          characters: "A couple use the product together.",
          cast: { mode: "MULTI_PERSON", members: [{}, {}] },
        },
        scenes: [
          {
            index: 1,
            shotPrompt:
              "Focused energy: two users rapidly scroll and tap while multiple screens flash as a fixed camera holds.",
          },
        ],
      },
      [{ name: "Mobile productivity app" }],
    );
    expect(violations.join(" ")).toMatch(/one person|multiple people/i);
    expect(violations.join(" ")).toMatch(/screen/i);
  });

  it("gives conservative category-aware guidance", () => {
    const brief = buildShowcaseMotionGuardrailBrief([
      { name: "Linen jacket", details: "woven fabric" },
    ]);
    expect(brief).toContain("FABRIC_OR_WEARABLE");
    expect(brief).toContain("Set separationTreatment to AVOID");
  });
});
