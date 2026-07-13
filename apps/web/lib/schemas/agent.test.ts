import { describe, expect, it } from "vitest";

import {
  creativeConceptRegenerationInputSchema,
  creativeConceptRegenerationJsonSchema,
  creativeConceptsSchema,
  creativeConceptsJsonSchema,
  parseCreativeConceptRegenerationOutput,
  parseCreativeConceptsOutput,
  parseStoryboardOutput,
  storyboardJsonSchema,
  storyboardSchema,
} from "./agent";

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
    const scene = (index: number) => ({
      index,
      durationSec: 8,
      captionText: `Scene ${index}`,
      voiceoverText: "A concise narration chunk for the scene.",
      startFramePrompt:
        "Vertical branded opening frame with product detail and clean safe-zone composition.",
      endFramePrompt:
        "Vertical branded ending frame with continuity from the opening image.",
      videoMotionPrompt:
        "Slow camera move across the product while captions remain in safe zones.",
      continuityNotes:
        "Keep the same palette, lighting, product shape, and caption placement.",
      continuityMode: index === 2 ? "MATCH_CUT" : "CONTINUOUS",
    });

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
        "Slow camera push with restrained movement and clear caption-safe space.",
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
      storyboard_scenes: [scene(1), scene(2), scene(3)],
    });

    expect(parsed.scenes).toHaveLength(3);
    expect(parsed.scenes[0]?.durationSec).toBe(8);
    expect(parsed.bgm.preset).toBe("warm pulse");
    expect(parsed.continuityBible.product).toContain("recurring product");
    expect(parsed.scenes[0]?.continuityMode).toBe("CONTINUOUS");
  });

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
    expect(scenes.items.required).toContain("startFramePrompt");
    expect(scenes.items.required).toContain("videoMotionPrompt");
    expect(scenes.items.required).toContain("continuityMode");
    expect(scenes.items.properties.continuityNotes.minLength).toBe(6);
    expect(storyboardJsonSchema.required).toContain("continuityBible");
  });
});
