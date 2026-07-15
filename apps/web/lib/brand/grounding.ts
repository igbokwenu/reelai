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

export type GroundingRecoveryMethod =
  "PREFLIGHT_ADAPTATION" | "REGENERATED" | "SAFE_TEXT_FALLBACK";

export type GroundingRecoverySummary = {
  attempted: boolean;
  recovered: boolean;
  method: GroundingRecoveryMethod | null;
  initialViolations: string[];
  omittedCapabilities: string[];
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

export function buildGroundingInstructions(
  capabilities: GroundingCapabilities,
) {
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
      hasAffirmativeVisualRequest(
        text,
        /\b(phone|smartphone|mobile interface|app interface|dashboard|device screen|profile browsing|tap(?:ping)?|booking flow|find care button)\b/g,
      )
    ) {
      violations.push(
        `Concept ${index + 1} invents product UI or a device interaction.`,
      );
    }
    if (
      !capabilities.hasLogoReference &&
      hasAffirmativeVisualRequest(
        text,
        /\b(logo|wordmark|branded uniform|branded clothing|brand badge|verification badge|certification seal|accreditation seal|credential badge)\b/g,
      )
    ) {
      violations.push(
        `Concept ${index + 1} requests branding without a logo reference.`,
      );
    }
    if (
      !capabilities.hasProductReference &&
      hasAffirmativeVisualRequest(
        text,
        /\b(product close-up|product detail|product mockup|device mockup|branded object|branded packaging|product packaging)\b/g,
      )
    ) {
      violations.push(
        `Concept ${index + 1} invents a product visual without a product reference.`,
      );
    }
    const unsupportedClaim = findAffirmativeRequests(
      text,
      /\b(?:licensed|licenced|accredited|bonded|insured|government[- ]approved|state[- ]approved|background[- ]checked|police[- ]checked|dbs[- ]checked|medically certified|medical certification|hipaa(?: compliant)?|soc 2(?: compliant)?|iso 27001(?: certified)?|24\/7|guaranteed|free trial|free service|at no cost)\b/g,
    ).find(
      (claim) =>
        !capabilities.supportedClaimsText.includes(claim.toLowerCase()),
    );
    if (unsupportedClaim) {
      violations.push(
        `Concept ${index + 1} uses unsupported high-assurance or commercial claim “${unsupportedClaim}”.`,
      );
    }
  }
  return violations;
}

export function buildGroundingRecoveryInstructions(
  violations: string[],
  capabilities: GroundingCapabilities,
) {
  const adaptations = [
    "Preserve the concept's audience, emotional beat, pacing, and narrative purpose; change only execution details that require unavailable evidence.",
    "Treat the selected concept as creative intent, not permission to invent visual assets or claims.",
  ];

  if (!capabilities.hasLogoReference) {
    adaptations.push(
      "Replace logos, wordmarks, branded wardrobe, badges, or seals with unbranded wardrobe, material, environment, gesture, and composition. Reserve clean negative space for brand graphics to be composited later.",
    );
  }
  if (!capabilities.hasProductReference) {
    adaptations.push(
      "Replace product hero shots, packaging, and exact product depictions with source-safe human outcomes, process details, or environmental storytelling.",
    );
  }
  if (!capabilities.hasUiReference) {
    adaptations.push(
      "Replace phones, screens, interfaces, taps, profiles, and booking flows with real-world human decisions, service moments, or abstract non-UI motion.",
    );
  }
  adaptations.push(
    "Soften or remove any unsupported guarantee, credential, commercial offer, availability, testimonial, or quantified outcome.",
    `The previous plan was rejected for: ${violations.join(" ")}`,
    `All revised fields must comply with:\n- ${buildGroundingInstructions(capabilities)}`,
  );

  return adaptations.map((item) => `- ${item}`).join("\n");
}

export function recoverGroundedCreativeOutput<T>(
  value: T,
  capabilities: GroundingCapabilities,
): T {
  return mapStringValues(value, (text) =>
    recoverGroundingText(text, capabilities),
  );
}

export function omittedGroundingCapabilities(
  capabilities: GroundingCapabilities,
) {
  const omitted: string[] = [];
  if (!capabilities.hasLogoReference) omitted.push("logo reference");
  if (!capabilities.hasProductReference) omitted.push("product reference");
  if (!capabilities.hasUiReference) omitted.push("interface reference");
  return omitted;
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
    (value) =>
      !/\b(product|app|interface|screen|logo|packag|uniform|badge)\b/i.test(
        value,
      ),
  );
  return [
    ...new Set([...safe, "authentic human connection", "natural environment"]),
  ].slice(0, 8);
}

export function hardenImagePrompt(
  prompt: string,
  capabilities: GroundingCapabilities,
  visualStyle: "REALISTIC" | "THREE_D_ANIMATION" = "REALISTIC",
) {
  const style =
    visualStyle === "THREE_D_ANIMATION"
      ? "Premium physically based 3D product visualization with believable materials and studio lighting"
      : "Photorealistic premium commercial product/editorial photography";
  return `${prompt}\n\nGROUNDING CONSTRAINTS (mandatory):\n- ${buildGroundingInstructions(capabilities)}\n- ${style}, vertical 9:16. No split labels or typographic layout. Show only visually plausible details supported by the references and concept.`;
}

