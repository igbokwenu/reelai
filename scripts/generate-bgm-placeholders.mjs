import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const outputDirectory = path.resolve("apps/web/public/audio/bgm");
const sampleRate = 24_000;
const durationSec = 8;

const tracks = [
  { file: "warm-uplift.mp3", root: 196, pulse: 2 },
  { file: "clean-momentum.mp3", root: 220, pulse: 4 },
  { file: "bold-kinetic.mp3", root: 110, pulse: 8 },
  { file: "cinematic-wonder.mp3", root: 146.83, pulse: 1 },
  { file: "calm-organic.mp3", root: 174.61, pulse: 0.5 },
];

await mkdir(outputDirectory, { recursive: true });

for (const track of tracks) {
  const samples = sampleRate * durationSec;
  const data = Buffer.alloc(samples * 2);

  for (let index = 0; index < samples; index += 1) {
    const time = index / sampleRate;
    const phrase = time % 4;
    const edgeFade = Math.min(1, time / 0.15, (durationSec - time) / 0.15);
    const pulse = 0.72 + Math.sin(Math.PI * 2 * track.pulse * time) * 0.08;
    const tone =
      Math.sin(Math.PI * 2 * track.root * time) * 0.11 +
      Math.sin(Math.PI * 2 * track.root * 1.5 * time) * 0.05 +
      Math.sin(Math.PI * 2 * track.root * 2 * time) * 0.025 +
      Math.sin(Math.PI * 2 * track.root * 0.5 * time) *
        (phrase < 2 ? 0.035 : 0.02);
    const sample = Math.max(-1, Math.min(1, tone * pulse * edgeFade));
    data.writeInt16LE(Math.trunc(sample * 0x7fff), index * 2);
  }

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

  const temporaryWav = path.join(
    outputDirectory,
    `.${track.file.replace(/\.mp3$/, "")}.source.wav`,
  );
  const outputMp3 = path.join(outputDirectory, track.file);

  await writeFile(temporaryWav, wav);
  try {
    await run("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      temporaryWav,
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "96k",
      "-ar",
      "44100",
      "-ac",
      "2",
      outputMp3,
    ]);
  } finally {
    await rm(temporaryWav, { force: true });
  }

  await rm(outputMp3.replace(/\.mp3$/, ".wav"), { force: true });
}
