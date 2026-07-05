import "server-only";

import { qwenChatCompletion, QWEN_VISION_MODEL } from "@/lib/qwen/client";

export async function analyzeVisualAssetWithQwen({
  imageUrl,
  label,
}: {
  imageUrl: string;
  label: string;
}) {
  const result = await qwenChatCompletion({
    operation: "visual_asset_analysis",
    model: QWEN_VISION_MODEL,
    maxTokens: 600,
    messages: [
      {
        role: "system",
        content:
          "You analyze uploaded brand visuals for a video production studio. Describe only visible brand-relevant facts: colors, layout, typography feel, product cues, logo shape, and ad-safe visual motifs. Do not infer private facts.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this uploaded visual asset for Reel AI Brand Kit context. Label: ${label}`,
          },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  });

  return {
    summary: result.content,
    model: result.model,
    providerRequestId: result.providerRequestId,
    elapsedMs: result.elapsedMs,
    usage: result.usage,
  };
}
