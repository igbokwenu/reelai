export function buildVideoSubmissionBody({
  model,
  prompt,
  imageUrl,
  lastFrameUrl,
  durationSec,
}: {
  model: string;
  prompt: string;
  imageUrl: string;
  lastFrameUrl?: string;
  durationSec: number;
}) {
  const duration = Math.max(2, Math.min(15, durationSec));

  if (model.startsWith("wan2.7")) {
    return {
      model,
      input: {
        prompt,
        media: [
          { type: "first_frame", url: imageUrl },
          ...(lastFrameUrl ? [{ type: "last_frame", url: lastFrameUrl }] : []),
        ],
      },
      parameters: {
        duration,
        resolution: "720P",
        // Preserve the approved endpoint composition and motion brief.
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
      resolution: "720P",
      prompt_extend: true,
      audio: false,
    },
  };
}
