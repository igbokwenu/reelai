import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().trim().max(80).optional().or(z.literal("")),
  businessName: z.string().trim().max(80).optional().or(z.literal("")),
  websiteUrl: z
    .string()
    .trim()
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  targetAudience: z
    .string()
    .trim()
    .max(180)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  offer: z
    .string()
    .trim()
    .max(220)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  brief: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  generateBrandKit: z.coerce.boolean().default(false),
  videoLengthSec: z.coerce.number().int().min(15).max(60).default(30),
  style: z.enum(["REALISTIC", "THREE_D_ANIMATION"]).default("REALISTIC"),
}).superRefine((input, context) => {
  if (!input.websiteUrl && (!input.name || !input.businessName)) {
    context.addIssue({
      code: "custom",
      message: "Add a website URL, or provide both a project and business name.",
      path: ["websiteUrl"],
    });
  }
});

export function inferProjectIdentity(input: z.infer<typeof createProjectSchema>) {
  const hostname = input.websiteUrl ? new URL(input.websiteUrl).hostname.replace(/^www\./, "") : "";
  const domainLabel = hostname.split(".")[0] ?? "";
  const inferredBusiness = domainLabel
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const businessName = input.businessName || inferredBusiness || "Untitled brand";

  return {
    businessName,
    name: input.name || `${businessName} reel`,
  };
}

export const sourceTypeSchema = z.enum([
  "UPLOAD",
  "LOGO",
  "PRODUCT_IMAGE",
  "DOCUMENT",
  "REFERENCE_AD",
  "WEBSITE",
]);

export const registerSourceSchema = z.object({
  type: sourceTypeSchema.default("WEBSITE"),
  url: z.string().trim().url(),
  label: z.string().trim().max(80).optional(),
  extractedText: z.string().trim().max(5000).optional(),
});

export function formDataToProjectInput(formData: FormData) {
  return Object.fromEntries(formData.entries());
}
