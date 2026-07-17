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
          "You analyze uploaded brand visuals for a video production studio. Describe only visible brand-relevant facts: colors, layout, typography feel, product cues, logo shape, and ad-safe visual motifs. When the asset is a logo, begin with DOMINANT_LOGO_COLOR: #RRGGBB using your closest visible color estimate for the dominant non-background logo color. Do not infer private facts.",
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
  referenceImageUrls = [],
}: {
  imageUrl: string;
  restrictions: string;
  referenceImageUrls?: string[];
}) {
  const result = await qwenChatCompletion({
    operation: "concept_preview_grounding_review",
    model: QWEN_VISION_MODEL,
    maxTokens: 300,
    messages: [
      {
        role: "system",
        content:
          "You are a strict visual grounding reviewer. The first image is the generated opening frame; any later images are approved product or brand references. Return a first line of exactly VERDICT: PASS or VERDICT: FAIL, then briefly list visible violations. Apply the supplied restrictions literally. When product references are supplied, fail if the generated product is generic, substituted, materially reshaped, recolored, relabeled, or otherwise loses its visible identity. Do not fail normal changes in camera angle, lighting, or environment that preserve the referenced product.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Review this generated concept preview. Restrictions:\n${restrictions}`,
          },
          { type: "image_url", image_url: { url: imageUrl } },
          ...referenceImageUrls.slice(0, 3).map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
        ],
      },
    ],
  });
  return {
    passed: /^VERDICT:\s*PASS\b/i.test(result.content.trim()),
    summary: result.content,
  };
}
