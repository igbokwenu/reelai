import { z } from "zod";

import { BGM_TRACK_IDS } from "@/lib/bgm/catalog";
import {
  normalizeShowcaseDurations,
  normalizeShowcaseSceneCount,
  productShowcaseSceneRange,
} from "@/lib/storyboards/timing";
import {
  showcaseCameraBehaviors,
  showcaseHumanPresence,
  showcaseSeparationTreatments,
} from "@/lib/product-showcase/guardrails";

export const creativeConceptSchema = z.object({
  title: z.string().min(3).max(90),
  hook: z.string().min(8).max(220),
  strategy: z.string().min(20).max(420),
  narrativeArc: z.string().min(20).max(520),
  visualStyle: z.string().min(12).max(320),
  estimatedScenes: z.number().int().min(2).max(4),
  estimatedDurationSec: z.number().int().min(15).max(30),
  previewPrompt: z.string().min(20).max(1200),
  rationale: z.string().min(20).max(520),
});

export const showcaseMotionPlanSchema = z.object({
  heroAction: z.string().trim().min(8).max(180),
  supportingMotion: z.string().trim().min(3).max(180),
  cameraBehavior: z.enum(showcaseCameraBehaviors),
  humanPresence: z.enum(showcaseHumanPresence),
  separationTreatment: z.enum(showcaseSeparationTreatments),
  safetyRationale: z.string().trim().min(12).max(280),
});

export const productShowcaseCreativeConceptSchema =
  creativeConceptSchema.extend({
    estimatedScenes: z.number().int().min(1).max(3),
    estimatedDurationSec: z.number().int().min(5).max(15),
    motionPlan: showcaseMotionPlanSchema,
  });

export const creativeConceptsSchema = z.object({
  concepts: z.array(creativeConceptSchema).length(3),
});

export const creativeConceptRegenerationSchema = z.object({
  concept: creativeConceptSchema,
});

export const productShowcaseCreativeConceptsSchema = z.object({
  concepts: z.array(productShowcaseCreativeConceptSchema).length(3),
});

export const productShowcaseCreativeConceptRegenerationSchema = z.object({
  concept: productShowcaseCreativeConceptSchema,
});

export const creativeConceptRegenerationInputSchema = z.object({
  adjustmentNote: z.string().trim().max(500).optional().default(""),
});

export const creativeConceptsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["concepts"],
  properties: {
    concepts: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "hook",
          "strategy",
          "narrativeArc",
          "visualStyle",
          "estimatedScenes",
          "estimatedDurationSec",
          "previewPrompt",
          "rationale",
        ],
        properties: {
          title: { type: "string", minLength: 3, maxLength: 90 },
          hook: { type: "string", minLength: 8, maxLength: 220 },
          strategy: { type: "string", minLength: 20, maxLength: 420 },
          narrativeArc: { type: "string", minLength: 20, maxLength: 520 },
          visualStyle: { type: "string", minLength: 12, maxLength: 320 },
          estimatedScenes: { type: "integer", minimum: 2, maximum: 4 },
          estimatedDurationSec: { type: "integer", minimum: 15, maximum: 30 },
          previewPrompt: { type: "string", minLength: 20, maxLength: 1200 },
          rationale: { type: "string", minLength: 20, maxLength: 520 },
        },
      },
    },
  },
} satisfies Record<string, unknown>;

export const productShowcaseCreativeConceptsJsonSchema = {
  ...creativeConceptsJsonSchema,
  properties: {
    concepts: {
      ...creativeConceptsJsonSchema.properties.concepts,
      items: {
        ...creativeConceptsJsonSchema.properties.concepts.items,
        required: [
          ...creativeConceptsJsonSchema.properties.concepts.items.required,
          "motionPlan",
        ],
        properties: {
          ...creativeConceptsJsonSchema.properties.concepts.items.properties,
          estimatedScenes: { type: "integer", minimum: 1, maximum: 3 },
          estimatedDurationSec: { type: "integer", minimum: 5, maximum: 15 },
          motionPlan: {
            type: "object",
            additionalProperties: false,
            required: [
              "heroAction",
              "supportingMotion",
              "cameraBehavior",
              "humanPresence",
              "separationTreatment",
              "safetyRationale",
            ],
            properties: {
              heroAction: { type: "string", minLength: 8, maxLength: 180 },
              supportingMotion: {
                type: "string",
                minLength: 3,
                maxLength: 180,
                description:
                  'Use "None" when the hero action should remain visually isolated.',
              },
              cameraBehavior: {
                type: "string",
                enum: showcaseCameraBehaviors,
              },
              humanPresence: {
                type: "string",
                enum: showcaseHumanPresence,
                description:
                  "If a human appears, ONE_PERSON means exactly one person total across the concept.",
              },
              separationTreatment: {
                type: "string",
                enum: showcaseSeparationTreatments,
              },
              safetyRationale: {
                type: "string",
                minLength: 12,
                maxLength: 280,
              },
            },
          },
        },
      },
    },
  },
} satisfies Record<string, unknown>;

export const creativeConceptRegenerationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["concept"],
  properties: {
    concept: creativeConceptsJsonSchema.properties.concepts.items,
  },
} satisfies Record<string, unknown>;

export const productShowcaseCreativeConceptRegenerationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["concept"],
  properties: {
    concept:
      productShowcaseCreativeConceptsJsonSchema.properties.concepts.items,
  },
} satisfies Record<string, unknown>;

const singleShotSentencePattern = /^[^.!?\n:]{2,50}: [^.!?\n]+[.!?]?$/;
const reliableCameraPatterns = [
  [
    "fixed",
    /\b(?:(?:fixed|static) camera|camera[^,.]{0,24}(?:fixed|static))\b/i,
  ],
  ["push-in", /\b(?:slow push-in|camera[^,.]{0,24}push(?:es)? in)\b/i],
  [
    "pull-back",
    /\b(?:slow pull-back|camera[^,.]{0,24}pull(?:s)? (?:back|out))\b/i,
  ],
  ["orbit", /\b(?:gentle product orbit|camera[^,.]{0,24}orbit(?:s|ing)?)\b/i],
  [
    "handheld-follow",
    /\b(?:handheld follow|handheld camera[^,.]{0,24}follow(?:s|ing)?)\b/i,
  ],
] as const;
const passiveFramingPattern =
  /\b(?:shows?|captures?|depicts?|features?|illuminates?|can be seen|is seen)\b/i;
const visibleStoryBeatPattern =
  /\b(?:foreground|background|behind (?:her|him|them|the)|enters? (?:the )?frame|exits? (?:the )?frame|walks? (?:away|out)|steps? (?:away|out)|rises?|stands? up|sits? down|reacts?|relaxes?|releases?|brightens?|recoils?|reveals?|unfolds?|opens?|closes?|topples?|spills?|drops?|lifts?|raises?|turns?|rotates?|slides?|crosses? (?:the )?frame|moves? into|moves? out of|pours?|streams?|bubbles?|steams?|sizzles?|sprays?|dispenses?|stacks?|assembles?|arranges?|packs?|unboxes?|peels?|snaps?|clicks?|locks?|glides?|rolls?|lands?|swirls?|curls?|tosses?|stirs?|writes?|draws?|types?|taps?|points?|guides?|demonstrates?|wipes?|polishes?|ripples?|blooms?|separates?|settles?|sweeps?|shimmers?|reflects?|catches?|drifts?|tilts?|emerges?|extends?|retracts?|hovers?|floats?|folds?|wraps?|twists?|spins?|pivots?|flips?|fades?)\b/i;
