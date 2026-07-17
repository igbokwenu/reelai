import { describe, expect, it } from "vitest";

import {
  createProjectSchema,
  inferProjectIdentity,
  projectCreativeSettingsSchema,
} from "./project";

describe("URL-first project intake", () => {
  it("accepts a website without names and infers a usable identity", () => {
    const input = createProjectSchema.parse({
      websiteUrl: "https://www.signal-loom.com",
    });
    expect(inferProjectIdentity(input)).toEqual({
      businessName: "Signal Loom",
      name: "Signal Loom reel",
    });
  });

  it("preserves advanced project creation without a website", () => {
    const input = createProjectSchema.parse({
      name: "Launch",
      businessName: "Northstar",
    });
    expect(inferProjectIdentity(input)).toEqual({
      businessName: "Northstar",
      name: "Launch",
    });
  });

  it("requires either a website or explicit names", () => {
    expect(createProjectSchema.safeParse({}).success).toBe(false);
  });

  it("does not coerce the string false into automatic generation", () => {
    const input = createProjectSchema.parse({
      websiteUrl: "https://example.com",
      generateBrandKit: "false",
    });
    expect(input.generateBrandKit).toBe(false);
  });

  it("accepts a grounded 5 to 15 second product showcase", () => {
    const input = createProjectSchema.parse({
      name: "Summer drop",
      businessName: "Northstar",
      outputMode: "PRODUCT_SHOWCASE",
      videoLengthSec: 10,
      products: [
        {
          name: "Field jacket",
          details: "Olive waxed cotton with brass hardware",
          imageCount: 1,
        },
      ],
    });

    expect(input.outputMode).toBe("PRODUCT_SHOWCASE");
    expect(input.products).toHaveLength(1);
  });

  it("can start an upload-first showcase without a website", () => {
    const input = createProjectSchema.parse({
      outputMode: "PRODUCT_SHOWCASE",
      videoLengthSec: 5,
      products: [{ name: "Studio Lamp", imageCount: 1 }],
    });

    expect(inferProjectIdentity(input)).toEqual({
      businessName: "Studio Lamp",
      name: "Studio Lamp showcase",
    });
  });

  it("requires exactly one product with exactly one image", () => {
    const base = {
      name: "Collection",
      businessName: "Northstar",
      outputMode: "PRODUCT_SHOWCASE",
      videoLengthSec: 15,
    } as const;

    expect(
      createProjectSchema.safeParse({
        ...base,
        products: [{ name: "Jacket", imageCount: 0 }],
      }).success,
    ).toBe(false);
    expect(
      createProjectSchema.safeParse({
        ...base,
        products: [
          { name: "Jacket", imageCount: 1 },
          { name: "Boots", imageCount: 1 },
        ],
      }).success,
    ).toBe(false);
    expect(
      createProjectSchema.safeParse({
        ...base,
        products: [{ name: "Jacket", imageCount: 2 }],
      }).success,
    ).toBe(false);
  });

  it("allows only one distinct URL source at intake", () => {
    expect(
      createProjectSchema.safeParse({
        name: "Launch",
        businessName: "Northstar",
        websiteUrl: "https://northstar.example",
        outputMode: "PRODUCT_SHOWCASE",
        videoLengthSec: 10,
        products: [
          {
            name: "Jacket",
            imageCount: 1,
            websiteUrl: "https://shop.example/jacket",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("keeps standard reels on the existing 15 to 60 second contract", () => {
    expect(
      createProjectSchema.safeParse({
        websiteUrl: "https://example.com",
        outputMode: "STANDARD",
        videoLengthSec: 5,
      }).success,
    ).toBe(false);
  });

  it("accepts only an explicit persisted Cinematic Boost preference", () => {
    expect(
      projectCreativeSettingsSchema.parse({ cinematicBoost: true }),
    ).toEqual({ cinematicBoost: true });
    expect(
      projectCreativeSettingsSchema.safeParse({ cinematicBoost: "true" })
        .success,
    ).toBe(false);
  });
});
