type SourceLike = {
  type: string;
  artifactId?: string | null;
  metadata?: unknown;
};

type BrandKitLike = {
  claims: unknown;
};

export type GroundingCapabilities = {
  hasUploadedVisuals: boolean;
  hasLogoReference: boolean;
  hasProductReference: boolean;
  hasUiReference: boolean;
  supportedClaimsText: string;
};

export function getGroundingCapabilities(
  sources: SourceLike[],
  brandKit: BrandKitLike,
): GroundingCapabilities {
  const visualSources = sources.filter((source) => Boolean(source.artifactId));
  const metadataText = visualSources
    .map((source) => JSON.stringify(source.metadata ?? {}))
    .join(" ")
    .toLowerCase();

  return {
    hasUploadedVisuals: visualSources.length > 0,
    hasLogoReference: visualSources.some((source) => source.type === "LOGO"),
    hasProductReference: visualSources.some(
      (source) => source.type === "PRODUCT_IMAGE",
    ),
    hasUiReference:
      visualSources.some((source) => source.type === "REFERENCE_AD") ||
      /\b(ui|interface|screenshot|screen|app[-_ ]?store)\b/.test(metadataText),
    supportedClaimsText: JSON.stringify(brandKit.claims ?? []).toLowerCase(),
  };
}

export function buildGroundingInstructions(capabilities: GroundingCapabilities) {
  const rules = [
    "Plain-language trust descriptors such as vetted, verified, or certified are allowed in concept copy, but must not be turned into seals, badges, accreditations, or government endorsement.",
    "Never invent regulated or high-assurance claims such as licensed/licenced, accredited, bonded, insured, government-approved, background-checked, police-checked, medical credentials, or compliance certifications. Guarantees, specific availability, pricing, testimonials, and quantified outcomes also require source support.",
    "Generated preview images must contain no readable text; captions and brand copy are added later in controlled production.",
  ];
  if (!capabilities.hasUiReference) {
    rules.push(
      "No product UI reference was uploaded: do not show phones, device screens, apps, dashboards, interfaces, profiles, buttons, booking flows, or screen interactions.",
    );
  }
  if (!capabilities.hasLogoReference) {
    rules.push(
      "No logo reference was uploaded: do not render a logo, wordmark, branded uniform, branded badge, or brand name inside the image.",
    );
  }
  if (!capabilities.hasProductReference) {
    rules.push(
      "No product reference was uploaded: use generic unbranded human or environmental storytelling, never a manufactured product representation.",
    );
  }
  return rules.join("\n- ");
}

export function findConceptGroundingViolations(
  concepts: object[],
  capabilities: GroundingCapabilities,
) {
  const violations: string[] = [];
  for (const [index, concept] of concepts.entries()) {
    const text = JSON.stringify(concept).toLowerCase();
    if (
      !capabilities.hasUiReference &&
      /\b(phone|smartphone|mobile interface|app interface|dashboard|device screen|profile browsing|tap(?:ping)?|booking flow|find care button)\b/.test(text)
    ) {
      violations.push(`Concept ${index + 1} invents product UI or a device interaction.`);
    }
    if (
      !capabilities.hasLogoReference &&
      /\b(logo|wordmark|branded uniform|branded clothing|brand badge|verification badge|certification seal|accreditation seal|credential badge)\b/.test(text)
    ) {
      violations.push(`Concept ${index + 1} requests branding without a logo reference.`);
    }
    if (
      !capabilities.hasProductReference &&
      /\b(product close-up|product detail|product mockup|device mockup|branded object|branded packaging|product packaging)\b/.test(text)
    ) {
      violations.push(`Concept ${index + 1} invents a product visual without a product reference.`);
    }
    const unsupportedClaim = text.match(
      /\b(?:licensed|licenced|accredited|bonded|insured|government[- ]approved|state[- ]approved|background[- ]checked|police[- ]checked|dbs[- ]checked|medically certified|medical certification|hipaa(?: compliant)?|soc 2(?: compliant)?|iso 27001(?: certified)?|24\/7|guaranteed|free trial|free service|at no cost)\b/,
    )?.[0];
    if (
      unsupportedClaim &&
      !capabilities.supportedClaimsText.includes(unsupportedClaim)
    ) {
      violations.push(
        `Concept ${index + 1} uses unsupported high-assurance or commercial claim “${unsupportedClaim}”.`,
      );
    }
  }
  return violations;
}

export function safeVisualMotifs(
  motifs: unknown,
  capabilities: GroundingCapabilities,
) {
  const values = Array.isArray(motifs)
    ? motifs.filter((value): value is string => typeof value === "string")
    : [];
  if (capabilities.hasProductReference) return values;
  const safe = values.filter(
    (value) => !/\b(product|app|interface|screen|logo|packag|uniform|badge)\b/i.test(value),
  );
  return [...new Set([...safe, "authentic human connection", "natural environment"])].slice(0, 8);
}

export function hardenImagePrompt(
  prompt: string,
  capabilities: GroundingCapabilities,
) {
  return `${prompt}\n\nGROUNDING CONSTRAINTS (mandatory):\n- ${buildGroundingInstructions(capabilities)}\n- Photorealistic 9:16 editorial frame. No split labels or typographic layout. Show only visually plausible, non-branded details supported by the concept.`;
}