const sequencePattern =
  /\b(?:then|afterward|afterwards|next|finally|followed by)\b/gi;

const castMemberSchema = z.object({
  role: z.string().trim().min(2).max(40),
  recurrence: z.enum(["RECURRING", "SCENE_ONLY"]),
  ageBand: z.string().trim().min(2).max(32),
  referenceBasis: z.enum(["REFERENCE_BACKED", "FICTIONAL_CAST"]),
  appearanceAnchors: z.array(z.string().trim().min(2).max(48)).min(3).max(5),
  complexionOrHeritageAnchor: z.string().trim().min(2).max(72).nullable(),
  wardrobeAnchor: z.string().trim().min(3).max(80),
  distinguishingFeature: z.string().trim().min(8).max(140),
});

export const castPlanSchema = z
  .object({
    mode: z.enum(["NO_PEOPLE", "SINGLE_PERSON", "MULTI_PERSON"]),
    members: z.array(castMemberSchema).max(4),
  })
  .superRefine((value, ctx) => {
    const expected =
      value.mode === "NO_PEOPLE"
        ? [0, 0]
        : value.mode === "SINGLE_PERSON"
          ? [1, 1]
          : [2, 4];

    if (
      value.members.length < expected[0] ||
      value.members.length > expected[1]
    ) {
      ctx.addIssue({
        code: "custom",
        message: `${value.mode} requires ${expected[0] === expected[1] ? expected[0] : `${expected[0]}-${expected[1]}`} cast members.`,
        path: ["members"],
      });
    }

    const roles = value.members.map((member) => member.role.toLowerCase());
    if (new Set(roles).size !== roles.length) {
      ctx.addIssue({
        code: "custom",
        message: "Every cast member needs a unique role label.",
        path: ["members"],
      });
    }

    const signatures = value.members.map((member) =>
      [
        ...member.appearanceAnchors,
        member.complexionOrHeritageAnchor ?? "",
        member.wardrobeAnchor,
        member.distinguishingFeature,
      ]
        .join("|")
        .toLowerCase(),
    );
    if (new Set(signatures).size !== signatures.length) {
      ctx.addIssue({
        code: "custom",
        message: "Cast members need visibly distinct identity signatures.",
        path: ["members"],
      });
    }

    const tokenSets = signatures.map(
      (signature) =>
        new Set(
          signature.split(/[^a-z0-9]+/).filter((token) => token.length > 2),
        ),
    );
    for (let left = 0; left < tokenSets.length; left += 1) {
      for (let right = left + 1; right < tokenSets.length; right += 1) {
        const a = tokenSets[left]!;
        const b = tokenSets[right]!;
        const intersection = [...a].filter((token) => b.has(token)).length;
        const union = new Set([...a, ...b]).size;

        if (union > 0 && intersection / union >= 0.65) {
          ctx.addIssue({
            code: "custom",
            message:
              "Cast identity signatures are too similar; vary physical appearance and silhouette/wardrobe anchors.",
            path: ["members", right],
          });
        }
      }
    }
  });

function countReliableCameraBehaviors(value: string) {
  return reliableCameraPatterns.filter(([, pattern]) => pattern.test(value))
    .length;
}

function reliableCameraBehavior(value: string) {
  return reliableCameraPatterns.find(([, pattern]) => pattern.test(value))?.[0];
}

export const shotPromptSchema = z
  .string()
  .trim()
  .min(20)
  .max(480)
  .refine((value) => singleShotSentencePattern.test(value), {
    message: "Shot direction must be exactly one sentence.",
  })
  .refine(
    (value) => {
      const words = value.split(/\s+/).filter(Boolean).length;
      return words >= 14 && words <= 60;
    },
    { message: "Shot direction must contain 14 to 60 words." },
  )
  .refine((value) => countReliableCameraBehaviors(value) === 1, {
    message: "Shot direction must contain exactly one reliable camera move.",
  })
  .refine((value) => (value.match(sequencePattern) ?? []).length <= 1, {
    message:
      "Shot direction may contain at most one simple two-beat progression.",
  })
  .refine((value) => (value.match(/\band\b/gi) ?? []).length <= 1, {
    message:
      "Shot direction may use at most one 'and' to link a single motivated action arc.",
  })
  .refine((value) => !passiveFramingPattern.test(value), {
    message:
      "Shot direction must describe visible action, not passive shows/captures/illuminates framing.",
  });

export const storyboardSceneSchema = z
  .object({
    index: z.number().int().min(1).max(4),
    durationSec: z.number().int().min(5).max(10),
    captionText: z.string().min(1).max(140),
    voiceoverText: z.string().min(1).max(600),
    shotPrompt: shotPromptSchema,
    continuityNotes: z.string().min(6).max(700),
    continuityMode: z.enum(["CONTINUOUS", "MATCH_CUT", "INTENTIONAL_CHANGE"]),
    transitionStyle: z
      .enum(["CUT", "FADE", "SLIDE", "WIPE", "IRIS", "CLOCK_WIPE"])
      .default("CUT"),
  })
  .superRefine((value, ctx) => {
    if (value.index === 1 && value.transitionStyle !== "CUT") {
      ctx.addIssue({
        code: "custom",
        message:
          "The first scene must use CUT because there is no prior scene.",
        path: ["transitionStyle"],
      });
    }

    if (
      value.continuityMode === "MATCH_CUT" &&
      value.transitionStyle !== "CUT"
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "A match cut must use CUT so an added effect does not obscure the visual match.",
        path: ["transitionStyle"],
      });
    }

    const voiceoverWords = value.voiceoverText
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    const voiceoverWordBudget = Math.floor(value.durationSec * 2.5);

    if (voiceoverWords > voiceoverWordBudget) {
      ctx.addIssue({
        code: "custom",
        message: `Voiceover must use at most ${voiceoverWordBudget} words for a natural ${value.durationSec}-second read.`,
        path: ["voiceoverText"],
      });
    }

    if (
      value.durationSec <= 6 &&
      (value.shotPrompt.match(sequencePattern) ?? []).length > 0
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "A 5-6 second shot must use one continuous focal action; reserve a two-beat progression for 7-10 seconds.",
        path: ["shotPrompt"],
      });
    }
  });

const storyboardBaseSchema = z.object({
  title: z.string().min(3).max(100),
  script: z.string().min(20).max(2400),
  bgm: z.object({
    enabled: z.boolean(),
    preset: z.string().min(2).max(80),
    prompt: z.string().min(4).max(400),
  }),
  continuityBible: z.object({
    product: z.string().min(6).max(700),
    characters: z.string().min(20).max(500),
    cast: castPlanSchema,
    visualWorld: z.string().min(6).max(700),
  }),
  scenes: z.array(storyboardSceneSchema).min(1).max(4),
});

function validateStoryboardStructure(
  value: z.infer<typeof storyboardBaseSchema>,
  ctx: z.RefinementCtx,
  {
    minScenes,
    maxScenes,
    minDuration,
    maxDuration,
  }: {
    minScenes: number;
    maxScenes: number;
    minDuration: number;
    maxDuration: number;
  },
) {
  if (value.scenes.length < minScenes || value.scenes.length > maxScenes) {
    ctx.addIssue({
      code: "custom",
      message: `Storyboard must contain ${minScenes} to ${maxScenes} scenes.`,
      path: ["scenes"],
    });
  }
  const totalDuration = value.scenes.reduce(
    (sum, scene) => sum + scene.durationSec,
    0,
  );

  if (totalDuration < minDuration || totalDuration > maxDuration) {
    ctx.addIssue({
      code: "custom",
      message: `Storyboard duration must land between ${minDuration} and ${maxDuration} seconds.`,
      path: ["scenes"],
    });
  }
}

