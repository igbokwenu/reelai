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

export const storyboardSceneSchema = z.object({
  index: z.number().int().min(1).max(4),
  durationSec: z.number().int().min(4).max(15),
  captionText: z.string().min(1).max(140),
  voiceoverText: z.string().min(1).max(600),
  startFramePrompt: z.string().min(20).max(1200),
  endFramePrompt: z.string().min(20).max(1200),
  videoMotionPrompt: z.string().min(20).max(1200),
  continuityNotes: z.string().min(6).max(700),
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

export const storyboardPatchSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  script: z.string().min(20).max(2400).optional(),
  bgmEnabled: z.boolean().optional(),
  bgmPrompt: z.string().max(400).nullable().optional(),
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
  console.log("[parseCreativeConceptsOutput] Raw AI response:", JSON.stringify(value, null, 2).slice(0, 3000));
  
  const extracted = extractConceptArray(value);
  
  if (extracted.length > 0) {
    console.log("[parseCreativeConceptsOutput] First concept structure:", JSON.stringify(extracted[0], null, 2).slice(0, 2000));
  }

  while (extracted.length < 3) {
    extracted.push({
      title: `Creative direction ${extracted.length + 1}`,
      hook: "A distinct brand-safe hook for this direction.",
      strategy:
        "Use a distinct short-form ad strategy grounded in the Brand Kit and supplied source materials.",
      narrativeArc:
        "Open with a clear problem, show the branded proof point, and close with a simple next step.",
      visualStyle:
        "Vertical brand-led visuals with clear product context and clean caption safe zones.",
      estimatedScenes: 3,
      estimatedDurationSec: 24,
      previewPrompt: `9:16 preview frame for creative direction ${extracted.length + 1}`,
      rationale:
        "This direction gives the reviewer a meaningfully different creative path while staying grounded in the Brand Kit.",
    });
  }

  const concepts = extracted
    .slice(0, 3)
    .map((item: unknown, index: number) => normalizeConcept(item, index));

  return creativeConceptsSchema.parse({ concepts });
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
  const scenes = rawScenes.slice(0, 4).map((scene, index) =>
    normalizeStoryboardScene(scene, index),
  );

  return storyboardSchema.parse({
    title: text(record.title ?? record.name ?? "Generated storyboard", {
      fallback: "Generated storyboard",
      min: 3,
      max: 100,
    }),
    script: text(record.script ?? record.voiceoverScript ?? record.copy, {
      fallback:
        "A concise vertical reel script with a clear setup, branded middle, and action-oriented finish.",
      min: 20,
      max: 2400,
    }),
    bgm: normalizeBgm(record.bgm ?? record.music ?? record.backgroundMusic),
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

function normalizeConcept(value: unknown, index: number) {
  const parsed = flexibleConceptSchema.parse(asRecord(value) ?? {});
  const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  const firstScene = scenes[0] ? asRecord(scenes[0]) : null;
  
  const title = text(parsed.title, {
    fallback: `Creative direction ${index + 1}`,
    min: 3,
    max: 90,
  });
  const hook = text(
    parsed.hook ?? 
    (firstScene ? firstScene.text_overlay : undefined) ??
    (firstScene ? firstScene.visual_description : undefined),
    {
      fallback: `${title} opens with a specific, brand-safe hook.`,
      min: 8,
      max: 220,
    },
  );
  const strategy = text(parsed.strategy ?? parsed.approach ?? parsed.concept ?? parsed.concept_summary, {
    fallback:
      "Use a distinct short-form ad strategy grounded in the Brand Kit and supplied source materials.",
    min: 20,
    max: 420,
  });
  const narrativeArc = text(
    parsed.narrativeArc ?? parsed.narrative_arc ?? parsed.arc ?? parsed.storyArc ?? parsed.concept_summary,
    {
      fallback:
        "Open with a clear problem, show the branded proof point, and close with a simple next step.",
      min: 20,
      max: 520,
    },
  );
  const visualStyle = text(
    parsed.visualStyle ?? 
    parsed.visual_style ?? 
    parsed.style ??
    (firstScene ? firstScene.visual_description : undefined),
    {
      fallback:
        "Vertical brand-led visuals with clear product context and clean caption safe zones.",
      min: 12,
      max: 320,
    },
  );
  const previewPrompt = text(
    parsed.previewPrompt ??
      parsed.preview_prompt ??
      parsed.imagePrompt ??
      parsed.image_prompt ??
      parsed.framePrompt,
    {
      fallback: `9:16 preview frame for "${title}" using ${visualStyle}`,
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
        parsed.why_it_works,
      {
        fallback:
          "This direction gives the reviewer a meaningfully different creative path while staying grounded in the Brand Kit.",
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
    captionText: text(record.captionText ?? record.caption ?? record.onScreenText, {
      fallback: `Scene ${index + 1}`,
      min: 1,
      max: 140,
    }),
    voiceoverText: text(
      record.voiceoverText ??
        record.voiceover ??
        record.narration ??
        record.voiceOver,
      {
        fallback: "A concise narration line grounded in the selected concept.",
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
        fallback:
          "Vertical branded opening frame with clear subject, safe-zone composition, and source-grounded styling.",
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
        fallback:
          "Vertical branded ending frame that preserves subject, palette, lighting, and caption safe zones.",
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
        fallback:
          "Smooth, restrained camera movement with consistent subject placement and no unsupported claim text.",
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
        fallback:
          "Preserve brand palette, typography, subject identity, lighting, and safe-zone caption placement.",
        min: 6,
        max: 700,
      },
    ),
  };
}

function normalizeBgm(value: unknown) {
  const record = asRecord(value);

  if (!record) {
    return {
      enabled: true,
      preset: "warm editorial pulse",
      prompt: "Light rhythmic background bed that supports narration.",
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
      fallback: "warm editorial pulse",
      min: 2,
      max: 80,
    }),
    prompt: text(record.prompt ?? record.description, {
      fallback: "Light rhythmic background bed that supports narration.",
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
