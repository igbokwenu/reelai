import { describe, expect, it } from "vitest";

import { productShowcaseStoryboardSchema } from "@/lib/schemas/agent";

import {
  buildShowcaseMotionGuardrailBrief,
  findShowcaseConceptViolations,
  findShowcaseStoryboardViolations,
  internallyRepairRazzmatazzConcepts,
  internallyRepairRazzmatazzStoryboard,
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

const razzmatazzPlan: ShowcaseMotionPlan = {
  ...safePlan,
  heroAction:
    "The intact bottle makes one crisp half-turn into a centered hero composition.",
  supportingMotion:
    "Ruby light streaks flare into a tight particle halo behind the product.",
  cameraBehavior: "FIXED",
  humanPresence: "NO_PERSON",
  separationTreatment: "AVOID",
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

  it("locks Razzmatazz to an intact product with no people", () => {
    expect(
      findShowcaseConceptViolations(
        [{ title: "Flash hero", motionPlan: razzmatazzPlan }],
        [{ name: "Studio bottle" }],
        true,
      ),
    ).toEqual([]);

    const violations = findShowcaseConceptViolations(
      [
        {
          title: "Too busy",
          motionPlan: {
            ...safePlan,
            humanPresence: "ONE_PERSON",
            separationTreatment: "VISIBLE_COMPONENT_SEPARATION",
          },
        },
      ],
      [{ name: "Modular lamp", details: "large visible modular pieces" }],
      true,
    );
    expect(violations.join(" ")).toMatch(/sole subject/i);
    expect(violations.join(" ")).toMatch(/intact|separation/i);
    const brief = buildShowcaseMotionGuardrailBrief(
      [{ name: "Studio bottle" }],
      true,
    );
    expect(brief).toContain("RAZZMATAZZ MODE IS ACTIVE");
    expect(brief).toContain("lasting 5 seconds");
    expect(brief).toContain("RAZZMATAZZ TRIAD");
  });

  it("rejects a static beauty shot that has no Razzmatazz spectacle", () => {
    const violations = findShowcaseStoryboardViolations(
      {
        continuityBible: {
          characters: "No people appear.",
          cast: { mode: "NO_PEOPLE", members: [] },
        },
        scenes: [
          {
            index: 1,
            shotPrompt:
              "Tense pressure: a dreamy soft-focus strawberry ice cream scoop highlights real fruit texture and condensation against a creamy bokeh background while a fixed camera holds the composition.",
          },
        ],
      },
      [{ name: "Strawberry ice cream" }],
      true,
    );

    expect(violations.join(" ")).toMatch(/spin|turn|pivot|glide/i);
    expect(violations.join(" ")).toMatch(/light|particle|energy effect/i);
    expect(violations.join(" ")).toMatch(/centered|sole focus|hero/i);
  });

  it("rejects people and package changes in a manually edited Razzmatazz shot", () => {
    const violations = findShowcaseStoryboardViolations(
      {
        continuityBible: {
          characters: "A single model holds the product.",
          cast: { mode: "SINGLE_PERSON", members: [{}] },
        },
        scenes: [
          {
            index: 1,
            shotPrompt:
              "Electric reveal: one hand lifts the cap while a fixed camera holds the bottle against a bright particle burst.",
          },
        ],
      },
      [{ name: "Studio bottle" }],
      true,
    );

    expect(violations.join(" ")).toMatch(/person|hands/i);
    expect(violations.join(" ")).toMatch(/opens|intact|transform/i);
  });

  it("repairs repeated model compliance misses internally", () => {
    const repaired = internallyRepairRazzmatazzConcepts(
      [
        {
          title: "Ruby Pivot",
          hook: "A sharp visual interruption.",
          strategy: "Use premium studio energy.",
          narrativeArc: "The bottle pivots as light streaks flare behind it.",
          visualStyle: "High-contrast commercial polish.",
          previewPrompt: "A static bottle against soft bokeh.",
          motionPlan: {
            ...safePlan,
            heroAction: "The bottle pivots once.",
            supportingMotion: "Light streaks flare behind it.",
          },
        },
        {
          title: "Elevated Hero Glide",
          hook: "A human hand creates the reveal.",
          strategy: "The package separates from its lid before rising.",
          narrativeArc: "The package separates and a model lifts it.",
          visualStyle: "Tactile editorial styling.",
          previewPrompt: "A hand holds the open package.",
          motionPlan: {
            ...safePlan,
            heroAction: "The package separates before it glides forward.",
            supportingMotion: "A passive glow surrounds it.",
            humanPresence: "ONE_PERSON",
            separationTreatment: "VISIBLE_COMPONENT_SEPARATION",
          },
        },
        {
          title: "Glint Spin",
          hook: "One compact product beat.",
          strategy: "Use one controlled product spin.",
          narrativeArc: "The bottle spins and settles in a hero frame.",
          visualStyle: "Minimal studio lighting.",
          previewPrompt: "A centered bottle in a dark studio.",
          motionPlan: {
            ...safePlan,
            heroAction:
              "The bottle spins and settles centered in the hero frame.",
            supportingMotion: "The background remains softly lit.",
          },
        },
      ],
      [{ name: "Northstar Bottle" }],
    );

    expect(
      findShowcaseConceptViolations(
        repaired,
        [{ name: "Northstar Bottle" }],
        true,
      ),
    ).toEqual([]);
    expect(repaired[1]?.motionPlan).toMatchObject({
      humanPresence: "NO_PERSON",
      separationTreatment: "AVOID",
    });
    expect(repaired[0]?.previewPrompt).toMatch(
      /motion|halo|sole visual focus/i,
    );
  });

  it("repairs a rejected Razzmatazz storyboard without user intervention", () => {
    const repaired = internallyRepairRazzmatazzStoryboard(
      {
        continuityBible: {
          product: "The package opens during the reveal.",
          characters: "A model presents the product.",
          cast: { mode: "SINGLE_PERSON", members: [{}] },
          visualWorld: "Soft bokeh.",
        },
        scenes: [
          {
            index: 1,
            durationSec: 5,
            captionText: "Taste the moment",
            voiceoverText: "Taste the moment.",
            shotPrompt:
              "Tense pressure: a dreamy soft-focus strawberry ice cream scoop highlights real fruit texture against a creamy bokeh background while a fixed camera holds the composition.",
            continuityNotes: "A hand keeps the package open.",
            continuityMode: "CONTINUOUS" as const,
            transitionStyle: "CUT" as const,
          },
        ],
      },
      [{ name: "Strawberry Ice Cream" }],
    );

    expect(
      findShowcaseStoryboardViolations(
        repaired,
        [{ name: "Strawberry Ice Cream" }],
        true,
      ),
    ).toEqual([]);
    expect(repaired.continuityBible?.cast).toEqual({
      mode: "NO_PEOPLE",
      members: [],
    });
    expect(repaired.scenes[0]?.shotPrompt).toMatch(
      /partial turn.*light streaks.*particle halo.*sole visual focus/i,
    );
    expect(
      productShowcaseStoryboardSchema.safeParse({
        title: "Five-second product spark",
        script: "Taste the moment with one unmistakable product hero beat.",
        bgm: {
          enabled: true,
          preset: "bold-kinetic",
          prompt: "An immediate premium hit with a clean final accent.",
        },
        continuityBible: repaired.continuityBible,
        scenes: repaired.scenes,
      }).success,
    ).toBe(true);
  });

  it("does not confuse visual separation from the background with teardown", () => {
    expect(
      findShowcaseConceptViolations(
        [
          {
            title: "Grounded pivot",
            strategy:
              "Use tonal separation from the background to strengthen the silhouette.",
            narrativeArc:
              "The bottle pivots as light streaks flare behind it and lands in a centered hero frame.",
            motionPlan: razzmatazzPlan,
          },
        ],
        [{ name: "Studio bottle" }],
        true,
      ),
    ).toEqual([]);
  });
});