export const storyboardSchema = storyboardBaseSchema.superRefine(
  (value, ctx) => {
    validateStoryboardStructure(value, ctx, {
      minScenes: 2,
      maxScenes: 4,
      minDuration: 15,
      maxDuration: 30,
    });
    if (value.scenes.some((scene) => scene.durationSec < 5)) {
      ctx.addIssue({
        code: "custom",
        message: "Standard reel scenes must last 5 to 10 seconds.",
        path: ["scenes"],
      });
    }
  },
);

export const productShowcaseStoryboardSchema = storyboardBaseSchema.superRefine(
  (value, ctx) => {
    validateStoryboardStructure(value, ctx, {
      minScenes: 1,
      maxScenes: 3,
      minDuration: 5,
      maxDuration: 15,
    });
    if (
      value.continuityBible.cast.mode === "MULTI_PERSON" ||
      value.continuityBible.cast.members.length > 1
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Product Showcase may use no people or exactly one person total.",
        path: ["continuityBible", "cast"],
      });
    }
    if (!value.bgm.enabled) {
      ctx.addIssue({
        code: "custom",
        message:
          "Product Showcase defaults to a curated background-music bed for its first final render.",
        path: ["bgm", "enabled"],
      });
    }
  },
);

export const storyboardJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "script", "bgm", "continuityBible", "scenes"],
  properties: {
    title: { type: "string", minLength: 3, maxLength: 100 },
    script: {
      type: "string",
      minLength: 20,
      maxLength: 2400,
      description:
        "A unified narration script. Never leave this empty; when no separate script is needed, join the scene voiceover lines in scene order.",
    },
    bgm: {
      type: "object",
      additionalProperties: false,
      required: ["enabled", "preset", "prompt"],
      properties: {
        enabled: { type: "boolean" },
        preset: {
          type: "string",
          enum: ["none", ...BGM_TRACK_IDS],
          minLength: 2,
          maxLength: 80,
          description: `Select exactly one curated soundtrack id (${BGM_TRACK_IDS.join(", ")}) when enabled. Use "none" when background music is disabled.`,
        },
        prompt: {
          type: "string",
          minLength: 4,
          maxLength: 400,
          description:
            'Never empty. Use "Voiceover only; no background music." when disabled.',
        },
      },
    },
    continuityBible: {
      type: "object",
      additionalProperties: false,
      required: ["product", "characters", "cast", "visualWorld"],
      properties: {
        product: { type: "string", minLength: 6, maxLength: 700 },
        characters: { type: "string", minLength: 20, maxLength: 500 },
        cast: {
          type: "object",
          additionalProperties: false,
          description:
            "A domain-neutral cast plan. Use NO_PEOPLE for product, place, or abstract scenes with no people; do not add token humans. MULTI_PERSON members must be visibly distinct and keep stable role labels across scenes.",
          required: ["mode", "members"],
          properties: {
            mode: {
              type: "string",
              enum: ["NO_PEOPLE", "SINGLE_PERSON", "MULTI_PERSON"],
            },
            members: {
              type: "array",
              minItems: 0,
              maxItems: 4,
              items: {
                type: "object",
                additionalProperties: false,
                required: [
                  "role",
                  "recurrence",
                  "ageBand",
                  "referenceBasis",
                  "appearanceAnchors",
                  "complexionOrHeritageAnchor",
                  "wardrobeAnchor",
                  "distinguishingFeature",
                ],
                properties: {
                  role: { type: "string", minLength: 2, maxLength: 40 },
                  recurrence: {
                    type: "string",
                    enum: ["RECURRING", "SCENE_ONLY"],
                  },
                  ageBand: { type: "string", minLength: 2, maxLength: 32 },
                  referenceBasis: {
                    type: "string",
                    enum: ["REFERENCE_BACKED", "FICTIONAL_CAST"],
                    description:
                      "REFERENCE_BACKED means an uploaded/reference person must be matched without inferring ethnicity; FICTIONAL_CAST permits deliberate fictional casting.",
                  },
                  appearanceAnchors: {
                    type: "array",
                    minItems: 3,
                    maxItems: 5,
                    items: {
                      type: "string",
                      minLength: 2,
                      maxLength: 48,
                    },
                  },
                  complexionOrHeritageAnchor: {
                    description:
                      "Optional neutral skin-tone or broad ethnic-appearance anchor for fictional casting. For reference-backed people, use visible complexion only and never infer ethnicity.",
                    anyOf: [
                      { type: "string", minLength: 2, maxLength: 72 },
                      { type: "null" },
                    ],
                  },
                  wardrobeAnchor: {
                    type: "string",
                    minLength: 3,
                    maxLength: 80,
                  },
                  distinguishingFeature: {
                    type: "string",
                    minLength: 8,
                    maxLength: 140,
                    description:
                      "A stable feature that prevents this person from resembling other cast members; multi-person casts need a physical distinction plus a silhouette or wardrobe distinction.",
                  },
                },
              },
            },
          },
        },
        visualWorld: { type: "string", minLength: 6, maxLength: 700 },
      },
    },
    scenes: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "index",
          "durationSec",
          "captionText",
          "voiceoverText",
          "shotPrompt",
          "continuityNotes",
          "continuityMode",
          "transitionStyle",
        ],
        properties: {
          index: { type: "integer", minimum: 1, maximum: 4 },
          durationSec: { type: "integer", minimum: 5, maximum: 10 },
          captionText: { type: "string", minLength: 1, maxLength: 140 },
          voiceoverText: { type: "string", minLength: 1, maxLength: 600 },
          shotPrompt: {
            type: "string",
            minLength: 20,
            maxLength: 480,
            pattern: "^[^.!?\\n:]{2,50}: [^.!?\\n]+[.!?]?$",
            description:
              "Exactly one 14-60 word sentence. Start with a specific mood anchor, then describe one focal subject's action arc, optionally one simple background/supporting behavior, one visible change or spatial reveal, and exactly one of: fixed camera, slow push-in, slow pull-back, gentle product orbit, or handheld follow. At most one 'then' progression; no passive 'shows/captures/illuminates' framing.",
          },
          continuityNotes: {
            type: "string",
            minLength: 6,
            maxLength: 700,
          },
          continuityMode: {
            type: "string",
            enum: ["CONTINUOUS", "MATCH_CUT", "INTENTIONAL_CHANGE"],
          },
          transitionStyle: {
            type: "string",
            enum: ["CUT", "FADE", "SLIDE", "WIPE", "IRIS", "CLOCK_WIPE"],
            description:
              "The visual transition into this scene. Scene 1 must use CUT. Use CUT for a true match cut; otherwise choose the least intrusive effect whose geometry or mood supports the product and story.",
          },
        },
      },
    },
  },
} satisfies Record<string, unknown>;

export const productShowcaseStoryboardJsonSchema = {
  ...storyboardJsonSchema,
  properties: {
    ...storyboardJsonSchema.properties,
    bgm: {
      ...storyboardJsonSchema.properties.bgm,
      properties: {
        ...storyboardJsonSchema.properties.bgm.properties,
        enabled: {
          type: "boolean",
          const: true,
          description:
            "Product Showcase defaults to curated background music so the first Auto render demonstrates the complete audio mix.",
        },
      },
    },
    scenes: {
      ...storyboardJsonSchema.properties.scenes,
      minItems: 1,
      maxItems: 3,
    },
  },
} satisfies Record<string, unknown>;

