export function buildVideoSubmissionBody({
  model,
  prompt,
  negativePrompt,
  imageUrl,
  resolution = "720P",
  durationSec,
}: {
  model: string;
  prompt: string;
  negativePrompt?: string;
  imageUrl: string;
  resolution?: "720P" | "1080P";
  durationSec: number;
}) {
  const duration = Math.max(5, Math.min(10, durationSec));

  if (model.startsWith("wan2.7")) {
    return {
      model,
      input: {
        prompt,
        ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
        media: [{ type: "first_frame", url: imageUrl }],
      },
      parameters: {
        duration,
        resolution,
        // wan2.7-i2v only receives audio when driving audio is explicitly
        // supplied. Omit it so source clips stay silent; narration is mixed
        // later in Remotion.
        // Keep the approved anchor exact; production intentionally omits a
        // last_frame so the clip can exit with natural motion.
        prompt_extend: false,
        watermark: false,
      },
    };
  }

  return {
    model,
    input: {
      prompt,
      img_url: imageUrl,
    },
    parameters: {
      duration,
      resolution,
      ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
      prompt_extend: false,
      audio: false,
    },
  };
}
