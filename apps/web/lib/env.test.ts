import { describe, expect, it } from "vitest";

import { getEnv } from "./env";

describe("getEnv", () => {
  it("parses the public Phase 1 environment contract", () => {
    expect(
      getEnv({
        DASHSCOPE_API_KEY: "placeholder",
        QWEN_BASE_URL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        DATABASE_URL: "postgresql://user:password@localhost:5432/reelai",
        OSS_REGION: "oss-region",
        OSS_BUCKET: "bucket",
        OSS_ACCESS_KEY_ID: "access-key",
        OSS_ACCESS_KEY_SECRET: "access-secret",
        PUBLIC_APP_URL: "http://localhost:3000",
      }).QWEN_BASE_URL,
    ).toBe("https://dashscope-intl.aliyuncs.com/compatible-mode/v1");
  });
});