export const storyboardPatchSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  script: z.string().min(20).max(2400).optional(),
  bgmEnabled: z.boolean().optional(),
  bgmPrompt: z.string().max(400).nullable().optional(),
  bgmTrackId: z.enum(BGM_TRACK_IDS).nullable().optional(),
  productContinuity: z.string().min(1).max(700).optional(),
  characterContinuity: z.string().min(1).max(2400).optional(),
  visualContinuity: z.string().min(1).max(700).optional(),
  scenes: z
    .array(
      z.object({
        id: z.string().min(1),
        durationSec: z.number().int().min(5).max(10),
        captionText: z.string().min(1).max(140),
        voiceoverText: z.string().max(600),
        // Existing projects may carry a legacy motion brief until it is edited
        // or the storyboard is regenerated. The route strictly validates every
        // newly changed shot direction against shotPromptSchema.
        shotPrompt: z.string().trim().min(20).max(1200),
        continuityNotes: z.string().min(1).max(700),
        continuityMode: z.enum([
          "CONTINUOUS",
          "MATCH_CUT",
          "INTENTIONAL_CHANGE",
        ]),
        transitionStyle: z
          .enum(["CUT", "FADE", "SLIDE", "WIPE", "IRIS", "CLOCK_WIPE"])
          .optional(),
      }),
    )
    .min(1)
    .max(4)
    .optional(),
});

export const policyWarningSchema = z.object({
  severity: z.enum(["info", "warning", "blocker"]),
  sceneIndex: z.number().int().min(1).max(4).nullable(),
  message: z.string().min(4).max(280),
  mitigation: z.string().min(4).max(280),
});

export type ProductShowcaseCreativeConcept = z.infer<
  typeof productShowcaseCreativeConceptSchema
>;
export type CreativeConceptOutput = z.infer<typeof creativeConceptSchema> & {
  motionPlan?: ProductShowcaseCreativeConcept["motionPlan"];
};
export type CreativeConceptsOutput = { concepts: CreativeConceptOutput[] };
export type StoryboardOutput = z.infer<typeof storyboardSchema>;
export type PolicyWarning = z.infer<typeof policyWarningSchema>;

const flexibleConceptSchema = z
  .object({
    title: z.unknown().optional(),
    hook: z.unknown().optional(),
    strategy: z.unknown().optional(),
    approach: z.unknown().optional(),
    concept: z.unknown().optional(),
    concept_summary: z.unknown().optional(),
    core_strategy: z.unknown().optional(),
    narrativeArc: z.unknown().optional(),
    narrative_arc: z.unknown().optional(),
    arc: z.unknown().optional(),
    storyArc: z.unknown().optional(),
    visualStyle: z.unknown().optional(),
    visual_style: z.unknown().optional(),
    style: z.unknown().optional(),
    estimatedScenes: z.unknown().optional(),
    estimated_scenes: z.unknown().optional(),
    sceneCount: z.unknown().optional(),
    scene_count: z.unknown().optional(),
    scenes: z.unknown().optional(),
    estimatedDurationSec: z.unknown().optional(),
    estimated_duration_sec: z.unknown().optional(),
    estimatedDuration: z.unknown().optional(),
    estimated_duration: z.unknown().optional(),
    durationSec: z.unknown().optional(),
    duration: z.unknown().optional(),
    target_duration_seconds: z.unknown().optional(),
    previewPrompt: z.unknown().optional(),
    preview_prompt: z.unknown().optional(),
    imagePrompt: z.unknown().optional(),
    image_prompt: z.unknown().optional(),
    framePrompt: z.unknown().optional(),
    rationale: z.unknown().optional(),
    why: z.unknown().optional(),
    whyItWorks: z.unknown().optional(),
    why_it_works: z.unknown().optional(),
    motionPlan: z.unknown().optional(),
    motion_plan: z.unknown().optional(),
    motionTreatment: z.unknown().optional(),
    motion_treatment: z.unknown().optional(),
  })
  .passthrough();

export function parseCreativeConceptsOutput(
  value: unknown,
  outputMode: "STANDARD" | "PRODUCT_SHOWCASE" = "STANDARD",
  targetDurationSec?: number,
  preferredSceneCount?: number | null,
): CreativeConceptsOutput {
  const extracted = extractConceptArray(value);

  const concepts = extracted
    .slice(0, 3)
    .map((item: unknown) =>
      normalizeConcept(
        item,
        outputMode === "PRODUCT_SHOWCASE",
        targetDurationSec,
        preferredSceneCount,
      ),
    );

  return (
    outputMode === "PRODUCT_SHOWCASE"
      ? productShowcaseCreativeConceptsSchema
      : creativeConceptsSchema
  ).parse({ concepts });
}

export function parseCreativeConceptRegenerationOutput(
  value: unknown,
  outputMode: "STANDARD" | "PRODUCT_SHOWCASE" = "STANDARD",
  targetDurationSec?: number,
  preferredSceneCount?: number | null,
) {
  const record = asRecord(value);
  const directConcept = record ? asRecord(record.concept) : null;
  const extracted = directConcept ?? extractConceptArray(value)[0];

  return (
    outputMode === "PRODUCT_SHOWCASE"
      ? productShowcaseCreativeConceptRegenerationSchema
      : creativeConceptRegenerationSchema
  ).parse({
    concept: normalizeConcept(
      extracted,
      outputMode === "PRODUCT_SHOWCASE",
      targetDurationSec,
      preferredSceneCount,
    ),
  });
}

