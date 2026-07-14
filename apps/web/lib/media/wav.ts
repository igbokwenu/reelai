export type ParsedWav = {
  audioFormat: number;
  channels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
  data: Buffer;
  durationSec: number;
};

export function parseWav(buffer: Buffer): ParsedWav {
  if (
    buffer.length < 44 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new Error(
      "TTS returned non-WAV audio; scene timing cannot be measured safely.",
    );
  }

  let offset = 12;
  let format: Omit<ParsedWav, "data" | "durationSec"> | undefined;
  let data: Buffer | undefined;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkSize;

    if (chunkEnd > buffer.length) {
      // Qwen's streaming WAV output uses a large placeholder size in the RIFF
      // and data headers because the final length is not known when synthesis
      // begins. Once downloaded, the end of the file is the authoritative end
      // of the data chunk.
      if (chunkId === "data" && chunkStart < buffer.length) {
        data = buffer.subarray(chunkStart);
        break;
      }

      throw new Error("TTS WAV contains an invalid chunk length.");
    }

    if (chunkId === "fmt " && chunkSize >= 16) {
      format = {
        audioFormat: buffer.readUInt16LE(chunkStart),
        channels: buffer.readUInt16LE(chunkStart + 2),
        sampleRate: buffer.readUInt32LE(chunkStart + 4),
        byteRate: buffer.readUInt32LE(chunkStart + 8),
        blockAlign: buffer.readUInt16LE(chunkStart + 12),
        bitsPerSample: buffer.readUInt16LE(chunkStart + 14),
      };
    } else if (chunkId === "data") {
      data = buffer.subarray(chunkStart, chunkEnd);
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  if (!format || !data || format.byteRate <= 0) {
    throw new Error("TTS WAV is missing readable format or audio data.");
  }

  return {
    ...format,
    data,
    durationSec: data.length / format.byteRate,
  };
}

export function concatenateWav(buffers: Buffer[]) {
  if (buffers.length === 0) {
    throw new Error("At least one WAV buffer is required.");
  }

  const parsed = buffers.map(parseWav);
  const first = parsed[0];
  const compatible = parsed.every(
    (item) =>
      item.audioFormat === first.audioFormat &&
      item.channels === first.channels &&
      item.sampleRate === first.sampleRate &&
      item.byteRate === first.byteRate &&
      item.blockAlign === first.blockAlign &&
      item.bitsPerSample === first.bitsPerSample,
  );

  if (!compatible) {
    throw new Error("TTS WAV chunks use incompatible audio formats.");
  }

  const data = Buffer.concat(parsed.map((item) => item.data));
  const out = Buffer.alloc(44 + data.length);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + data.length, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(first.audioFormat, 20);
  out.writeUInt16LE(first.channels, 22);
  out.writeUInt32LE(first.sampleRate, 24);
  out.writeUInt32LE(first.byteRate, 28);
  out.writeUInt16LE(first.blockAlign, 32);
  out.writeUInt16LE(first.bitsPerSample, 34);
  out.write("data", 36);
  out.writeUInt32LE(data.length, 40);
  data.copy(out, 44);
  return out;
}

export function buildWavWaveform(buffer: Buffer, barCount = 48) {
  const wav = parseWav(buffer);
  if (wav.audioFormat !== 1 || wav.bitsPerSample !== 16 || barCount <= 0) {
    return [];
  }

  const sampleCount = Math.floor(wav.data.length / 2);
  return Array.from({ length: barCount }, (_, barIndex) => {
    const start = Math.floor((barIndex * sampleCount) / barCount);
    const end = Math.max(
      start + 1,
      Math.floor(((barIndex + 1) * sampleCount) / barCount),
    );
    let energy = 0;

    for (let index = start; index < end && index < sampleCount; index += 1) {
      const normalized = wav.data.readInt16LE(index * 2) / 0x8000;
      energy += normalized * normalized;
    }

    const rms = Math.sqrt(energy / Math.max(1, end - start));
    return Number(Math.min(1, Math.max(0.04, rms * 2.4)).toFixed(3));
  });
}
