import { z } from "zod";

const envSchema = z.object({
  DASHSCOPE_API_KEY: z.string().min(1),
  QWEN_BASE_URL: z
    .string()
    .url()
    .default("https://dashscope-intl.aliyuncs.com/compatible-mode/v1"),
  DATABASE_URL: z.string().url(),
  OSS_REGION: z.string().min(1),
  OSS_BUCKET: z.string().min(1),
  OSS_ACCESS_KEY_ID: z.string().min(1),
  OSS_ACCESS_KEY_SECRET: z.string().min(1),
  PUBLIC_APP_URL: z.string().url(),
  REDIS_URL: z.string().url().optional().or(z.literal("")),
  QWEN_VIDEO_BASE_URL: z.string().url().optional().or(z.literal("")),
  QWEN_IMAGE_BASE_URL: z.string().url().optional().or(z.literal("")),
  QWEN_TTS_BASE_URL: z.string().url().optional().or(z.literal("")),
  SENTRY_DSN: z.string().url().optional().or(z.literal("")),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(
  source: Record<string, string | undefined> = process.env,
): AppEnv {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join("."));
    throw new Error(
      `Invalid environment configuration: ${Array.from(new Set(names)).join(", ")}`,
    );
  }

  return parsed.data;
}