export function parseStoryboardOutput(
  value: unknown,
  outputMode: "STANDARD" | "PRODUCT_SHOWCASE" = "STANDARD",
  targetDurationSec?: number,
  preferredSceneCount?: number | null,
): StoryboardOutput {
  const canonical = canonicalizeStoryboardValue(value);
  const activeSchema =
    outputMode === "PRODUCT_SHOWCASE"
      ? productShowcaseStoryboardSchema
      : storyboardSchema;
  const validationSchema =
    targetDurationSec !== undefined || preferredSceneCount !== undefined
      ? activeSchema.superRefine((storyboard, ctx) => {
          if (
            preferredSceneCount !== undefined &&
            preferredSceneCount !== null &&
            storyboard.scenes.length !== preferredSceneCount
          ) {
            ctx.addIssue({
              code: "custom",
              message: `This ${targetDurationSec ?? "requested"}-second format needs exactly ${preferredSceneCount} scenes unless the user's direction requests another supported count.`,
              path: ["scenes"],
            });
          }
          if (
            outputMode !== "PRODUCT_SHOWCASE" ||
            targetDurationSec === undefined
          ) {
            return;
          }
          const sceneRange = productShowcaseSceneRange(targetDurationSec);
          if (
            storyboard.scenes.length < sceneRange.min ||
            storyboard.scenes.length > sceneRange.max
          ) {
            ctx.addIssue({
              code: "custom",
              message:
                targetDurationSec === 5
                  ? "A 5-second Product Showcase must use exactly one scene and one video clip."
                  : `A ${targetDurationSec}-second Product Showcase needs ${sceneRange.min} to ${sceneRange.max} scenes.`,
              path: ["scenes"],
            });
          }
          const total = storyboard.scenes.reduce(
            (sum, scene) => sum + scene.durationSec,
            0,
          );
          if (total !== targetDurationSec) {
            ctx.addIssue({
              code: "custom",
              message: `Product Showcase must total exactly ${targetDurationSec} seconds.`,
              path: ["scenes"],
            });
          }
          if (storyboard.scenes.some((scene) => scene.durationSec < 5)) {
            ctx.addIssue({
              code: "custom",
              message: "Product Showcase scenes must last 5 to 10 seconds.",
              path: ["scenes"],
            });
          }
        })
      : activeSchema;
  const strict = validationSchema.safeParse(canonical);

  if (strict.success) {
    return strict.data;
  }

  const record = asRecord(canonical) ?? {};
  const rawScenes = Array.isArray(record.scenes)
    ? record.scenes
    : Array.isArray(record.storyboard)
      ? record.storyboard
      : [];
  let scenes = rawScenes
    .slice(0, outputMode === "PRODUCT_SHOWCASE" ? 3 : 4)
    .map((scene, index) => normalizeStoryboardScene(scene, index));

  if (
    preferredSceneCount !== undefined &&
    preferredSceneCount !== null &&
    preferredSceneCount < scenes.length
  ) {
    scenes = selectScenesForCount(scenes, preferredSceneCount);
  }

  if (outputMode === "PRODUCT_SHOWCASE" && targetDurationSec !== undefined) {
    const desiredSceneCount = normalizeShowcaseSceneCount(
      preferredSceneCount ?? (scenes.length || 1),
      targetDurationSec,
    );
    if (desiredSceneCount <= scenes.length) {
      scenes = selectShowcaseScenes(scenes, desiredSceneCount);
    }
    const durations = normalizeShowcaseDurations(
      scenes.map((scene) => scene.durationSec),
      targetDurationSec,
      desiredSceneCount,
    );
    if (durations.length === scenes.length) {
      scenes = scenes.map((scene, index) => ({
        ...scene,
        index: index + 1,
        durationSec: durations[index]!,
        transitionStyle: index === 0 ? ("CUT" as const) : scene.transitionStyle,
        voiceoverText: fitVoiceoverToDuration(
          scene.voiceoverText,
          durations[index]!,
        ),
      }));
    }
  }

  const title = text(record.title ?? record.name, {
    fallback: "Generated storyboard",
    min: 3,
    max: 100,
  });

  return validationSchema.parse({
    title,
    script: normalizeStoryboardScript(record, scenes, title),
    bgm: normalizeBgm(
      record.bgm ?? record.music ?? record.backgroundMusic,
      outputMode,
    ),
    continuityBible: normalizeContinuityBible(
      record.continuityBible ??
        record.continuity_bible ??
        record.consistencyBible ??
        record.consistency_bible,
      { outputMode, scenes },
    ),
    scenes,
  });
}

function extractConceptArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  const record = asRecord(value);

  if (!record) {
    return [];
  }

  const nested =
    arrayValue(record.concepts) ??
    arrayValue(record.creativeConcepts) ??
    arrayValue(record.creative_concepts) ??
    arrayValue(record.directions) ??
    arrayValue(record.options) ??
    arrayValue(record.results) ??
    arrayValue(record.strategies);

  if (nested) {
    return nested;
  }

  const inner =
    asRecord(record.result) ??
    asRecord(record.output) ??
    asRecord(record.data) ??
    asRecord(record.creativeDirector);

  return inner ? extractConceptArray(inner) : [];
}

function normalizeConcept(
  value: unknown,
  productShowcase = false,
  targetDurationSec?: number,
  preferredSceneCount?: number | null,
) {
  const parsed = flexibleConceptSchema.parse(asRecord(value) ?? {});
  const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  const firstScene = scenes[0] ? asRecord(scenes[0]) : null;

  const title = text(parsed.title, {
    fallback: "",
    min: 3,
    max: 90,
  });
  const hook = text(
    parsed.hook ??
      (firstScene ? firstScene.text_overlay : undefined) ??
      (firstScene ? firstScene.visual_direction : undefined) ??
      (firstScene ? firstScene.visual_description : undefined),
    {
      fallback: "",
      min: 8,
      max: 220,
    },
  );
  const strategy = text(
    parsed.strategy ??
      parsed.approach ??
      parsed.concept ??
      parsed.concept_summary ??
      parsed.core_strategy,
    {
      fallback: "",
      min: 20,
      max: 420,
    },
  );
  const narrativeArc = text(
    parsed.narrativeArc ??
      parsed.narrative_arc ??
      parsed.arc ??
      parsed.storyArc ??
      parsed.concept_summary ??
      parsed.core_strategy,
    {
      fallback: "",
      min: 20,
      max: 520,
    },
  );
  const visualStyle = text(
    parsed.visualStyle ??
      parsed.visual_style ??
      parsed.style ??
      (firstScene ? firstScene.visual_direction : undefined) ??
      (firstScene ? firstScene.visual_description : undefined),
    {
      fallback: "",
      min: 12,
      max: 320,
    },
  );
  const previewPrompt = text(
    parsed.previewPrompt ??
      parsed.preview_prompt ??
      parsed.imagePrompt ??
      parsed.image_prompt ??
      parsed.framePrompt ??
      (firstScene ? firstScene.preview_prompt : undefined),
    {
      fallback: "",
      min: 20,
      max: 1200,
    },
  );

  const estimatedScenes = integerInRange(
    parsed.estimatedScenes ??
      parsed.estimated_scenes ??
      parsed.sceneCount ??
      parsed.scene_count ??
      (Array.isArray(parsed.scenes) ? parsed.scenes.length : undefined),
    productShowcase
      ? { fallback: 2, min: 1, max: 3 }
      : { fallback: 3, min: 2, max: 4 },
  );
  const estimatedDurationSec = integerInRange(
    parsed.estimatedDurationSec ??
      parsed.estimated_duration_sec ??
      parsed.estimatedDuration ??
      parsed.estimated_duration ??
      parsed.durationSec ??
      parsed.duration ??
      parsed.target_duration_seconds,
    productShowcase
      ? { fallback: 10, min: 5, max: 15 }
      : { fallback: 24, min: 15, max: 30 },
  );
  const showcaseTarget =
    productShowcase && targetDurationSec !== undefined
      ? Math.min(15, Math.max(5, Math.round(targetDurationSec)))
      : estimatedDurationSec;

  const concept = {
    title,
    hook,
    strategy,
    narrativeArc,
    visualStyle,
    estimatedScenes: productShowcase
      ? normalizeShowcaseSceneCount(
          preferredSceneCount ?? estimatedScenes,
          showcaseTarget,
        )
      : (preferredSceneCount ?? estimatedScenes),
    estimatedDurationSec: showcaseTarget,
    previewPrompt,
    rationale: text(
      parsed.rationale ??
        parsed.why ??
        parsed.whyItWorks ??
        parsed.why_it_works ??
        parsed.concept_summary ??
        parsed.core_strategy,
      {
        fallback: "",
        min: 20,
        max: 520,
      },
    ),
  };

  return productShowcase
    ? {
        ...concept,
        motionPlan: normalizeShowcaseMotionPlan(
          parsed.motionPlan ??
            parsed.motion_plan ??
            parsed.motionTreatment ??
            parsed.motion_treatment,
        ),
      }
    : concept;
}

function normalizeShowcaseMotionPlan(value: unknown) {
  const record = asRecord(value) ?? {};
  return {
    heroAction: text(record.heroAction ?? record.hero_action, {
      fallback: "",
      min: 8,
      max: 180,
    }),
    supportingMotion: text(
      record.supportingMotion ?? record.supporting_motion,
      { fallback: "", min: 3, max: 180 },
    ),
    cameraBehavior: normalizeShowcaseCameraBehavior(
      record.cameraBehavior ?? record.camera_behavior,
    ),
    humanPresence: normalizeShowcaseHumanPresence(
      record.humanPresence ?? record.human_presence,
    ),
    separationTreatment: normalizeShowcaseSeparationTreatment(
      record.separationTreatment ?? record.separation_treatment,
    ),
    safetyRationale: text(record.safetyRationale ?? record.safety_rationale, {
      fallback: "",
      min: 12,
      max: 280,
    }),
  };
}

