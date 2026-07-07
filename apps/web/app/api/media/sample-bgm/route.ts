export async function GET() {
  const sampleRate = 24000;
  const durationSec = 30;
  const samples = sampleRate * durationSec;
  const data = Buffer.alloc(samples * 2);

  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const tone =
      Math.sin(2 * Math.PI * 110 * t) * 0.18 +
      Math.sin(2 * Math.PI * 165 * t) * 0.08;
    data.writeInt16LE(Math.max(-1, Math.min(1, tone)) * 0x7fff, i * 2);
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

  return new Response(wav, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "audio/wav",
    },
  });
}
