import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BGM_TRACKS, selectBgmTrack } from "./catalog";

describe("curated BGM catalog", () => {
  it("keeps every public asset path and id unique", () => {
    expect(new Set(BGM_TRACKS.map((track) => track.id)).size).toBe(
      BGM_TRACKS.length,
    );
    expect(new Set(BGM_TRACKS.map((track) => track.assetPath)).size).toBe(
      BGM_TRACKS.length,
    );
  });

  it("ships a valid MP3 placeholder for every catalog entry", async () => {
    for (const track of BGM_TRACKS) {
      const bytes = await readFile(
        path.join(process.cwd(), "public", track.assetPath),
      );
      const hasId3Tag = bytes.subarray(0, 3).toString("ascii") === "ID3";
      const hasMpegFrameSync = bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0;
      expect(hasId3Tag || hasMpegFrameSync).toBe(true);
      expect(bytes.length).toBeGreaterThan(1_000);
    }
  });

  it.each([
    ["A precise SaaS workflow with a modern interface", "clean-momentum"],
    ["A punchy sports launch with bold kinetic edits", "bold-kinetic"],
    ["An elegant luxury property reveal", "cinematic-wonder"],
    ["A serene organic skincare ritual", "calm-organic"],
    ["An optimistic community success story", "warm-uplift"],
  ])("matches %s to %s", (creativeText, expected) => {
    expect(selectBgmTrack({ creativeText }).id).toBe(expected);
  });

  it("honors an explicit AI or manual selection before keyword matching", () => {
    expect(
      selectBgmTrack({
        preferredTrackId: "cinematic-wonder",
        creativeText: "bold sports launch",
      }).id,
    ).toBe("cinematic-wonder");
  });

  it("uses the broad warm bed as a safe legacy fallback", () => {
    expect(selectBgmTrack({ creativeText: "" }).id).toBe("warm-uplift");
  });
});