function normalizeEnumValue(value: unknown) {
  return typeof value === "string"
    ? value
        .trim()
        .replace(/[\s-]+/g, "_")
        .toUpperCase()
    : value;
}

function normalizeShowcaseCameraBehavior(value: unknown) {
  const normalized = normalizeEnumValue(value);
  if (typeof normalized !== "string") return normalized;
  const aliases: Record<string, string> = {
    FIXED_CAMERA: "FIXED",
    STATIC: "FIXED",
    STATIC_CAMERA: "FIXED",
    SLOW_ZOOM: "SLOW_PUSH_IN",
    SLOW_ZOOM_IN: "SLOW_PUSH_IN",
    ZOOM_IN: "SLOW_PUSH_IN",
    SLOW_DOLLY_IN: "SLOW_PUSH_IN",
    SLOW_ZOOM_OUT: "SLOW_PULL_BACK",
    ZOOM_OUT: "SLOW_PULL_BACK",
    SLOW_DOLLY_OUT: "SLOW_PULL_BACK",
    GENTLE_PRODUCT_ORBIT: "GENTLE_ORBIT",
    PARTIAL_ORBIT: "GENTLE_ORBIT",
    SLOW_ORBIT: "GENTLE_ORBIT",
  };
  return aliases[normalized] ?? normalized;
}

function normalizeShowcaseHumanPresence(value: unknown) {
  const normalized = normalizeEnumValue(value);
  if (typeof normalized !== "string") return normalized;
  const aliases: Record<string, string> = {
    NONE: "NO_PERSON",
    NO_HUMAN: "NO_PERSON",
    NO_HUMANS: "NO_PERSON",
    NO_PEOPLE: "NO_PERSON",
    PRODUCT_ONLY: "NO_PERSON",
    PRODUCT_ONLY_NO_PERSON: "NO_PERSON",
    SINGLE_HUMAN: "ONE_PERSON",
    SINGLE_PERSON: "ONE_PERSON",
    ONE_HUMAN: "ONE_PERSON",
    ONE_MODEL: "ONE_PERSON",
  };
  return aliases[normalized] ?? normalized;
}

function normalizeShowcaseSeparationTreatment(value: unknown) {
  const normalized = normalizeEnumValue(value);
  if (typeof normalized !== "string") return normalized;
  const aliases: Record<string, string> = {
    NONE: "AVOID",
    NO_SEPARATION: "AVOID",
    NO_TEARDOWN: "AVOID",
    AVOID_SEPARATION: "AVOID",
    AVOID_TEARDOWN: "AVOID",
    SAFE_FOOD_LAYERS: "FOOD_LAYER_SEPARATION",
    FOOD_LAYERS: "FOOD_LAYER_SEPARATION",
    LARGE_VISIBLE_COMPONENTS: "VISIBLE_COMPONENT_SEPARATION",
    VISIBLE_COMPONENTS: "VISIBLE_COMPONENT_SEPARATION",
  };
  return aliases[normalized] ?? normalized;
}

function canonicalizeStoryboardValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const nested =
    asRecord(record.storyboard) ??
    asRecord(record.result) ??
    asRecord(record.output) ??
    record;

  return {
    ...nested,
    bgm: nested.bgm ?? nested.music ?? nested.backgroundMusic,
    scenes:
      nested.scenes ??
      nested.storyboardScenes ??
      nested.storyboard_scenes ??
      nested.timeline,
  };
}

function normalizeStoryboardScene(value: unknown, index: number) {
  const record = asRecord(value) ?? {};
  const caption = text(
    record.captionText ?? record.caption ?? record.onScreenText,
    {
      fallback: "",
      min: 1,
      max: 140,
    },
  );
  const voiceover = text(
    record.voiceoverText ??
      record.voiceover ??
      record.narration ??
      record.voiceOver,
    {
      fallback: "",
      min: 1,
      max: 600,
    },
  );
  const continuityMode = normalizeContinuityMode(
    record.continuityMode ??
      record.continuity_mode ??
      record.transitionMode ??
      record.transition_mode,
  );
  const transitionStyle =
    continuityMode === "MATCH_CUT"
      ? ("CUT" as const)
      : normalizeTransitionStyle(
          record.transitionStyle ??
            record.transition_style ??
            record.transitionEffect ??
            record.transition_effect,
          index,
        );

  return {
    index: integerInRange(record.index ?? index + 1, {
      fallback: index + 1,
      min: 1,
      max: 4,
    }),
    durationSec: integerInRange(
      record.durationSec ?? record.duration_sec ?? record.duration,
      { fallback: 8, min: 5, max: 10 },
    ),
    captionText: caption || text(voiceover, { fallback: "", min: 1, max: 140 }),
    voiceoverText:
      voiceover || text(caption, { fallback: "", min: 1, max: 600 }),
    shotPrompt: normalizeGeneratedShotPrompt(
      record.shotPrompt ??
        record.shot_prompt ??
        record.videoMotionPrompt ??
        record.video_motion_prompt ??
        record.motionPrompt ??
        record.motion,
      index,
    ),
    continuityNotes: text(
      record.continuityNotes ??
        record.continuity_notes ??
        record.continuity ??
        record.notes,
      {
        fallback:
          "Preserve the focal subject, established palette, lighting direction, and spatial composition throughout the shot.",
        min: 6,
        max: 700,
      },
    ),
    continuityMode,
    transitionStyle,
  };
}

function selectShowcaseScenes(
  scenes: ReturnType<typeof normalizeStoryboardScene>[],
  desiredCount: number,
) {
  if (scenes.length <= desiredCount) return scenes;

  const first = scenes[0]!;
  const closer = scenes.at(-1)!;
  if (desiredCount === 1) {
    return [
      {
        ...first,
        captionText: closer.captionText || first.captionText,
        continuityMode: "CONTINUOUS" as const,
        index: 1,
        transitionStyle: "CUT" as const,
        voiceoverText: closer.voiceoverText || first.voiceoverText,
      },
    ];
  }

  return [first, closer].slice(0, desiredCount);
}

function selectScenesForCount(
  scenes: ReturnType<typeof normalizeStoryboardScene>[],
  desiredCount: number,
) {
  if (scenes.length <= desiredCount) return scenes;
  if (desiredCount === 1) return selectShowcaseScenes(scenes, 1);

  const selected = [scenes[0]!];
  const interiorNeeded = desiredCount - 2;
  for (let index = 1; index <= interiorNeeded; index += 1) {
    const sourceIndex = Math.round(
      (index * (scenes.length - 1)) / (interiorNeeded + 1),
    );
    selected.push(scenes[sourceIndex]!);
  }
  selected.push(scenes.at(-1)!);

  return selected.map((scene, index) => ({
    ...scene,
    index: index + 1,
    transitionStyle: index === 0 ? ("CUT" as const) : scene.transitionStyle,
  }));
}

