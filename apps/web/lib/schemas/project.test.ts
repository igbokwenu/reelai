import { describe, expect, it } from "vitest";

import { createProjectSchema, inferProjectIdentity } from "./project";

describe("URL-first project intake", () => {
  it("accepts a website without names and infers a usable identity", () => {
    const input = createProjectSchema.parse({ websiteUrl: "https://www.signal-loom.com" });
    expect(inferProjectIdentity(input)).toEqual({
      businessName: "Signal Loom",
      name: "Signal Loom reel",
    });
  });

  it("preserves advanced project creation without a website", () => {
    const input = createProjectSchema.parse({ name: "Launch", businessName: "Northstar" });
    expect(inferProjectIdentity(input)).toEqual({ businessName: "Northstar", name: "Launch" });
  });

  it("requires either a website or explicit names", () => {
    expect(createProjectSchema.safeParse({}).success).toBe(false);
  });
});
