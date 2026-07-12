import { describe, expect, it } from "vitest";

import { qwenEndpoint } from "./endpoints";

describe("qwenEndpoint", () => {
  it("uses defaults when optional endpoint env vars are blank", () => {
    expect(qwenEndpoint("", "https://dashscope-intl.aliyuncs.com/api/v1")).toBe(
      "https://dashscope-intl.aliyuncs.com/api/v1",
    );
  });

  it("trims configured endpoint overrides and removes trailing slashes", () => {
    expect(qwenEndpoint(" https://example.test/api/v1/// ", "fallback")).toBe(
      "https://example.test/api/v1",
    );
  });
});
