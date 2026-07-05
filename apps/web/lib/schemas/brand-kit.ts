import { z } from "zod";

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
    label: z.string().optional(),
    detail: z.string().optional(),
  })
  .passthrough();
const looseClaimSchema = z
  .object({
    claim: z.string().optional(),
    support: z.string().optional(),
    confidence: z.string().optional(),
  })
  .passthrough();
const loosePolicyRiskSchema = z
  .object({
    risk: z.string().optional(),
    severity: z.string().optional(),
    mitigation: z.string().optional(),
  })
  .passthrough();
const looseCitationSchema = z
  .object({
    sourceId: z.string().optional(),
    source_id: z.string().optional(),
    label: z.string().optional(),
    note: z.string().optional(),
  })
  .passthrough();

const flexibleBrandKitSchema = z
  .object({
    summary: z.string().default("Brand summary was not provided."),
    valueProps: z.array(z.union([looseValuePropSchema, z.string()])).default([]),
    audience: z.string().nullable().optional(),
    tone: z.string().default("Clear, confident, and brand-safe."),
    palette: z
      .array(
        z.object({
          name: z.string().default("Brand color"),
          hex: z.string().optional(),
          usage: z.string().default("Brand accent"),
        }),
      )
      .default([]),
    visualMotifs: z.array(z.string()).default([]),
    claims: z.array(z.union([looseClaimSchema, z.string()])).default([]),
    policyRisks: z
      .array(z.union([loosePolicyRiskSchema, z.string()]))
      .default([]),
    sourceCitations: z
      .array(z.union([looseCitationSchema, z.string()]))
      .default([]),
    lockedStyle: z.string().default("Clean vertical ad style with restrained captions."),
  })
  .transform((input) => {
    const fallbackCitation = {
      sourceId: "project-intake",
      label: "Project intake",
      note: "Fallback citation for normalized Brand Kit fields.",
    };

    return {
      summary: ensureMinLength(input.summary, 40),
      valueProps: ensureAtLeast(
        input.valueProps.map((item) =>
          typeof item === "string"
            ? {
                label: ensureMinLength(item.slice(0, 80), 2),
                detail: ensureMinLength(item, 10),
              }
            : {
                label: ensureMinLength(
                  item.label ?? item.detail ?? "Value proposition",
                  2,
                ).slice(0, 80),
                detail: ensureMinLength(
                  item.detail ?? item.label ?? "Source-grounded brand value.",
                  10,
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
      audience: input.audience ?? null,
      tone: ensureMinLength(input.tone, 6),
      palette: ensureAtLeast(
        input.palette.map((item) => {
          const hex =
            item.hex && /^#[0-9A-Fa-f]{6}$/.test(item.hex)
              ? item.hex
              : "#7C8A99";

          return {
            name: ensureMinLength(item.name, 2),
            hex,
            usage: ensureMinLength(item.usage, 4),
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
      ]).slice(0, 8),
      claims: ensureAtLeast(
        input.claims.map((item) =>
          typeof item === "string"
            ? {
                claim: item,
                support: "Model supplied this claim from source context.",
                confidence: "low" as const,
              }
            : {
                claim: ensureMinLength(item.claim ?? "Source-grounded claim", 4),
                support: ensureMinLength(
                  item.support ?? "Model supplied this claim from source context.",
                  4,
                ),
                confidence: normalizeConfidence(item.confidence),
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
                risk: item,
                severity: "medium" as const,
                mitigation: "Keep copy conservative and source-grounded.",
              }
            : {
                risk: ensureMinLength(item.risk ?? "Ad policy risk", 4),
                severity: normalizeSeverity(item.severity),
                mitigation: ensureMinLength(
                  item.mitigation ?? "Keep copy conservative and source-grounded.",
                  6,
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
                sourceId: ensureMinLength(
                  item.sourceId ?? item.source_id ?? "project-intake",
                  1,
                ),
                label: ensureMinLength(item.label ?? "Project intake", 2).slice(
                  0,
                  120,
                ),
                note: ensureMinLength(
                  item.note ?? "Model cited this source for Brand Kit context.",
                  4,
                ),
              },
        ),
        [fallbackCitation],
      ).slice(0, 12),
      lockedStyle: ensureMinLength(input.lockedStyle, 20),
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
    valueProps:
      nested.valueProps ??
      nested.value_props ??
      nested.valuePropositions ??
      nested.value_propositions,
    visualMotifs: nested.visualMotifs ?? nested.visual_motifs,
    policyRisks: nested.policyRisks ?? nested.policy_risks,
    sourceCitations:
      nested.sourceCitations ?? nested.source_citations ?? nested.citations,
    lockedStyle: nested.lockedStyle ?? nested.locked_style ?? nested.styleGuide,
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

function ensureMinLength(value: string, minLength: number) {
  if (value.trim().length >= minLength) {
    return value.trim();
  }

  return `${value.trim()} ${".".repeat(minLength)}`.slice(0, minLength);
}

function normalizeConfidence(value: string | undefined): "high" | "medium" | "low" {
  const normalized = value?.toLowerCase();

  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }

  return "low";
}

function normalizeSeverity(value: string | undefined): "high" | "medium" | "low" {
  const normalized = value?.toLowerCase();

  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }

  return "medium";
}
