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
    "Never invent certifications, verification badges, guarantees, staff credentials, service availability, pricing, testimonials, or quantified outcomes.",
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
      /\b(logo|wordmark|branded uniform|branded clothing|brand badge)\b/.test(text)
    ) {
      violations.push(`Concept ${index + 1} requests branding without a logo reference.`);
    }
    const unsupportedClaim = text.match(
      /\b(certified|verified|vetted|licensed|background[- ]checked|24\/7|guaranteed|free)\b/,
    )?.[0];
    if (
      unsupportedClaim &&
      !capabilities.supportedClaimsText.includes(unsupportedClaim)
    ) {
      violations.push(
        `Concept ${index + 1} uses unsupported claim “${unsupportedClaim}”.`,
      );
    }
  }
  return violations;
}

export function hardenImagePrompt(
  prompt: string,
  capabilities: GroundingCapabilities,
) {
  return `${prompt}\n\nGROUNDING CONSTRAINTS (mandatory):\n- ${buildGroundingInstructions(capabilities)}\n- Photorealistic 9:16 editorial frame. No split labels or typographic layout. Show only visually plausible, non-branded details supported by the concept.`;
}
