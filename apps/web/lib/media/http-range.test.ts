import { describe, expect, it } from "vitest";

import { parseByteRange } from "./http-range";

describe("parseByteRange", () => {
  it("parses the bounded ranges used by streaming video", () => {
    expect(parseByteRange("bytes=1024-2047", 10_000)).toEqual({
      start: 1024,
      end: 2047,
    });
  });

  it("clamps open-ended ranges to the object size", () => {
    expect(parseByteRange("bytes=9000-", 10_000)).toEqual({
      start: 9000,
      end: 9999,
    });
  });

  it("supports suffix ranges", () => {
    expect(parseByteRange("bytes=-500", 10_000)).toEqual({
      start: 9500,
      end: 9999,
    });
  });
});
