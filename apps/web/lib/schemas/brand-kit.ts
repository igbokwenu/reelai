import { z } from "zod";

const stringWithDefault = (fallback: string) =>
  z.preprocess(
    (value) => (value === null ? undefined : value),
    z.string().default(fallback),
  );

const optionalString = z.preprocess(
  (value) => (value === null ? undefined : value),
  z.string().optional(),
);

const arrayWithDefault = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return undefined;
      }

      return Array.isArray(value) ? value : [value];
    },
    z.array(schema).default([]),
  );

export const brandKitValuePropSchema = z.object({
  label: z.string().min(2).max(80),
  detail: z.string().min(10).max(280),
});

export const brandKitPaletteColorSchema = z.object({
  name: z.string().min(2).max(60),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  usage: z.string().min(4).max(160),
});

export const brandKitClaimSchema = z.object({
  claim: z.string().min(4).max(220),
  support: z.string().min(4).max(260),
  confidence: z.enum(["high", "medium", "low"]),
});

export const brandKitPolicyRiskSchema = z.object({
  risk: z.string().min(4).max(220),
  severity: z.enum(["low", "medium", "high"]),
  mitigation: z.string().min(6).max(260),
});

export const brandKitCitationSchema = z.object({
  sourceId: z.string().min(1),
  label: z.string().min(2).max(120),
  note: z.string().min(4).max(260),
});

export const brandKitOutputSchema = z.object({
  summary: z.string().min(40).max(900),
  valueProps: z.array(brandKitValuePropSchema).min(2).max(6),
  audience: z.string().min(8).max(260).nullable(),
  tone: z.string().min(6).max(180),
  palette: z.array(brandKitPaletteColorSchema).min(2).max(6),
  visualMotifs: z.array(z.string().min(3).max(120)).min(2).max(8),
  claims: z.array(brandKitClaimSchema).min(1).max(8),
  policyRisks: z.array(brandKitPolicyRiskSchema).min(1).max(8),
  sourceCitations: z.array(brandKitCitationSchema).min(1).max(12),
  lockedStyle: z.string().min(20).max(500),
});

export type BrandKitOutput = z.infer<typeof brandKitOutputSchema>;

const looseValuePropSchema = z
  .object({
    label: optionalString,
    title: optionalString,
    detail: optionalString,
    description: optionalString,
  })
  .passthrough();
const looseClaimSchema = z
  .object({
    claim: optionalString,
    text: optionalString,
    support: optionalString,
    evidence: optionalString,
    source: optionalString,
    confidence: optionalString,
    risk: optionalString,
  })
  .passthrough();
const loosePolicyRiskSchema = z
  .object({
    risk: optionalString,
    issue: optionalString,
    category: optionalString,
    reason: optionalString,
    severity: optionalString,
    mitigation: optionalString,
    recommendation: optionalString,
  })
  .passthrough();
const looseCitationSchema = z
  .object({
    sourceId: optionalString,
    source_id: optionalString,
    id: optionalString,
    label: optionalString,
    title: optionalString,
    note: optionalString,
    detail: optionalString,
    url: optionalString,
  })
  .passthrough();

