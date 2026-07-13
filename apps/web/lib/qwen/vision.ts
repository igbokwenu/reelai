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

export async function reviewGeneratedPreviewGrounding({
  imageUrl,
  restrictions,
}: {
  imageUrl: string;
  restrictions: string;
}) {
  const result = await qwenChatCompletion({
    operation: "concept_preview_grounding_review",
    model: QWEN_VISION_MODEL,
    maxTokens: 300,
    messages: [
      {
        role: "system",
        content:
          "You are a strict visual grounding reviewer. Return a first line of exactly VERDICT: PASS or VERDICT: FAIL, then briefly list visible violations. Apply the supplied restrictions literally. Fail when the image visibly contains an element those restrictions prohibit; do not fail an allowed referenced element.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: `Review this generated concept preview. Restrictions:\n${restrictions}` },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
  });
  return {
    passed: /^VERDICT:\s*PASS\b/i.test(result.content.trim()),
    summary: result.content,
  };
}
