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
