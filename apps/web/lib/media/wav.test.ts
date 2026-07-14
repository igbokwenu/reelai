import { describe, expect, it } from "vitest";

import { buildWavWaveform, concatenateWav, parseWav } from "./wav";

describe("WAV timing", () => {
  it("measures PCM duration from the audio bytes", () => {
    expect(parseWav(makeWav(24_000, 1)).durationSec).toBe(1);
  });

  it("concatenates compatible clips with one valid header", () => {
    const combined = concatenateWav([
      makeWav(24_000, 0.5),
      makeWav(24_000, 0.75),
    ]);

    expect(parseWav(combined).durationSec).toBe(1.25);
    expect(combined.toString("ascii", 0, 4)).toBe("RIFF");
  });

  it("builds preview bars from the actual PCM samples", () => {
    const waveform = buildWavWaveform(makeWav(24_000, 1), 12);

    expect(waveform).toHaveLength(12);
    expect(waveform.every((value) => value === 0.04)).toBe(true);
  });
});

function makeWav(sampleRate: number, durationSec: number) {
  const data = Buffer.alloc(Math.round(sampleRate * durationSec) * 2);
  const wav = Buffer.alloc(44 + data.length);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + data.length, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(data.length, 40);
  data.copy(wav, 44);
  return wav;
}