function normalizeContinuityBible(
  value: unknown,
  {
    outputMode,
    scenes,
  }: {
    outputMode: "STANDARD" | "PRODUCT_SHOWCASE";
    scenes: ReturnType<typeof normalizeStoryboardScene>[];
  },
) {
  const record = asRecord(value) ?? {};
  const productOnlyShowcase =
    outputMode === "PRODUCT_SHOWCASE" &&
    !scenes.some((scene) =>
      /\b(?:person|people|woman|man|girl|boy|founder|server|model|customer|guest|staff|worker|chef|hands?|face|wardrobe|wears?)\b/i.test(
        `${scene.shotPrompt} ${scene.continuityNotes}`,
      ),
    );
  const characters = text(
    record.characters ??
      record.character ??
      record.characterContinuity ??
      record.character_continuity,
    {
      fallback: productOnlyShowcase
        ? "No people appear; keep the supplied product as the only focal subject."
        : "Keep recurring characters' identity, wardrobe, age, hair, and defining features stable across scenes.",
      min: 20,
      max: 500,
    },
  );

  return {
    product: text(
      record.product ?? record.productContinuity ?? record.product_continuity,
      {
        fallback:
          "Keep every recurring product's shape, materials, colors, and proportions stable across scenes.",
        min: 6,
        max: 700,
      },
    ),
    characters,
    cast: normalizeCastPlan(
      record.cast ?? record.castPlan ?? record.cast_plan,
      characters,
    ),
    visualWorld: text(
      record.visualWorld ??
        record.visual_world ??
        record.visualContinuity ??
        record.visual_continuity ??
        record.environment,
      {
        fallback:
          "Preserve the established palette, lighting direction, lens language, texture, and time of day.",
        min: 6,
        max: 700,
      },
    ),
  };
}

function normalizeCastPlan(value: unknown, characterSummary: string) {
  const record = asRecord(value);

  if (!record) {
    return /\bno (?:recurring )?(?:human )?(?:characters?|people)\b/i.test(
      characterSummary,
    )
      ? { mode: "NO_PEOPLE", members: [] }
      : { mode: "", members: [] };
  }

  const members = Array.isArray(record.members)
    ? record.members.slice(0, 4).map((value) => {
        const member = asRecord(value) ?? {};
        const complexion =
          member.complexionOrHeritageAnchor ??
          member.complexion_or_heritage_anchor ??
          member.skinTone ??
          member.skin_tone ??
          null;

        return {
          role: text(member.role ?? member.label ?? member.character, {
            fallback: "",
            min: 2,
            max: 40,
          }),
          recurrence: normalizeEnum(member.recurrence ?? member.persistence, [
            "RECURRING",
            "SCENE_ONLY",
          ] as const),
          ageBand: text(member.ageBand ?? member.age_band ?? member.age, {
            fallback: "",
            min: 2,
            max: 32,
          }),
          referenceBasis: normalizeEnum(
            member.referenceBasis ?? member.reference_basis ?? member.basis,
            ["REFERENCE_BACKED", "FICTIONAL_CAST"] as const,
          ),
          appearanceAnchors: (Array.isArray(member.appearanceAnchors)
            ? member.appearanceAnchors
            : Array.isArray(member.appearance_anchors)
              ? member.appearance_anchors
              : []
          )
            .slice(0, 5)
            .map((anchor) => text(anchor, { fallback: "", min: 2, max: 48 })),
          complexionOrHeritageAnchor:
            complexion === null || complexion === undefined
              ? null
              : text(complexion, { fallback: "", min: 2, max: 72 }),
          wardrobeAnchor: text(
            member.wardrobeAnchor ?? member.wardrobe_anchor ?? member.wardrobe,
            { fallback: "", min: 3, max: 80 },
          ),
          distinguishingFeature: text(
            member.distinguishingFeature ??
              member.distinguishing_feature ??
              member.distinction,
            { fallback: "", min: 8, max: 140 },
          ),
        };
      })
    : [];

  const requestedMode = normalizeEnum(record.mode, [
    "NO_PEOPLE",
    "SINGLE_PERSON",
    "MULTI_PERSON",
  ] as const);
  const inferredMode =
    members.length === 0
      ? "NO_PEOPLE"
      : members.length === 1
        ? "SINGLE_PERSON"
        : "MULTI_PERSON";
  const modeMatchesCount =
    (requestedMode === "NO_PEOPLE" && members.length === 0) ||
    (requestedMode === "SINGLE_PERSON" && members.length === 1) ||
    (requestedMode === "MULTI_PERSON" && members.length >= 2);

  return {
    mode: modeMatchesCount ? requestedMode : inferredMode,
    members,
  };
}

function normalizeEnum<const T extends readonly string[]>(
  value: unknown,
  options: T,
) {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  return (options as readonly string[]).includes(normalized) ? normalized : "";
}

function normalizeContinuityMode(value: unknown) {
  const normalized = String(value ?? "CONTINUOUS")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "MATCH_CUT" || normalized === "INTENTIONAL_CHANGE") {
    return normalized;
  }

  return "CONTINUOUS" as const;
}

function normalizeTransitionStyle(value: unknown, sceneIndex: number) {
  if (sceneIndex === 0) return "CUT" as const;

  const normalized = normalizeEnum(value, [
    "CUT",
    "FADE",
    "SLIDE",
    "WIPE",
    "IRIS",
    "CLOCK_WIPE",
  ] as const);

  return normalized || ("CUT" as const);
}

/**
 * Structured-output providers can satisfy the JSON shape while narrowly
 * missing a prose-level refinement. Preserve the first clear action and make
 * only deterministic, low-risk repairs; genuinely missing directions still
 * fail validation instead of becoming generic filler.
 */