const flexibleBrandKitSchema = z
  .object({
    summary: stringWithDefault("Brand summary was not provided."),
    valueProps: arrayWithDefault(z.union([looseValuePropSchema, z.string()])),
    audience: z.preprocess(
      (value) => (value === null ? undefined : value),
      z.string().nullable().optional(),
    ),
    targetAudience: optionalString,
    tone: stringWithDefault("Clear, confident, and brand-safe."),
    palette: arrayWithDefault(
      z
        .object({
          name: optionalString,
          label: optionalString,
          hex: optionalString,
          usage: optionalString,
        })
        .passthrough(),
    ),
    visualMotifs: arrayWithDefault(z.string()),
    claims: arrayWithDefault(z.union([looseClaimSchema, z.string()])),
    policyRisks: arrayWithDefault(z.union([loosePolicyRiskSchema, z.string()])),
    sourceCitations: arrayWithDefault(z.union([looseCitationSchema, z.string()])),
    lockedStyle: stringWithDefault("Clean vertical ad style with restrained captions."),
  })
  .transform((input) => {
    const fallbackCitation = {
      sourceId: "project-intake",
      label: "Project intake",
      note: "Fallback citation for normalized Brand Kit fields.",
    };

    return {
      summary: textInRange(input.summary, {
        fallback: "Brand summary was not provided.",
        min: 40,
        max: 900,
      }),
      valueProps: ensureAtLeast(
        input.valueProps.map((item) =>
          typeof item === "string"
            ? {
                label: textInRange(item, {
                  fallback: "Value proposition",
                  min: 2,
                  max: 80,
                }),
                detail: textInRange(item, {
                  fallback: "Source-grounded brand value.",
                  min: 10,
                  max: 280,
                }),
              }
            : {
                label: textInRange(
                  item.label ??
                    item.title ??
                    item.detail ??
                    item.description ??
                    "Value proposition",
                  {
                    fallback: "Value proposition",
                    min: 2,
                    max: 80,
                  },
                ),
                detail: textInRange(
                  item.detail ??
                    item.description ??
                    item.label ??
                    item.title ??
                    "Source-grounded brand value.",
                  {
                    fallback: "Source-grounded brand value.",
                    min: 10,
                    max: 280,
                  },
                ),
              },
        ),
        [
          {
            label: "Clear offer",
            detail:
              "Use the project intake and source context to present the offer plainly.",
          },
          {
            label: "Brand-safe positioning",
            detail:
              "Keep claims conservative and grounded in supplied materials.",
          },
        ],
      ).slice(0, 6),
      audience: input.audience ?? input.targetAudience ?? null,
      tone: textInRange(input.tone, {
        fallback: "Clear, confident, and brand-safe.",
        min: 6,
        max: 180,
      }),
      palette: ensureAtLeast(
        input.palette.map((item) => {
          const hex =
            item.hex && /^#[0-9A-Fa-f]{6}$/.test(item.hex)
              ? item.hex
              : "#7C8A99";

          return {
            name: textInRange(item.name ?? item.label, {
              fallback: "Brand color",
              min: 2,
              max: 60,
            }),
            hex,
            usage: textInRange(item.usage ?? item.label, {
              fallback: "Brand accent",
              min: 4,
              max: 160,
            }),
          };
        }),
        [
          { name: "Studio Charcoal", hex: "#20262D", usage: "Primary text" },
          { name: "Soft Light", hex: "#F4F1EA", usage: "Background" },
        ],
      ).slice(0, 6),
      visualMotifs: ensureAtLeast(input.visualMotifs, [
        "clean product detail",
        "human workflow context",
      ])
        .map((item) =>
          textInRange(item, {
            fallback: "brand visual motif",
            min: 3,
            max: 120,
          }),
        )
        .slice(0, 8),
      claims: ensureAtLeast(
        input.claims.map((item) =>
          typeof item === "string"
            ? {
                claim: textInRange(item, {
                  fallback: "Source-grounded claim",
                  min: 4,
                  max: 220,
                }),
                support: "Model supplied this claim from source context.",
                confidence: "low" as const,
              }
            : {
                claim: textInRange(
                  item.claim ?? item.text ?? "Source-grounded claim",
                  {
                    fallback: "Source-grounded claim",
                    min: 4,
                    max: 220,
                  },
                ),
                support: textInRange(
                  item.support ??
                    item.evidence ??
                    item.source ??
                    "Model supplied this claim from source context.",
                  {
                    fallback: "Model supplied this claim from source context.",
                    min: 4,
                    max: 260,
                  },
                ),
                confidence: normalizeConfidence(item.confidence ?? item.risk),
              },
        ),
        [
          {
            claim: "Use only source-grounded claims in ad copy.",
            support: "No stronger claim was validated by the model output.",
            confidence: "low" as const,
          },
        ],
      ).slice(0, 8),
      policyRisks: ensureAtLeast(
        input.policyRisks.map((item) =>
          typeof item === "string"
            ? {
                risk: textInRange(item, {
                  fallback: "Ad policy risk",
                  min: 4,
                  max: 220,
                }),
                severity: "medium" as const,
                mitigation: "Keep copy conservative and source-grounded.",
              }
            : {
                risk: textInRange(
                  item.risk ??
                    item.issue ??
                    item.reason ??
                    item.category ??
                    "Ad policy risk",
                  {
                    fallback: "Ad policy risk",
                    min: 4,
                    max: 220,
                  },
                ),
                severity: normalizeSeverity(item.severity),
                mitigation: textInRange(
                  item.mitigation ??
                    item.recommendation ??
                    item.reason ??
                    "Keep copy conservative and source-grounded.",
                  {
                    fallback: "Keep copy conservative and source-grounded.",
                    min: 6,
                    max: 260,
                  },
                ),
              },
        ),
        [
          {
            risk: "Unsupported performance or health claims",
            severity: "medium" as const,
            mitigation:
              "Avoid guarantees unless a supplied source clearly supports them.",
          },
        ],
      ).slice(0, 8),
      sourceCitations: ensureAtLeast(
        input.sourceCitations.map((item) =>
          typeof item === "string"
            ? {
                sourceId: "project-intake",
                label: item.slice(0, 120),
                note: "Model supplied this citation as text.",
              }
            : {
                sourceId: textInRange(
                  item.sourceId ??
                    item.source_id ??
                    item.id ??
                    item.label ??
                    "project-intake",
                  {
                    fallback: "project-intake",
                    min: 1,
                    max: 120,
                  },
                ),
                label: textInRange(
                  item.label ?? item.title ?? "Project intake",
                  {
                    fallback: "Project intake",
                    min: 2,
                    max: 120,
                  },
                ),
                note: textInRange(
                  item.note ??
                    item.detail ??
                    item.url ??
                    "Model cited this source for Brand Kit context.",
                  {
                    fallback: "Model cited this source for Brand Kit context.",
                    min: 4,
                    max: 260,
                  },
                ),
              },
        ),
        [fallbackCitation],
      ).slice(0, 12),
      lockedStyle: textInRange(input.lockedStyle, {
        fallback: "Clean vertical ad style with restrained captions.",
        min: 20,
        max: 500,
      }),
    } satisfies BrandKitOutput;
  });

