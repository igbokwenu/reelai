import { z } from "zod";

const projectProductSchema = z.object({
  name: z.string().trim().min(2).max(80),
  details: z
    .string()
    .trim()
    .max(600)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  websiteUrl: z
    .string()
    .trim()
    .url()
    .refine(
      (value) => /^https?:\/\//i.test(value),
      "Use an http:// or https:// product URL",
    )
    .optional()
    .or(z.literal("").transform(() => undefined)),
  imageCount: z.coerce.number().int().min(1).max(3),
});

export const createProjectSchema = z
  .object({
    name: z.string().trim().max(80).optional().or(z.literal("")),
    businessName: z.string().trim().max(80).optional().or(z.literal("")),
    websiteUrl: z
      .string()
      .trim()
      .url()
      .refine(
        (value) => /^https?:\/\//i.test(value),
        "Use an http:// or https:// website URL",
      )
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
    generateBrandKit: z
      .preprocess((value) => value === true || value === "true", z.boolean())
      .default(false),
    outputMode: z.enum(["STANDARD", "PRODUCT_SHOWCASE"]).default("STANDARD"),
    products: z.array(projectProductSchema).max(3).default([]),
    videoLengthSec: z.coerce.number().int().min(5).max(60).default(30),
    style: z.enum(["REALISTIC", "THREE_D_ANIMATION"]).default("REALISTIC"),
  })
  .superRefine((input, context) => {
    if (input.outputMode === "PRODUCT_SHOWCASE") {
      if (input.products.length < 1) {
        context.addIssue({
          code: "custom",
          message: "Add at least one product with a product image.",
          path: ["products"],
        });
      }
      if (
        input.products.reduce((sum, product) => sum + product.imageCount, 0) > 3
      ) {
        context.addIssue({
          code: "custom",
          message:
            "Product Showcase supports up to three product images total.",
          path: ["products"],
        });
      }
      if (input.videoLengthSec > 15) {
        context.addIssue({
          code: "custom",
          message: "Product Showcase videos must be 5 to 15 seconds.",
          path: ["videoLengthSec"],
        });
      }
    } else if (input.videoLengthSec < 15) {
      context.addIssue({
        code: "custom",
        message: "Standard reels must be 15 to 60 seconds.",
        path: ["videoLengthSec"],
      });
    }

    if (
      input.outputMode !== "PRODUCT_SHOWCASE" &&
      !input.websiteUrl &&
      ((input.name?.trim().length ?? 0) < 2 ||
        (input.businessName?.trim().length ?? 0) < 2)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Add a website URL, or provide both a project and business name.",
        path: ["websiteUrl"],
      });
    }
  });

export function inferProjectIdentity(
  input: z.infer<typeof createProjectSchema>,
) {
  const hostname = input.websiteUrl
    ? new URL(input.websiteUrl).hostname.replace(/^www\./, "")
    : "";
  const domainLabel = hostname.split(".")[0] ?? "";
  const inferredBusiness = domainLabel
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const businessName =
    input.businessName ||
    inferredBusiness ||
    input.products[0]?.name ||
    "Untitled brand";

  return {
    businessName,
    name:
      input.name ||
      `${businessName} ${input.outputMode === "PRODUCT_SHOWCASE" ? "showcase" : "reel"}`,
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

export const projectCreativeSettingsSchema = z.object({
  cinematicBoost: z.boolean(),
});

export const registerSourceSchema = z.object({
  type: sourceTypeSchema.default("WEBSITE"),
  url: z.string().trim().url(),
  label: z.string().trim().max(80).optional(),
  extractedText: z.string().trim().max(5000).optional(),
});

export function formDataToProjectInput(formData: FormData) {
  return Object.fromEntries(formData.entries());
}