function normalizeGeneratedShotPrompt(value: unknown, sceneIndex = 0) {
  const raw = text(value, { fallback: "", min: 20, max: 480 });

  if (shotPromptSchema.safeParse(raw).success || raw.length < 20) {
    return raw;
  }

  const clean = raw.replace(/[“”"]/g, "").replace(/\s+/g, " ").trim();
  const sentenceParts = clean
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const colonMatch = clean.match(/^([^:]{2,50}):\s*(.+)$/);
  const moodLeadMatch = clean.match(
    /^([^.!?:]{2,40}\b(?:atmosphere|mood|energy|tension|pressure|warmth|relief|confidence|curiosity|delight|unease))\s+(.+)$/i,
  );
  const suppliedCameraBehavior = reliableCameraBehavior(clean);
  const cameraBehavior =
    countReliableCameraBehaviors(clean) === 1 && suppliedCameraBehavior
      ? suppliedCameraBehavior
      : preferredCameraBehavior(sceneIndex);
  let mood = inferShotMood(clean);
  let action =
    sentenceParts.find((part) => !reliableCameraBehavior(part)) ??
    sentenceParts[0] ??
    clean;

  if (colonMatch) {
    mood = colonMatch[1]?.trim() || mood;
    const bodyParts = (colonMatch[2] ?? action)
      .split(/[.!?]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    action =
      bodyParts.find((part) => !reliableCameraBehavior(part)) ??
      bodyParts[0] ??
      action;
  } else if (moodLeadMatch) {
    mood = moodLeadMatch[1]?.trim() || mood;
    action = moodLeadMatch[2]?.trim() || action;
  } else if (
    sentenceParts.length > 1 &&
    (sentenceParts[0]?.split(/\s+/).length ?? 0) <= 6
  ) {
    mood = sentenceParts[0] ?? mood;
    action = sentenceParts[1] ?? action;
  }

  mood = sanitizeShotMood(mood, clean);
  action = sanitizeShotAction(action);

  if (!action) {
    action =
      "the focal subject moves into the foreground as surface detail settles under controlled light";
  } else if (!visibleStoryBeatPattern.test(action)) {
    action = `${action}, as the focal subject moves into the foreground`;
  }

  action = action.split(/\s+/).slice(0, 42).join(" ");

  const candidate = `${mood}: ${action}.`;
  if (shotPromptSchema.safeParse(candidate).success) {
    return candidate;
  }

  // Preserve a supported camera direction even when the provider put it in a
  // second sentence. If none was supplied, use the most stable setup. We do
  // not invent a story beat: banal or overloaded action still goes to repair.
  const cameraClause = cameraDirectionClause(cameraBehavior);
  let repaired = `${mood}: ${action.replace(/[,;\s]+$/, "")}, while ${cameraClause}.`;
  if (wordCount(repaired) < 14) {
    repaired = `${mood}: ${action.replace(/[,;\s]+$/, "")} with surface detail settling under controlled light, while ${cameraClause}.`;
  }

  if (shotPromptSchema.safeParse(repaired).success) return repaired;

  const fallback = `${mood || "Purposeful energy"}: the focal subject moves into the foreground as its surface detail settles under controlled light, while ${cameraClause}.`;

  return shotPromptSchema.safeParse(fallback).success ? fallback : raw;
}

function sanitizeShotAction(value: string) {
  return value
    .replace(
      /\b(?:while|as|and)?\s*(?:(?:the|a)\s+)?(?:(?:fixed|static|handheld)\s+camera|camera|slow push-in|slow pull-back|gentle product orbit|handheld follow)\b[^,;]*/gi,
      "",
    )
    .replace(
      /\b(?:pan(?:s|ning)?|zooms?|doll(?:y|ies)|rack(?:s|ing)? focus|tilts?)\b[^,;]*/gi,
      "",
    )
    .replace(/\b(?:shows?|captures?|depicts?|features?)\b/gi, "")
    .replace(/\billuminates?\b/gi, "sweeps across")
    .replace(sequencePattern, "as")
    .replace(/\band\b/gi, ",")
    .replace(/[:.!?]+/g, "")
    .replace(/\s*,\s*/g, ", ")
    .replace(/(?:,\s*){2,}/g, ", ")
    .replace(/\b(?:as|while|with)\s*$/i, "")
    .replace(/^[,;\s]+|[,;\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeShotMood(value: string, fullPrompt: string) {
  const sanitized = sanitizeShotAction(value)
    .replace(/[,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join(" ");

  return sanitized && countReliableCameraBehaviors(sanitized) === 0
    ? sanitized
    : inferShotMood(fullPrompt);
}

function preferredCameraBehavior(sceneIndex: number) {
  const behaviors = ["fixed", "push-in", "pull-back", "orbit"] as const;
  return behaviors[sceneIndex % behaviors.length]!;
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function cameraDirectionClause(
  behavior: NonNullable<ReturnType<typeof reliableCameraBehavior>>,
) {
  switch (behavior) {
    case "push-in":
      return "a slow push-in tightens the layered composition";
    case "pull-back":
      return "a slow pull-back reveals the wider composition";
    case "orbit":
      return "a gentle product orbit traces the changing silhouette";
    case "handheld-follow":
      return "a handheld follow stays with the focal action";
    default:
      return "a fixed camera holds the composition";
  }
}

function fitVoiceoverToDuration(value: string, durationSec: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const budget = Math.max(1, Math.floor(durationSec * 2.5));
  if (words.length <= budget) return value;

  const fitted = words.slice(0, budget);
  while (
    fitted.length > 1 &&
    /^(?:and|or|but|as|with|to|the|a|an)$/i.test(
      fitted[fitted.length - 1]!.replace(/[^a-z]/gi, ""),
    )
  ) {
    fitted.pop();
  }

  return `${fitted.join(" ").replace(/[,:;.!?]+$/, "")}.`;
}

function inferShotMood(value: string) {
  if (
    /\b(?:overwhelm|frustrat|tense|cry|panic|pressure|stress)\w*\b/i.test(value)
  ) {
    return "Tense pressure";
  }
  if (
    /\b(?:relief|release|calm|safe|trust|reassur|gentle|warm)\w*\b/i.test(value)
  ) {
    return "Reassuring warmth";
  }
  if (/\b(?:quiet|serene|rest|coffee|breathe|peace)\w*\b/i.test(value)) {
    return "Earned relief";
  }
  if (/\b(?:play|joy|laugh|delight|surpris)\w*\b/i.test(value)) {
    return "Playful energy";
  }
  if (/\b(?:product|package|reveal|launch|confiden)\w*\b/i.test(value)) {
    return "Confident reveal";
  }

  return "Purposeful energy";
}

function normalizeStoryboardScript(
  record: Record<string, unknown>,
  scenes: ReturnType<typeof normalizeStoryboardScene>[],
  title: string,
) {
  const narratedStory = scenes
    .map((scene) => scene.voiceoverText.trim())
    .filter(Boolean)
    .join(" ");
  const editorialOutline = [
    title,
    ...scenes.map((scene) => scene.captionText.trim()).filter(Boolean),
  ]
    .map((part) => part.replace(/[.!?]+$/, ""))
    .filter(Boolean)
    .join(". ");
  const derivedScript =
    narratedStory.length >= 20 ? narratedStory : editorialOutline;

  return text(record.script ?? record.voiceoverScript ?? record.copy, {
    fallback: derivedScript,
    min: 20,
    max: 2400,
  });
}

function normalizeBgm(
  value: unknown,
  outputMode: "STANDARD" | "PRODUCT_SHOWCASE",
) {
  const record = asRecord(value);
  const showcase = outputMode === "PRODUCT_SHOWCASE";
  const requestedEnabled =
    typeof record?.enabled === "boolean"
      ? record.enabled
      : typeof record?.bgmEnabled === "boolean"
        ? record.bgmEnabled
        : false;
  const enabled = showcase ? true : requestedEnabled;
  const presetFallback = showcase
    ? "cinematic-wonder"
    : enabled
      ? "subtle"
      : "none";
  const promptFallback = showcase
    ? "Premium instrumental background music matched to the product mood and kept beneath narration."
    : enabled
      ? "Subtle background music that stays beneath the narration."
      : "Voiceover only; no background music.";
  const rawPreset = record?.preset ?? record?.mood ?? record?.style;
  const rawPrompt = record?.prompt ?? record?.description;
  const presetSource =
    enabled && isDisabledBgmText(rawPreset) ? undefined : rawPreset;
  const promptSource =
    enabled && isDisabledBgmText(rawPrompt) ? undefined : rawPrompt;

  return {
    enabled,
    preset: text(presetSource, {
      fallback: presetFallback,
      min: 2,
      max: 80,
    }),
    prompt: text(promptSource, {
      fallback: promptFallback,
      min: 4,
      max: 400,
    }),
  };
}

function isDisabledBgmText(value: unknown) {
  return (
    typeof value === "string" &&
    /^(?:none|off|disabled|no (?:bgm|music)|voiceover only)\b/i.test(
      value.trim(),
    )
  );
}

function text(
  value: unknown,
  {
    fallback,
    min,
    max,
  }: {
    fallback: string;
    min: number;
    max: number;
  },
) {
  const raw =
    typeof value === "string"
      ? value
      : value === null || value === undefined
        ? fallback
        : String(value);
  const trimmed = raw.replace(/\s+/g, " ").trim() || fallback;
  const padded =
    trimmed.length >= min
      ? trimmed
      : `${trimmed} ${fallback}`.replace(/\s+/g, " ").trim();

  return padded.slice(0, max);
}

function integerInRange(
  value: unknown,
  {
    fallback,
    min,
    max,
  }: {
    fallback: number;
    min: number;
    max: number;
  },
) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value.match(/\d+/)?.[0] ?? "", 10)
        : Number.NaN;
  const safe = Number.isFinite(parsed) ? Math.round(parsed) : fallback;

  return Math.min(max, Math.max(min, safe));
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