function hasAffirmativeVisualRequest(text: string, pattern: RegExp) {
  return findAffirmativeRequests(text, pattern).length > 0;
}

function findAffirmativeRequests(text: string, pattern: RegExp) {
  const affirmative: string[] = [];
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const before = text.slice(Math.max(0, index - 140), index);
    const after = text.slice(
      index + match[0].length,
      index + match[0].length + 100,
    );
    const clauseStart = Math.max(
      before.lastIndexOf("."),
      before.lastIndexOf("!"),
      before.lastIndexOf("?"),
      before.lastIndexOf(";"),
      before.lastIndexOf(", but "),
      before.lastIndexOf(" however "),
      before.lastIndexOf(" instead "),
    );
    const clause = before.slice(clauseStart + 1);
    const isNegated =
      /\b(?:no|without|avoid|omit|exclude|never|do not|don't|must not|should not|cannot|can't)\b[^.!?;]{0,100}$/.test(
        clause,
      );
    const isDeferredOverlay =
      /\b(?:reserve|reserved|space|placeholder|later|post[- ]production|composit)/.test(
        clause,
      ) && /\b(?:later|overlay|composit|post[- ]production)/.test(after);
    const isExplicitlyFree = /^[- ]free\b/.test(after);

    if (!isNegated && !isDeferredOverlay && !isExplicitlyFree) {
      affirmative.push(match[0]);
    }
  }

  return affirmative;
}

function mapStringValues<T>(value: T, transform: (text: string) => string): T {
  if (typeof value === "string") return transform(value) as T;
  if (Array.isArray(value)) {
    return value.map((item) => mapStringValues(item, transform)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        mapStringValues(item, transform),
      ]),
    ) as T;
  }
  return value;
}

function recoverGroundingText(
  value: string,
  capabilities: GroundingCapabilities,
) {
  let recovered = value;

  if (!capabilities.hasLogoReference) {
    recovered = recovered
      .replace(
        /\b(?:company |brand )?(?:logo|wordmark)\b/gi,
        "clean negative space for a later graphic overlay",
      )
      .replace(
        /\bbranded (?:uniform|clothing|wardrobe)\b/gi,
        "plain neutral wardrobe",
      )
      .replace(
        /\b(?:brand|verification|credential) badge\b|\b(?:certification|accreditation) seal\b/gi,
        "subtle unbranded visual detail",
      );
  }
  if (!capabilities.hasProductReference) {
    recovered = recovered.replace(
      /\b(?:product close-up|product detail|product mockup|device mockup|branded object|branded packaging|product packaging)\b/gi,
      "tactile environmental detail",
    );
  }
  if (!capabilities.hasUiReference) {
    recovered = recovered
      .replace(
        /\b(?:smartphone|phone|mobile interface|app interface|dashboard|device screen)\b/gi,
        "real-world human interaction",
      )
      .replace(/\bprofile browsing\b/gi, "considering suitable options")
      .replace(
        /\b(?:tap|tapping|booking flow|find care button)\b/gi,
        "natural decision moment",
      );
  }

  const claimReplacements: Record<string, string> = {
    licensed: "experienced",
    licenced: "experienced",
    accredited: "established",
    bonded: "established",
    insured: "established",
    "government-approved": "source-informed",
    "government approved": "source-informed",
    "state-approved": "source-informed",
    "state approved": "source-informed",
    "background-checked": "carefully considered",
    "background checked": "carefully considered",
    "police-checked": "carefully considered",
    "police checked": "carefully considered",
    "dbs-checked": "carefully considered",
    "dbs checked": "carefully considered",
    "medically certified": "professionally presented",
    "medical certification": "professional experience",
    "hipaa compliant": "privacy-conscious",
    hipaa: "privacy-conscious",
    "soc 2 compliant": "security-conscious",
    "soc 2": "security-conscious",
    "iso 27001 certified": "security-conscious",
    "iso 27001": "security-conscious",
    "24/7": "when available",
    guaranteed: "designed to help",
    "free trial": "introductory option",
    "free service": "introductory option",
    "at no cost": "with accessible options",
  };
  recovered = recovered.replace(
    /\b(?:licensed|licenced|accredited|bonded|insured|government[- ]approved|state[- ]approved|background[- ]checked|police[- ]checked|dbs[- ]checked|medically certified|medical certification|hipaa(?: compliant)?|soc 2(?: compliant)?|iso 27001(?: certified)?|24\/7|guaranteed|free trial|free service|at no cost)\b/gi,
    (claim) =>
      capabilities.supportedClaimsText.includes(claim.toLowerCase())
        ? claim
        : (claimReplacements[claim.toLowerCase()] ?? "source-safe wording"),
  );

  return recovered.replace(/\s{2,}/g, " ").trim();
}