export function parseBrandKitOutput(value: unknown): BrandKitOutput {
  const canonical = canonicalizeBrandKitValue(value);
  const strict = brandKitOutputSchema.safeParse(canonical);

  if (strict.success) {
    return strict.data;
  }

  return brandKitOutputSchema.parse(flexibleBrandKitSchema.parse(canonical));
}

function canonicalizeBrandKitValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const nested =
    asRecord(record.brandKit) ??
    asRecord(record.brand_kit) ??
    asRecord(record.result) ??
    record;

  return {
    ...nested,
    summary:
      nested.summary ??
      nested.brandSummary ??
      nested.brand_summary ??
      nested.overview,
    audience:
      nested.audience ??
      nested.targetAudience ??
      nested.target_audience,
    valueProps:
      nested.valueProps ??
      nested.value_props ??
      nested.valuePropositions ??
      nested.value_propositions ??
      nested.keyMessages ??
      nested.key_messages,
    palette: nested.palette ?? nested.colors ?? nested.brand_colors,
    visualMotifs:
      nested.visualMotifs ??
      nested.visual_motifs ??
      nested.motifs ??
      nested.visualLanguage ??
      nested.visual_language,
    claims: nested.claims ?? nested.supported_claims,
    policyRisks:
      nested.policyRisks ??
      nested.policy_risks ??
      nested.risks ??
      nested.ad_policy_risks,
    sourceCitations:
      nested.sourceCitations ??
      nested.source_citations ??
      nested.citations ??
      nested.sources ??
      nested.references,
    lockedStyle:
      nested.lockedStyle ??
      nested.locked_style ??
      nested.lockedStyleLanguage ??
      nested.locked_style_language ??
      nested.styleGuide ??
      nested.style_guide,
  };
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function ensureAtLeast<T>(items: T[], fallback: T[]) {
  return items.length > 0 ? items : fallback;
}

function textInRange(
  value: unknown,
  {
    fallback,
    min,
    max,
  }: {
    fallback: string;
    min: number;
    max: number;
  },
) {
  const raw =
    typeof value === "string"
      ? value
      : value === null || value === undefined
        ? fallback
        : String(value);
  const trimmed = raw.replace(/\s+/g, " ").trim() || fallback;
  const padded =
    trimmed.length >= min
      ? trimmed
      : `${trimmed} ${fallback}`.replace(/\s+/g, " ").trim();

  return padded.slice(0, max);
}

function normalizeConfidence(value: string | undefined): "high" | "medium" | "low" {
  const normalized = value?.toLowerCase();

  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }

  if (normalized === "info") {
    return "high";
  }

  if (normalized === "warning") {
    return "medium";
  }

  if (normalized === "blocker") {
    return "low";
  }

  return "low";
}

function normalizeSeverity(value: string | undefined): "high" | "medium" | "low" {
  const normalized = value?.toLowerCase();

  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }

  if (normalized === "info") {
    return "low";
  }

  if (normalized === "warning") {
    return "medium";
  }

  if (normalized === "blocker") {
    return "high";
  }

  return "medium";
}
