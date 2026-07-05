import { describe, expect, it } from "vitest";

import { creativeConceptsSchema, storyboardSchema } from "./agent";

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
      creativeConceptsSchema.safeParse({ concepts: [concept, concept, concept] })
        .success,
    ).toBe(true);
    expect(
      creativeConceptsSchema.safeParse({ concepts: [concept, concept] }).success,
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
        scenes: [scene(1)],
      }).success,
    ).toBe(false);
  });
});
