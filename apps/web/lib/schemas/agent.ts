import { z } from "zod";

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

export const creativeConceptsSchema = z.object({
  concepts: z.array(creativeConceptSchema).length(3),
});

export const creativeConceptRegenerationSchema = z.object({
  concept: creativeConceptSchema,
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

export const creativeConceptRegenerationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["concept"],
  properties: {
    concept: creativeConceptsJsonSchema.properties.concepts.items,
  },
} satisfies Record<string, unknown>;

export const storyboardSceneSchema = z.object({
  index: z.number().int().min(1).max(4),
  durationSec: z.number().int().min(4).max(15),
  captionText: z.string().min(1).max(140),
  voiceoverText: z.string().min(1).max(600),
  startFramePrompt: z.string().min(20).max(1200),
  endFramePrompt: z.string().min(20).max(1200),
  videoMotionPrompt: z.string().min(20).max(1200),
  continuityNotes: z.string().min(6).max(700),
  continuityMode: z.enum(["CONTINUOUS", "MATCH_CUT", "INTENTIONAL_CHANGE"]),
});

export const storyboardSchema = z
  .object({
    title: z.string().min(3).max(100),
    script: z.string().min(20).max(2400),
    bgm: z.object({
      enabled: z.boolean(),
      preset: z.string().min(2).max(80),
      prompt: z.string().min(4).max(400),
    }),
    continuityBible: z.object({
      product: z.string().min(6).max(700),
      characters: z.string().min(6).max(700),
      visualWorld: z.string().min(6).max(700),
    }),
    scenes: z.array(storyboardSceneSchema).min(2).max(4),
  })
  .superRefine((value, ctx) => {
    const totalDuration = value.scenes.reduce(
      (sum, scene) => sum + scene.durationSec,
      0,
    );

    if (totalDuration < 15 || totalDuration > 30) {
      ctx.addIssue({
        code: "custom",
        message: "Storyboard duration must land between 15 and 30 seconds.",
        path: ["scenes"],
      });
    }
  });

export const storyboardJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "script", "bgm", "continuityBible", "scenes"],
  properties: {
    title: { type: "string", minLength: 3, maxLength: 100 },
    script: { type: "string", minLength: 20, maxLength: 2400 },
    bgm: {
      type: "object",
      additionalProperties: false,
      required: ["enabled", "preset", "prompt"],
      properties: {
        enabled: { type: "boolean" },
        preset: { type: "string", minLength: 2, maxLength: 80 },
        prompt: { type: "string", minLength: 4, maxLength: 400 },
      },
    },
    continuityBible: {
      type: "object",
      additionalProperties: false,
      required: ["product", "characters", "visualWorld"],
      properties: {
        product: { type: "string", minLength: 6, maxLength: 700 },
        characters: { type: "string", minLength: 6, maxLength: 700 },
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
          "startFramePrompt",
          "endFramePrompt",
          "videoMotionPrompt",
          "continuityNotes",
          "continuityMode",
        ],
        properties: {
          index: { type: "integer", minimum: 1, maximum: 4 },
          durationSec: { type: "integer", minimum: 4, maximum: 15 },
          captionText: { type: "string", minLength: 1, maxLength: 140 },
          voiceoverText: { type: "string", minLength: 1, maxLength: 600 },
          startFramePrompt: {
            type: "string",
            minLength: 20,
            maxLength: 1200,
          },
          endFramePrompt: {
            type: "string",
            minLength: 20,
            maxLength: 1200,
          },
          videoMotionPrompt: {
            type: "string",
            minLength: 20,
            maxLength: 1200,
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
        },
      },
    },
  },
} satisfies Record<string, unknown>;

