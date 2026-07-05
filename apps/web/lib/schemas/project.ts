import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  businessName: z.string().trim().min(2).max(80),
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
  videoLengthSec: z.coerce.number().int().min(15).max(60).default(30),
  style: z.enum(["REALISTIC", "THREE_D_ANIMATION"]).default("REALISTIC"),
});

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
