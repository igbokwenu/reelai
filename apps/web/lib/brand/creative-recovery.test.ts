import { describe, expect, it } from "vitest";

import {
  recoverBrandReelConcept,
  recoverBrandReelConcepts,
  recoverBrandReelStoryboard,
} from "@/lib/brand/creative-recovery";
import { creativeConceptsSchema, storyboardSchema } from "@/lib/schemas/agent";

const context = {
  businessName: "Northstar Studio",
  projectName: "Website launch",
  audience: "Independent teams",
  offer: "A practical brand strategy service",
  durationSec: 20,
  preferredSceneCount: 3,
  tone: "Confident and human",
  lockedStyle: "Editorial realism",
  palette: ["#161A1D", "#B6FF4D", "#F4F1EA"],
};

describe("Brand Reel deterministic creative recovery", () => {
  it("turns an incomplete concept repair into three distinct production-ready directions", () => {
    const recovered = recoverBrandReelConcepts(
      {
        original: {
          concepts: [
            {
              title: "Proof, made visible",
              strategy:
                "Use one concrete workflow artifact to make the verified service feel tangible and specific.",
            },
          ],
        },
        repaired: {
          concepts: [
            {
              title: "Proof, made visible",
              hook: "Start on one useful detail already moving.",
            },
          ],
        },
      },
      context,
    );

    expect(creativeConceptsSchema.parse(recovered).concepts).toHaveLength(3);
    expect(new Set(recovered.concepts.map((item) => item.title)).size).toBe(3);
    expect(recovered.concepts.every((item) => item.estimatedScenes === 3)).toBe(
      true,
    );
    expect(
      recovered.concepts.every((item) => item.estimatedDurationSec === 20),
    ).toBe(true);
    expect(recovered.concepts[0]?.strategy).toContain("workflow artifact");
    expect(recovered.concepts[2]?.previewPrompt).toContain("no readable");
  });

  it("recovers single-concept refinement without invalidating the format contract", () => {
    const recovered = recoverBrandReelConcept(
      {
        original: { concept: { title: "A sharper proof story" } },
        repaired: {
          concept: { title: "A sharper proof story", hook: "Short" },
        },
      },
      context,
    );

    expect(recovered.concept.title).toBe("A sharper proof story");
    expect(recovered.concept.hook.length).toBeGreaterThanOrEqual(8);
    expect(recovered.concept.estimatedScenes).toBe(3);
  });

  it("repairs missing scenes, invalid prose, timing, music, and cast as one internal storyboard pass", () => {
    const recovered = recoverBrandReelStoryboard(
      {
        original: {
          title: "A credible next move",
          scenes: [
            {
              captionText: "Start here",
              voiceoverText:
                "Northstar Studio begins with the detail that changes what comes next.",
              shotPrompt: "A founder is present.",
            },
          ],
        },
        repaired: {
          title: "A credible next move",
          continuityBible: {
            cast: {
              mode: "SINGLE_PERSON",
              members: [{ role: "Founder", appearanceAnchors: [] }],
            },
          },
          scenes: [
            {
              durationSec: 2,
              captionText: "Start here",
              voiceoverText:
                "This narration is intentionally far too long for a short malformed scene and must be fitted internally before the user ever sees an error.",
              shotPrompt: "Static founder portrait.",
            },
          ],
        },
      },
      context,
    );

    expect(storyboardSchema.parse(recovered).scenes).toHaveLength(3);
    expect(recovered.scenes.map((scene) => scene.durationSec)).toEqual([
      7, 7, 6,
    ]);
    expect(
      recovered.scenes.reduce((sum, scene) => sum + scene.durationSec, 0),
    ).toBe(20);
    expect(recovered.continuityBible.cast.mode).toBe("SINGLE_PERSON");
    expect(
      recovered.continuityBible.cast.members[0]?.appearanceAnchors,
    ).toHaveLength(3);
    expect(recovered.bgm.enabled).toBe(true);
    expect(recovered.scenes[0]?.shotPrompt).toContain("fixed camera");
    expect(recovered.scenes.at(-1)?.captionText).toBe("Take the next step");
  });
});