export const storyboardPatchSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  script: z.string().min(20).max(2400).optional(),
  bgmEnabled: z.boolean().optional(),
  bgmPrompt: z.string().max(400).nullable().optional(),
  productContinuity: z.string().min(1).max(700).optional(),
  characterContinuity: z.string().min(1).max(700).optional(),
  visualContinuity: z.string().min(1).max(700).optional(),
  scenes: z
    .array(
      z.object({
        id: z.string().min(1),
        durationSec: z.number().int().min(4).max(15),
        captionText: z.string().min(1).max(140),
        voiceoverText: z.string().min(1).max(600),
        startFramePrompt: z.string().min(20).max(1200),
        endFramePrompt: z.string().min(20).max(1200),
        videoMotionPrompt: z.string().min(20).max(1200),
        continuityNotes: z.string().min(1).max(700),
        continuityMode: z.enum([
          "CONTINUOUS",
          "MATCH_CUT",
          "INTENTIONAL_CHANGE",
        ]),
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

export type CreativeConceptsOutput = z.infer<typeof creativeConceptsSchema>;
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
  })
  .passthrough();

export function parseCreativeConceptsOutput(
  value: unknown,
): CreativeConceptsOutput {
  const extracted = extractConceptArray(value);

  const concepts = extracted
    .slice(0, 3)
    .map((item: unknown) => normalizeConcept(item));

  return creativeConceptsSchema.parse({ concepts });
}

export function parseCreativeConceptRegenerationOutput(value: unknown) {
  const record = asRecord(value);
  const directConcept = record ? asRecord(record.concept) : null;
  const extracted = directConcept ?? extractConceptArray(value)[0];

  return creativeConceptRegenerationSchema.parse({
    concept: normalizeConcept(extracted),
  });
}

export function parseStoryboardOutput(value: unknown): StoryboardOutput {
  const canonical = canonicalizeStoryboardValue(value);
  const strict = storyboardSchema.safeParse(canonical);

  if (strict.success) {
    return strict.data;
  }

  const record = asRecord(canonical) ?? {};
  const rawScenes = Array.isArray(record.scenes)
    ? record.scenes
    : Array.isArray(record.storyboard)
      ? record.storyboard
      : [];
  const scenes = rawScenes
    .slice(0, 4)
    .map((scene, index) => normalizeStoryboardScene(scene, index));

  return storyboardSchema.parse({
    title: text(record.title ?? record.name ?? "Generated storyboard", {
      fallback: "",
      min: 3,
      max: 100,
    }),
    script: text(record.script ?? record.voiceoverScript ?? record.copy, {
      fallback: "",
      min: 20,
      max: 2400,
    }),
    bgm: normalizeBgm(record.bgm ?? record.music ?? record.backgroundMusic),
    continuityBible: normalizeContinuityBible(
      record.continuityBible ??
        record.continuity_bible ??
        record.consistencyBible ??
        record.consistency_bible,
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

function normalizeConcept(value: unknown) {
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

  return {
    title,
    hook,
    strategy,
    narrativeArc,
    visualStyle,
    estimatedScenes: integerInRange(
      parsed.estimatedScenes ??
        parsed.estimated_scenes ??
        parsed.sceneCount ??
        parsed.scene_count ??
        (Array.isArray(parsed.scenes) ? parsed.scenes.length : undefined),
      { fallback: 3, min: 2, max: 4 },
    ),
    estimatedDurationSec: integerInRange(
      parsed.estimatedDurationSec ??
        parsed.estimated_duration_sec ??
        parsed.estimatedDuration ??
        parsed.estimated_duration ??
        parsed.durationSec ??
        parsed.duration ??
        parsed.target_duration_seconds,
      { fallback: 24, min: 15, max: 30 },
    ),
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

  return {
    index: integerInRange(record.index ?? index + 1, {
      fallback: index + 1,
      min: 1,
      max: 4,
    }),
    durationSec: integerInRange(
      record.durationSec ?? record.duration_sec ?? record.duration,
      { fallback: 8, min: 4, max: 15 },
    ),
    captionText: text(
      record.captionText ?? record.caption ?? record.onScreenText,
      {
        fallback: "",
        min: 1,
        max: 140,
      },
    ),
    voiceoverText: text(
      record.voiceoverText ??
        record.voiceover ??
        record.narration ??
        record.voiceOver,
      {
        fallback: "",
        min: 1,
        max: 600,
      },
    ),
    startFramePrompt: text(
      record.startFramePrompt ??
        record.start_frame_prompt ??
        record.startPrompt ??
        record.keyframeStartPrompt,
      {
        fallback: "",
        min: 20,
        max: 1200,
      },
    ),
    endFramePrompt: text(
      record.endFramePrompt ??
        record.end_frame_prompt ??
        record.endPrompt ??
        record.keyframeEndPrompt,
      {
        fallback: "",
        min: 20,
        max: 1200,
      },
    ),
    videoMotionPrompt: text(
      record.videoMotionPrompt ??
        record.video_motion_prompt ??
        record.motionPrompt ??
        record.motion,
      {
        fallback: "",
        min: 20,
        max: 1200,
      },
    ),
    continuityNotes: text(
      record.continuityNotes ??
        record.continuity_notes ??
        record.continuity ??
        record.notes,
      {
        fallback: "",
        min: 6,
        max: 700,
      },
    ),
    continuityMode: normalizeContinuityMode(
      record.continuityMode ??
        record.continuity_mode ??
        record.transitionMode ??
        record.transition_mode,
    ),
  };
}

function normalizeContinuityBible(value: unknown) {
  const record = asRecord(value) ?? {};

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
    characters: text(
      record.characters ??
        record.character ??
        record.characterContinuity ??
        record.character_continuity,
      {
        fallback:
          "Keep recurring characters' identity, wardrobe, age, hair, and defining features stable across scenes.",
        min: 6,
        max: 700,
      },
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

function normalizeBgm(value: unknown) {
  const record = asRecord(value);

  if (!record) {
    return {
      enabled: true,
      preset: "",
      prompt: "",
    };
  }

  return {
    enabled:
      typeof record.enabled === "boolean"
        ? record.enabled
        : typeof record.bgmEnabled === "boolean"
          ? record.bgmEnabled
          : true,
    preset: text(record.preset ?? record.mood ?? record.style, {
      fallback: "",
      min: 2,
      max: 80,
    }),
    prompt: text(record.prompt ?? record.description, {
      fallback: "",
      min: 4,
      max: 400,
    }),
  };
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
