import { describe, expect, it } from "vitest";

import {
  castPlanSchema,
  creativeConceptRegenerationInputSchema,
  creativeConceptRegenerationJsonSchema,
  creativeConceptsSchema,
  creativeConceptsJsonSchema,
  parseCreativeConceptRegenerationOutput,
  parseCreativeConceptsOutput,
  parseStoryboardOutput,
  productShowcaseCreativeConceptsJsonSchema,
  productShowcaseStoryboardSchema,
  storyboardJsonSchema,
  storyboardSceneSchema,
  storyboardSchema,
} from "./agent";

const founderCast = {
  mode: "SINGLE_PERSON",
  members: [
    {
      role: "founder",
      recurrence: "RECURRING",
      ageBand: "adult in their 30s",
      referenceBasis: "FICTIONAL_CAST",
      appearanceAnchors: [
        "angular face",
        "short coiled hair",
        "tall lean build",
      ],
      complexionOrHeritageAnchor: "deep brown skin",
      wardrobeAnchor: "oat overshirt over a black tee",
      distinguishingFeature: "thin round glasses and a narrow jawline",
    },
  ],
};

describe("Phase 4 agent schemas", () => {
  it("requires exactly three creative concepts", () => {
    const concept = {
      title: "Founder Field Notes",
      hook: "A quick behind-the-scenes reason to care.",
      strategy:
        "Use a founder-led proof story instead of a direct product feature pitch.",
      narrativeArc:
        "Start with the hidden problem, show the thoughtful process, end on a clear offer.",
      visualStyle: "Warm documentary shots with crisp product details.",
      estimatedScenes: 3,
      estimatedDurationSec: 24,
      previewPrompt:
        "Vertical 9:16 documentary frame with warm product detail and subtle brand color.",
      rationale:
        "This direction builds trust by making the business feel specific and human.",
    };

    expect(
      creativeConceptsSchema.safeParse({
        concepts: [concept, concept, concept],
      }).success,
    ).toBe(true);
    expect(
      creativeConceptsSchema.safeParse({ concepts: [concept, concept] })
        .success,
    ).toBe(false);
  });

  it("keeps storyboards inside the MVP scene and duration window", () => {
    const scene = (index: number) => {
      const shotPrompts = [
        "Tense reveal: the package lid lifts in the foreground while the fixed camera holds a customer's surprised reaction behind it.",
        "Quiet confidence: the product rotates across a narrow pool of light as the camera slowly pushes in toward its tactile finish.",
        "Earned relief: the founder steps away from the finished display while a fixed camera holds the clean final arrangement.",
      ];

      return {
        index,
        durationSec: 8,
        captionText: `Scene ${index}`,
        voiceoverText: "A concise narration chunk for the scene.",
        shotPrompt: shotPrompts[index - 1],
        continuityNotes:
          "Keep the same palette, lighting, product shape, and caption placement.",
        continuityMode: index === 2 ? "MATCH_CUT" : "CONTINUOUS",
      };
    };

    expect(
      storyboardSchema.safeParse({
        title: "Compact launch reel",
        script:
          "A short script that introduces the pain, shows the offer, and ends with a direct call to action.",
        bgm: {
          enabled: true,
          preset: "warm pulse",
          prompt: "Light upbeat percussion with restrained synth texture.",
        },
        continuityBible: {
          product:
            "Keep the same product shape, finish, proportions, and color.",
          characters:
            "Keep the same cast, wardrobe, hair, and defining features.",
          cast: founderCast,
          visualWorld:
            "Keep warm side light, a restrained palette, and the same lens language.",
        },
        scenes: [scene(1), scene(2), scene(3)],
      }).success,
    ).toBe(true);
    expect(
      storyboardSchema.safeParse({
        title: "Too short",
        script:
          "A short script that introduces the pain, shows the offer, and ends with a direct call to action.",
        bgm: {
          enabled: true,
          preset: "warm pulse",
          prompt: "Light upbeat percussion with restrained synth texture.",
        },
        continuityBible: {
          product:
            "Keep the same product shape, finish, proportions, and color.",
          characters:
            "Keep the same cast, wardrobe, hair, and defining features.",
          cast: founderCast,
          visualWorld:
            "Keep warm side light, a restrained palette, and the same lens language.",
        },
        scenes: [scene(1)],
      }).success,
    ).toBe(false);
  });

  it("normalizes common model variants for creative concepts", () => {
    const makeConcept = (index: number) => ({
      title: `Direction ${index}`,
      hook: `Hook ${index}: make the business feel immediately useful.`,
      approach:
        "Lead with a proof-led story instead of a generic feature list.",
      narrative_arc:
        "Open on the customer problem, move into the branded solution, and end with a direct call to action.",
      visual_style:
        "Clean vertical product-led visuals with warm human context.",
      estimated_scenes: "3 scenes",
      estimatedDuration: "24 seconds",
      preview_prompt:
        "Vertical 9:16 preview frame with branded product detail, warm light, and clean caption-safe composition.",
      why_it_works:
        "This gives the reviewer a distinct strategy while keeping claims conservative.",
    });

    const parsed = parseCreativeConceptsOutput({
      creative_concepts: [makeConcept(1), makeConcept(2), makeConcept(3)],
    });

    expect(parsed.concepts).toHaveLength(3);
    expect(parsed.concepts[0]?.estimatedDurationSec).toBe(24);
    expect(parsed.concepts[0]?.narrativeArc).toContain("customer problem");
  });

  it("rejects incomplete scene-like concepts instead of filling generic strategy text", () => {
    const sceneLikeConcept = (index: number) => ({
      title: `The Example ${index}`,
      hook: "Need assistance at home?",
      visualStyle:
        "Medium shot of a person in a comfortable home environment with neutral tones.",
      estimatedScenes: 3,
      estimatedDurationSec: 20,
      previewPrompt:
        "Vertical 9:16 preview frame with a calm home-care scene and clear safe-zone composition.",
    });

    expect(() =>
      parseCreativeConceptsOutput({
        concepts: [
          sceneLikeConcept(1),
          sceneLikeConcept(2),
          sceneLikeConcept(3),
        ],
      }),
    ).toThrow();
  });

  it("defines an explicit strict provider JSON schema for concept generation", () => {
    const concepts = creativeConceptsJsonSchema.properties.concepts;

    expect(creativeConceptsJsonSchema.additionalProperties).toBe(false);
    expect(concepts.minItems).toBe(3);
    expect(concepts.maxItems).toBe(3);
    expect(concepts.items.required).toContain("strategy");
    expect(concepts.items.required).toContain("rationale");
    expect(concepts.items.properties.strategy.minLength).toBe(20);
    expect(concepts.items.properties.rationale.minLength).toBe(20);
  });

  it("requires a structured Product Showcase motion decision", () => {
    const item =
      productShowcaseCreativeConceptsJsonSchema.properties.concepts.items;
    expect(item.required).toContain("motionPlan");
    expect(item.properties.motionPlan.required).toEqual([
      "heroAction",
      "supportingMotion",
      "cameraBehavior",
      "humanPresence",
      "separationTreatment",
      "safetyRationale",
    ]);
    expect(item.properties.motionPlan.properties.humanPresence.enum).toEqual([
      "NO_PERSON",
      "ONE_PERSON",
    ]);
  });

  it("normalizes common safe motion-plan aliases from provider output", () => {
    const concept = (index: number) => ({
      title: `Polo direction ${index}`,
      hook: "Let the exact polo silhouette carry the first-frame reveal.",
      strategy:
        "Use a restrained material-first product film with one readable action and no teardown.",
      narrativeArc:
        "Open on the intact polo, move through one fabric response, and close on a calm hero frame.",
      visualStyle:
        "Premium pearl studio light with tactile cotton texture and deep shadow.",
      estimatedScenes: 2,
      estimatedDurationSec: 10,
      previewPrompt:
        "Vertical 9:16 intact polo in pearl studio light, exact silhouette, clean background, no text.",
      rationale:
        "The restrained motion keeps the garment recognizable while giving the reveal a premium payoff.",
      motionPlan: {
        heroAction: "The intact polo turns slowly into a clean hero angle.",
        supportingMotion: "One soft fabric ripple crosses the sleeve.",
        cameraBehavior: "slow zoom in",
        humanPresence: "NO_PEOPLE",
        separationTreatment: "NO_TEARDOWN",
        safetyRationale:
          "The intact silhouette and one fabric response are stable for image-to-video generation.",
      },
    });
    const parsed = parseCreativeConceptsOutput(
      { concepts: [concept(1), concept(2), concept(3)] },
      "PRODUCT_SHOWCASE",
      10,
    );

    expect(parsed.concepts[0]?.motionPlan).toMatchObject({
      cameraBehavior: "SLOW_PUSH_IN",
      humanPresence: "NO_PERSON",
      separationTreatment: "AVOID",
    });
  });

  it("reports nested motion-plan paths when an alias is genuinely unknown", () => {
    const invalid = {
      title: "Unknown motion",
      hook: "Keep the product readable from the first frame onward.",
      strategy:
        "Use one controlled hero action with a simple camera and stable product geometry.",
      narrativeArc:
        "Open on the product, complete one action, and settle into the final hero composition.",
      visualStyle: "Clean studio light with restrained product-first styling.",
      estimatedScenes: 1,
      estimatedDurationSec: 5,
      previewPrompt:
        "Vertical product hero frame with clean studio light and no generated text.",
      rationale:
        "The concept remains readable and preserves the exact supplied product identity.",
      motionPlan: {
        heroAction: "The product rotates slowly into its hero angle.",
        supportingMotion: "None",
        cameraBehavior: "FIXED",
        humanPresence: "A_FEW_PEOPLE",
        separationTreatment: "AVOID",
        safetyRationale:
          "The stable frame keeps product geometry clear throughout the shot.",
      },
    };

    try {
      parseCreativeConceptsOutput(
        { concepts: [invalid, invalid, invalid] },
        "PRODUCT_SHOWCASE",
        5,
      );
      throw new Error("Expected Product Showcase validation to fail");
    } catch (error) {
      const issues = (error as { issues?: Array<{ path: PropertyKey[] }> })
        .issues;
      expect(issues?.[0]?.path.join(".")).toBe(
        "concepts.0.motionPlan.humanPresence",
      );
    }
  });

  it("never permits a multi-person Product Showcase cast", () => {
    const scene = {
      index: 1,
      durationSec: 5,
      captionText: "See it clearly",
      voiceoverText: "Made for the moment.",
      shotPrompt:
        "Quiet precision: the product rotates through one light sweep while a fixed camera holds its clean silhouette.",
      continuityNotes:
        "Keep the product geometry, palette, lighting, and position stable.",
      continuityMode: "CONTINUOUS" as const,
      transitionStyle: "CUT" as const,
    };
    const result = productShowcaseStoryboardSchema.safeParse({
      title: "Unsafe group showcase",
      script: "A concise product narration closes with one clear action.",
      bgm: {
        enabled: false,
        preset: "none",
        prompt: "Voiceover only; no background music.",
      },
      continuityBible: {
        product: "Keep the exact supplied product geometry and materials.",
        characters: "Two models remain beside the product.",
        cast: {
          mode: "MULTI_PERSON",
          members: [
            founderCast.members[0],
            {
              ...founderCast.members[0],
              role: "customer",
              distinguishingFeature: "square glasses and a rounded jawline",
            },
          ],
        },
        visualWorld: "Keep the same quiet studio and narrow pearl light.",
      },
      scenes: [scene],
    });
    expect(result.success).toBe(false);
  });

  it("validates and normalizes one concept regeneration", () => {
    const parsed = parseCreativeConceptRegenerationOutput({
      concept: {
        title: "A Fresh Ritual",
        hook: "Turn an ordinary daily moment into a branded ritual.",
        approach:
          "Use a relatable ritual transformation instead of repeating the other product or founder-led directions.",
        narrative_arc:
          "Open on a flat routine, introduce the brand as the turning point, and close on a satisfying repeatable ritual.",
        visual_style:
          "Warm tactile close-ups with a restrained palette and rhythmic match cuts.",
        estimated_scenes: "3 scenes",
        estimatedDuration: "22 seconds",
        preview_prompt:
          "Vertical 9:16 tactile lifestyle frame with warm light, restrained brand colors, and clean safe-zone composition.",
        why_it_works:
          "The ritual framing makes the offer memorable without relying on unsupported performance claims.",
      },
    });

    expect(parsed.concept.title).toBe("A Fresh Ritual");
    expect(parsed.concept.estimatedDurationSec).toBe(22);
    expect(creativeConceptRegenerationJsonSchema.required).toEqual(["concept"]);
  });

  it("keeps concept adjustment notes concise", () => {
    expect(
      creativeConceptRegenerationInputSchema.parse({
        adjustmentNote: "  More playful  ",
      }),
    ).toEqual({ adjustmentNote: "More playful" });
    expect(
      creativeConceptRegenerationInputSchema.safeParse({
        adjustmentNote: "x".repeat(501),
      }).success,
    ).toBe(false);
  });

  it("normalizes storyboard variants before strict validation", () => {
    const scene = (index: number) => ({
      index,
      duration: "8 seconds",
      caption: `Scene ${index}`,
      voiceover: "A concise source-grounded narration line.",
      start_frame_prompt:
        "Vertical branded opening frame with clean product detail and safe-zone composition.",
      end_frame_prompt:
        "Vertical branded ending frame that preserves palette, subject, and lighting.",
      motionPrompt:
        index === 1
          ? "Tense anticipation. One founder lifts the bottle."
          : "Calm focus: the product turns gently into the foreground as the camera slowly pushes in toward its textured label.",
      continuity_notes:
        "Keep palette, lighting, subject identity, and caption placement consistent.",
    });

    const parsed = parseStoryboardOutput({
      title: "Launch reel",
      copy: "A compact launch script that frames the problem, shows the brand answer, and closes clearly.",
      music: {
        mood: "warm pulse",
        description: "Light upbeat background bed.",
      },
      continuity_bible: {
        product:
          "Keep the same recurring product geometry and finish across scenes.",
        characters:
          "Keep the fictional founder's identity and wardrobe stable across scenes.",
        cast_plan: founderCast,
        visual_world:
          "Keep warm morning light and the same restrained studio palette.",
      },
      storyboard_scenes: [scene(1), scene(2), scene(3)],
    });

    expect(parsed.scenes).toHaveLength(3);
    expect(parsed.scenes[0]?.durationSec).toBe(8);
    expect(parsed.scenes[0]?.shotPrompt).toBe(
      "Tense anticipation: One founder lifts the bottle, while a fixed camera holds the composition.",
    );
    expect(parsed.bgm.preset).toBe("warm pulse");
    expect(parsed.continuityBible.product).toContain("recurring product");
    expect(parsed.continuityBible.cast.mode).toBe("SINGLE_PERSON");
    expect(parsed.scenes[0]?.continuityMode).toBe("CONTINUOUS");
  });

  it("repairs Product Showcase prose and timing to the exact project target", () => {
    const scene = (index: number) => ({
      index,
      durationSec: 8,
      captionText: index === 1 ? "Meet the ritual" : "Made to glow",
      voiceoverText:
        "A considered product ritual designed to make every detail feel effortless and memorable.",
      shotPrompt:
        index === 1
          ? "Confident reveal. The serum bottle shimmers as its cap lifts from the neck. The camera slowly pushes in toward the label."
          : "Tactile delight. A ribbon separates from the package as the fixed camera holds the composition.",
      continuityNotes:
        "Keep the exact bottle silhouette, label, finish, and warm studio light.",
      continuityMode: "CONTINUOUS",
    });

    const parsed = parseStoryboardOutput(
      {
        title: "Ten second product reveal",
        script:
          "A compact product reveal that moves from tactile anticipation to a crisp branded finish.",
        bgm: {
          enabled: true,
          preset: "polished pulse",
          prompt: "A restrained premium pulse with a tactile finish.",
        },
        continuityBible: {
          product:
            "Preserve the exact serum bottle, cap, label, colors, and material finish.",
          characters:
            "No people appear; keep the visual focus entirely on the supplied product.",
          cast: { mode: "NO_PEOPLE", members: [] },
          visualWorld:
            "Warm controlled studio light, rich shadows, and premium macro texture.",
        },
        scenes: [scene(1), scene(2)],
      },
      "PRODUCT_SHOWCASE",
      10,
    );

    expect(parsed.scenes).toHaveLength(2);
    expect(parsed.scenes.map((item) => item.durationSec)).toEqual([5, 5]);
    expect(parsed.scenes[0]?.shotPrompt).toMatch(
      /^Confident reveal: .+slow push-in.+\.$/,
    );
    expect(
      parsed.scenes[0]?.voiceoverText.split(/\s+/).filter(Boolean).length,
    ).toBeLessThanOrEqual(12);
    expect(parsed.scenes[0]?.voiceoverText).not.toMatch(/\band\.$/i);
    expect(parsed.bgm).toEqual({
      enabled: true,
      preset: "polished pulse",
      prompt: "A restrained premium pulse with a tactile finish.",
    });
  });

  it("derives missing storyboard script and default-on showcase BGM metadata without a paid reroll", () => {
    const parsed = parseStoryboardOutput(
      {
        title: "Sarah's signature finish",
        script: "",
        bgm: { enabled: false, preset: "", prompt: "" },
        continuityBible: {
          product:
            "Preserve the exact frozen dessert, serving cup, colors, texture, and verified toppings.",
          characters:
            "No people appear; keep the supplied dessert as the only focal subject.",
          cast: { mode: "NO_PEOPLE", members: [] },
          visualWorld:
            "Rich studio shadows, cool highlights, and premium macro food texture.",
        },
        scenes: [
          {
            index: 1,
            durationSec: 5,
            captionText: "Taste the signature finish",
            voiceoverText:
              "A joyful scoop, finished with Sarah's signature flourish.",
            shotPrompt:
              "Elegant anticipation: Sarah's frozen dessert turns briefly as verified toppings fall while a fixed camera holds the composition.",
            continuityNotes:
              "Keep the exact dessert, cup, toppings, cool highlights, and centered scale.",
            continuityMode: "CONTINUOUS",
            transitionStyle: "CUT",
          },
        ],
      },
      "PRODUCT_SHOWCASE",
      5,
    );

    expect(parsed.script).toBe(
      "A joyful scoop, finished with Sarah's signature flourish.",
    );
    expect(parsed.bgm).toEqual({
      enabled: true,
      preset: "cinematic-wonder",
      prompt:
        "Premium instrumental background music matched to the product mood and kept beneath narration.",
    });
  });

  it("uses a safe disabled-music fallback for standard storyboards too", () => {
    const scene = (index: number) => ({
      index,
      durationSec: 8,
      captionText: index === 1 ? "A calmer start" : "Move with confidence",
      voiceoverText:
        index === 1
          ? "A thoughtful start makes every next step feel clearer."
          : "Move forward with support designed around what matters.",
      shotPrompt:
        index === 1
          ? "Quiet assurance: the founder opens the studio door while a fixed camera holds the welcoming layered composition."
          : "Earned confidence: the founder steps into warm daylight as the camera slowly pushes in toward her relaxed expression.",
      continuityNotes:
        "Preserve the founder's face, wardrobe, warm palette, screen direction, and morning light.",
      continuityMode: "CONTINUOUS",
      transitionStyle: "CUT",
    });
    const parsed = parseStoryboardOutput({
      title: "A confident next step",
      script: "",
      continuityBible: {
        product:
          "No recurring product appears; keep the service story visually grounded.",
        characters:
          "Keep the fictional founder's face, age, hair, and wardrobe stable.",
        cast: { mode: "NO_PEOPLE", members: [] },
        visualWorld:
          "Warm morning light, grounded studio textures, and a calm neutral palette.",
      },
      scenes: [scene(1), scene(2)],
    });

    expect(parsed.script).toContain("A thoughtful start");
    expect(parsed.bgm).toEqual({
      enabled: false,
      preset: "none",
      prompt: "Voiceover only; no background music.",
    });
  });

  it("deterministically repairs substantive storyboard prose without paid reroll luck", () => {
    const parsed = parseStoryboardOutput(
      {
        title: "Controlled product appetite",
        script:
          "A premium food reveal that holds product identity steady and closes on a concise invitation.",
        bgm: {
          enabled: true,
          preset: "restrained pulse",
          prompt: "A polished low-tempo pulse with a warm tactile finish.",
        },
        continuityBible: {
          product:
            "Preserve the exact burger stack, toasted bun, fillings, proportions, and plate.",
          characters:
            "No people appear; keep the supplied food product as the only focal subject.",
          cast: { mode: "NO_PEOPLE", members: [] },
          visualWorld:
            "Controlled warm studio highlights, deep shadows, and premium macro detail.",
        },
        scenes: [
          {
            index: 1,
            durationSec: 5,
            captionText: "Made with intention",
            voiceoverText: "Every layer is made to invite a closer look.",
            shotPrompt:
              "Camera slowly pushes in. The burger remains centered beneath warm highlights. Steam hangs above the plate.",
            continuityNotes:
              "Keep the exact stack, plate, warm highlights, and centered placement.",
            continuityMode: "CONTINUOUS",
          },
          {
            index: 2,
            durationSec: 5,
            captionText: "Take the first bite",
            voiceoverText: "Discover the Deluxe Burger today.",
            shotPrompt:
              "Confident finish: steam drifts above the burger as the camera slowly pushes in while a gentle product orbit circles the plate.",
            continuityNotes:
              "Preserve the same stack, plate, palette, highlights, and product scale.",
            continuityMode: "MATCH_CUT",
          },
        ],
      },
      "PRODUCT_SHOWCASE",
      10,
    );

    for (const scene of parsed.scenes) {
      expect(storyboardSceneSchema.safeParse(scene).success).toBe(true);
      expect(scene.shotPrompt.match(/[.!?]/g) ?? []).toHaveLength(1);
    }
    expect(parsed.scenes[1]?.shotPrompt).toContain("slow push-in");
    expect(parsed.scenes[1]?.shotPrompt).not.toContain("product orbit");
  });

  it("keeps creative interest heuristics advisory instead of blocking a safe shot", () => {
    expect(
      storyboardSceneSchema.safeParse({
        index: 1,
        durationSec: 6,
        captionText: "Premium detail",
        voiceoverText: "A considered finish, made to be remembered.",
        shotPrompt:
          "Premium stillness: the burger rests beneath controlled studio highlights while a fixed camera holds the composition with rich material detail.",
        continuityNotes:
          "Preserve the supplied burger, plate, studio palette, and warm highlights.",
        continuityMode: "CONTINUOUS",
      }).success,
    ).toBe(true);
  });

  it("collapses an over-segmented five-second showcase into one hero clip", () => {
    const overSegmented = {
      title: "Five second product reveal",
      script:
        "A compact product reveal that moves from tactile anticipation to a crisp branded finish.",
      bgm: {
        enabled: true,
        preset: "polished pulse",
        prompt: "A restrained premium pulse with a tactile finish.",
      },
      continuityBible: {
        product: "Preserve the exact package silhouette, colors, and finish.",
        characters:
          "No people appear; keep the visual focus entirely on the supplied product.",
        cast: { mode: "NO_PEOPLE", members: [] },
        visualWorld:
          "Warm controlled studio light, rich shadows, and premium macro texture.",
      },
      scenes: [
        {
          index: 1,
          durationSec: 5,
          captionText: "Unwrap",
          voiceoverText: "Meet the new ritual.",
          shotPrompt:
            "Tactile anticipation: the ribbon separates from the package while a fixed camera holds the layered composition behind it.",
          continuityNotes:
            "Keep the exact package silhouette, ribbon, finish, and lighting.",
          continuityMode: "CONTINUOUS",
        },
        {
          index: 2,
          durationSec: 5,
          captionText: "Reveal",
          voiceoverText: "Made for the moment.",
          shotPrompt:
            "Confident reveal: the product rises into warm light as the camera slowly pushes in toward its tactile finish.",
          continuityNotes:
            "Keep the exact product silhouette, materials, finish, and lighting.",
          continuityMode: "CONTINUOUS",
        },
      ],
    };

    const parsed = parseStoryboardOutput(overSegmented, "PRODUCT_SHOWCASE", 5);

    expect(parsed.scenes).toHaveLength(1);
    expect(parsed.scenes[0]).toMatchObject({
      index: 1,
      durationSec: 5,
      captionText: "Reveal",
      voiceoverText: "Made for the moment.",
      shotPrompt:
        "Tactile anticipation: the ribbon separates from the package while a fixed camera holds the layered composition behind it.",
      continuityMode: "CONTINUOUS",
      transitionStyle: "CUT",
    });
  });

  it.each([
    {
      label: "caption",
      sceneCopy: {
        voiceoverText:
          "Taste Sarah's handcrafted freshness, finished for the moment.",
      },
    },
    {
      label: "voiceover",
      sceneCopy: {
        captionText:
          "Taste Sarah's handcrafted freshness, finished for the moment.",
      },
    },
  ])(
    "recovers missing $label and safe product-only continuity metadata locally",
    ({ sceneCopy }) => {
      const parsed = parseStoryboardOutput(
        {
          title: "Sarah's signature finish",
          script: "",
          continuityBible: {
            product:
              "Preserve the exact frozen dessert, serving cup, colors, texture, and verified toppings.",
            visualWorld:
              "Rich studio shadows, cool highlights, and premium macro food texture.",
          },
          scenes: [
            {
              index: 1,
              durationSec: 5,
              ...sceneCopy,
              shotPrompt:
                "Joyful appetite: the frozen dessert turns briefly beneath cool highlights while verified toppings fall as a fixed camera holds the composition.",
            },
          ],
        },
        "PRODUCT_SHOWCASE",
        5,
      );

      expect(parsed.scenes).toHaveLength(1);
      expect(parsed.scenes[0]?.captionText).toBe(
        "Taste Sarah's handcrafted freshness, finished for the moment.",
      );
      expect(parsed.scenes[0]?.voiceoverText).toBe(
        "Taste Sarah's handcrafted freshness, finished for the moment.",
      );
      expect(parsed.scenes[0]?.continuityNotes).toContain(
        "Preserve the focal subject",
      );
      expect(parsed.continuityBible.characters).toContain("No people appear");
      expect(parsed.continuityBible.cast).toEqual({
        mode: "NO_PEOPLE",
        members: [],
      });
      expect(parsed.bgm.enabled).toBe(true);
    },
  );

  it("rejects incomplete storyboards instead of filling generic scene prompts", () => {
    expect(() =>
      parseStoryboardOutput({
        title: "Care intro",
        script:
          "A short script that introduces the care need and points viewers to the service.",
        bgm: {
          enabled: true,
          preset: "calm",
          prompt: "Soft warm background music.",
        },
        scenes: [
          {
            index: 1,
            durationSec: 8,
            captionText: "Need support at home?",
            voiceoverText: "Getting reliable help should feel simple.",
          },
          {
            index: 2,
            durationSec: 8,
            captionText: "Find the right match.",
            voiceoverText: "Choose care that fits your family.",
          },
        ],
      }),
    ).toThrow();
  });

  it("defines an explicit strict provider JSON schema for storyboard generation", () => {
    const scenes = storyboardJsonSchema.properties.scenes;

    expect(storyboardJsonSchema.additionalProperties).toBe(false);
    expect(scenes.minItems).toBe(2);
    expect(scenes.maxItems).toBe(4);
    expect(scenes.items.required).toContain("shotPrompt");
    expect(scenes.items.properties.shotPrompt.maxLength).toBe(480);
    expect(scenes.items.properties.shotPrompt.pattern).toBeDefined();
    expect(scenes.items.required).toContain("continuityMode");
    expect(scenes.items.required).toContain("transitionStyle");
    expect(scenes.items.properties.transitionStyle.enum).toEqual([
      "CUT",
      "FADE",
      "SLIDE",
      "WIPE",
      "IRIS",
      "CLOCK_WIPE",
    ]);
    expect(scenes.items.properties.continuityNotes.minLength).toBe(6);
    expect(storyboardJsonSchema.required).toContain("continuityBible");
    expect(storyboardJsonSchema.properties.continuityBible.required).toContain(
      "cast",
    );
  });

  it("keeps match cuts clean while allowing motivated product transitions", () => {
    const scene = {
      index: 2,
      durationSec: 8,
      captionText: "Taste the finish",
      voiceoverText: "A final detail worth slowing down for.",
      shotPrompt:
        "Quiet anticipation: the ice-cream turns through falling verified toppings while the fixed camera holds its crisp silhouette.",
      continuityNotes:
        "Keep the same ice-cream shape, topping colors, centered scale, and cool side light.",
      continuityMode: "CONTINUOUS" as const,
      transitionStyle: "IRIS" as const,
    };

    expect(storyboardSceneSchema.safeParse(scene).success).toBe(true);
    expect(
      storyboardSceneSchema.safeParse({
        ...scene,
        continuityMode: "MATCH_CUT",
      }).success,
    ).toBe(false);
    expect(
      storyboardSceneSchema.safeParse({
        ...scene,
        index: 1,
      }).success,
    ).toBe(false);
  });

  it("requires unique cast identities without forcing people into every ad", () => {
    expect(
      castPlanSchema.safeParse({ mode: "NO_PEOPLE", members: [] }).success,
    ).toBe(true);

    const shared = {
      recurrence: "RECURRING",
      ageBand: "adults in their 30s",
      referenceBasis: "FICTIONAL_CAST",
      appearanceAnchors: ["oval face", "shoulder-length curls", "medium build"],
      complexionOrHeritageAnchor: "warm brown skin",
      wardrobeAnchor: "navy work jacket",
      distinguishingFeature: "rectangular glasses and a dimpled chin",
    };
    const distinctCast = {
      mode: "MULTI_PERSON",
      members: [
        { ...shared, role: "designer" },
        {
          ...shared,
          role: "client",
          appearanceAnchors: [
            "square face",
            "close-cropped straight hair",
            "short broad build",
          ],
          complexionOrHeritageAnchor: "light olive skin",
          wardrobeAnchor: "rust cardigan with a silver watch",
          distinguishingFeature: "strong brows and a small cheek scar",
        },
      ],
    };

    expect(castPlanSchema.safeParse(distinctCast).success).toBe(true);
    expect(
      castPlanSchema.safeParse({
        ...distinctCast,
        members: [
          distinctCast.members[0],
          { ...distinctCast.members[0], role: "client" },
        ],
      }).success,
    ).toBe(false);
    expect(
      castPlanSchema.safeParse({
        ...distinctCast,
        members: [
          distinctCast.members[0],
          {
            ...distinctCast.members[0],
            role: "client",
            appearanceAnchors: [
              "oval face",
              "shoulder-length curls",
              "slim medium build",
            ],
            wardrobeAnchor: "navy work blazer",
            distinguishingFeature: "rectangular glasses and a dimpled jaw",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("accepts interesting single-shot motion across non-service domains", () => {
    const base = {
      index: 1,
      durationSec: 6,
      captionText: "One clean beat",
      voiceoverText: "A concise narration line for this scene.",
      continuityNotes: "Preserve the established subject and visual world.",
      continuityMode: "CONTINUOUS" as const,
    };
    const prompts = [
      "Sensory anticipation: amber sauce pours across the plated dish while steam curls through the foreground as the camera slowly pushes in.",
      "Expansive calm: sheer curtains glide apart to reveal the ocean-facing suite while the camera slowly pulls back through the doorway.",
      "Practical clarity: an architect slides the marked drawing into the foreground while a fixed camera holds the scale model behind it.",
      "Confident control: a founder taps one verified dashboard control while the device moves into the foreground as the camera slowly pushes in.",
      "Tactile craft: the artisan unfolds the finished textile across the workbench while a fixed camera holds its changing pattern geometry.",
    ];

    for (const shotPrompt of prompts) {
      expect(
        storyboardSceneSchema.safeParse({ ...base, shotPrompt }).success,
      ).toBe(true);
    }
  });

  it("allows controlled supporting motion while rejecting banal or overloaded directions", () => {
    const base = {
      index: 1,
      durationSec: 6,
      captionText: "One clean beat",
      voiceoverText: "A concise narration line for this scene.",
      continuityNotes: "Preserve the same subject identity and lighting.",
      continuityMode: "CONTINUOUS" as const,
    };

    expect(
      storyboardSceneSchema.safeParse({
        ...base,
        shotPrompt:
          "Tense curiosity: one founder lifts the bottle into the foreground as the camera slowly pushes in toward a startled customer behind it.",
      }).success,
    ).toBe(true);
    expect(
      storyboardSceneSchema.safeParse({
        ...base,
        shotPrompt:
          "Quiet confidence: a founder raises the finished package into clear view while a fixed camera holds the customer's approving reaction behind it.",
      }).success,
    ).toBe(true);
    expect(
      storyboardSceneSchema.safeParse({
        ...base,
        durationSec: 8,
        shotPrompt:
          "Reassuring trust: a parent watches the caregiver guide a child's puzzle in the foreground, then rises and exits frame as the fixed camera holds.",
      }).success,
    ).toBe(true);
    expect(
      storyboardSceneSchema.safeParse({
        ...base,
        shotPrompt:
          "The founder walks forward. The camera pans, zooms, and then orbits.",
      }).success,
    ).toBe(false);
    expect(
      storyboardSceneSchema.safeParse({
        ...base,
        shotPrompt:
          "Serene mood: warm natural light illuminates a mother looking out the window while the camera slowly pulls back through the tidy room.",
      }).success,
    ).toBe(false);
    expect(
      storyboardSceneSchema.safeParse({
        ...base,
        durationSec: 8,
        shotPrompt:
          "Chaotic rush: a founder opens the package, then lifts the product, then walks away while the fixed camera holds the cluttered table.",
      }).success,
    ).toBe(false);
    expect(
      storyboardSceneSchema.safeParse({
        ...base,
        durationSec: 8,
        shotPrompt:
          "Frantic overload: a founder walks forward and talks to camera and opens the package while the fixed camera holds the cluttered foreground.",
      }).success,
    ).toBe(false);
  });
});
