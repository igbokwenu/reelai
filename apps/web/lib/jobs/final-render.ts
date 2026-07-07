import "server-only";

import type { Artifact, Prisma, Scene, Storyboard, Take } from "@prisma/client";

import { createStoredArtifact, createArtifactFromUrl } from "@/lib/media/artifacts";
import { prisma } from "@/lib/prisma";
import {
  QWEN_TTS_MAX_CHARS,
  QWEN_TTS_MODEL,
  chunkTtsText,
  sanitizeTtsFailure,
  synthesizeSpeechWithQwen,
} from "@/lib/qwen/tts";
import { renderReel } from "@/remotion/render";
import type { ReelCompositionInput } from "@/remotion/schema";

type SceneWithTakes = Scene & { takes: Take[] };
type StoryboardWithScenes = Storyboard & { scenes: SceneWithTakes[] };

export async function createAndRunNarrationJob(projectId: string) {
  const storyboard = await getRenderableStoryboard(projectId, {
    requireVideos: false,
  });
  const chunks = chunkTtsText(
    storyboard.scenes.map((scene) => scene.voiceoverText).join("\n\n"),
  );

  if (chunks.length === 0) {
    throw new Error("Storyboard has no narration text to synthesize.");
  }

  const job = await prisma.generationJob.create({
    data: {
      projectId,
      type: "TTS",
      status: "QUEUED",
      model: QWEN_TTS_MODEL,
      input: {
        operation: "narration_tts",
        chunkCount: chunks.length,
        maxChars: QWEN_TTS_MAX_CHARS,
        sceneIds: storyboard.scenes.map((scene) => scene.id),
      },
    },
  });

  return runNarrationJob(job.id, chunks);
}

export async function createAndRunFinalRenderJob({
  projectId,
  aiDisclosureEnabled = true,
  bgmEnabled = false,
}: {
  projectId: string;
  aiDisclosureEnabled?: boolean;
  bgmEnabled?: boolean;
}) {
  const storyboard = await getRenderableStoryboard(projectId, {
    requireVideos: true,
  });
  const narration = await getLatestNarrationArtifact(projectId);
  const input = await buildReelCompositionInput({
    projectId,
    storyboard,
    narration,
    aiDisclosureEnabled,
    bgmEnabled,
  });
  const render = await prisma.render.create({
    data: {
      projectId,
      status: "QUEUED",
      format: "9:16",
      settings: {
        aiDisclosureEnabled,
        bgmEnabled,
        safeZonePreset: input.safeZonePreset,
        narrationArtifactId: narration?.id ?? null,
      },
    },
  });
  const job = await prisma.generationJob.create({
    data: {
      projectId,
      type: "RENDER",
      status: "QUEUED",
      model: "remotion",
      input: {
        operation: "final_render",
        renderId: render.id,
        sceneIds: storyboard.scenes.map((scene) => scene.id),
        aiDisclosureEnabled,
        bgmEnabled,
      },
    },
  });

  return runFinalRenderJob(job.id, render.id, input);
}

async function runNarrationJob(jobId: string, chunks: string[]) {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date(), error: null },
  });
  const job = await prisma.generationJob.findUniqueOrThrow({
    where: { id: jobId },
  });

  try {
    const generated = [];

    for (const [index, chunk] of chunks.entries()) {
      const result = await synthesizeSpeechWithQwen({
        model: job.model ?? QWEN_TTS_MODEL,
        text: chunk,
      });
      const artifact = await createArtifactFromUrl({
        projectId: job.projectId,
        fileName: `narration-chunk-${index + 1}.wav`,
        mimeType: `audio/${result.audioFormat}`,
        type: "AUDIO",
        url: result.audioUrl,
        metadata: {
          operation: "narration_tts_chunk",
          chunkIndex: index,
          chunkCount: chunks.length,
          model: result.model,
          providerAudioUrl: result.audioUrl,
          providerRequestId: result.providerRequestId,
          sampleRate: result.sampleRate,
          usage: toJsonSafe(result.usage),
        },
      });

      generated.push({ artifact, result });
    }

    const audioBuffers = await Promise.all(
      generated.map((item) => fetchArtifactBuffer(item.artifact)),
    );
    const combinedAudio =
      audioBuffers.length === 1 ? audioBuffers[0] : concatenateWav(audioBuffers);
    const durationSec = estimateNarrationDurationSec(chunks.join(" "));
    const narration = await createStoredArtifact({
      projectId: job.projectId,
      fileName: `narration-${Date.now()}.wav`,
      mimeType: "audio/wav",
      type: "AUDIO",
      body: combinedAudio,
      durationSec,
      metadata: {
        operation: "narration_tts",
        model: job.model ?? QWEN_TTS_MODEL,
        chunkCount: chunks.length,
        maxChars: QWEN_TTS_MAX_CHARS,
        chunkArtifactIds: generated.map((item) => item.artifact.id),
        waveform: buildWaveform(chunks.join(" ")),
      },
    });

    return prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETE",
        output: {
          narrationArtifactId: narration.id,
          chunkCount: chunks.length,
          durationSec,
        },
        completedAt: new Date(),
      },
    });
  } catch (error) {
    return prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: sanitizeTtsFailure(error),
        completedAt: new Date(),
      },
    });
  }
}

async function runFinalRenderJob(
  jobId: string,
  renderId: string,
  input: ReelCompositionInput,
) {
  const job = await prisma.generationJob.findUniqueOrThrow({
    where: { id: jobId },
  });

  await prisma.$transaction([
    prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", startedAt: new Date(), error: null },
    }),
    prisma.render.update({
      where: { id: renderId },
      data: { status: "RUNNING" },
    }),
    prisma.project.update({
      where: { id: job.projectId },
      data: { status: "RENDERING" },
    }),
  ]);

  try {
    const rendered = await renderReel(input);
    const timestamp = Date.now();
    const finalArtifact = await createStoredArtifact({
      projectId: job.projectId,
      fileName: `reelai-${job.projectId}-${timestamp}.mp4`,
      mimeType: "video/mp4",
      type: "FINAL_RENDER",
      body: rendered.mp4,
      width: 1080,
      height: 1920,
      durationSec: rendered.durationSec,
      metadata: {
        operation: "final_render",
        renderer: "remotion",
        aiDisclosureEnabled: input.aiDisclosureEnabled,
        bgmIncluded: Boolean(input.bgmUrl),
        safeZonePreset: input.safeZonePreset,
      },
    });
    const thumbnailArtifact = await createStoredArtifact({
      projectId: job.projectId,
      fileName: `reelai-${job.projectId}-${timestamp}-thumbnail.png`,
      mimeType: "image/png",
      type: "THUMBNAIL",
      body: rendered.thumbnail,
      width: 1080,
      height: 1920,
      metadata: {
        operation: "final_render_thumbnail",
        renderArtifactId: finalArtifact.id,
      },
    });

    await prisma.$transaction([
      prisma.render.update({
        where: { id: renderId },
        data: {
          artifactId: finalArtifact.id,
          completedAt: new Date(),
          settings: {
            ...((await getRenderSettings(renderId)) as Record<string, unknown>),
            thumbnailArtifactId: thumbnailArtifact.id,
          },
          status: "COMPLETE",
        },
      }),
      prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETE",
          output: {
            renderId,
            artifactId: finalArtifact.id,
            thumbnailArtifactId: thumbnailArtifact.id,
            durationSec: rendered.durationSec,
          },
          completedAt: new Date(),
        },
      }),
      prisma.project.update({
        where: { id: job.projectId },
        data: { status: "COMPLETE" },
      }),
    ]);

    return prisma.generationJob.findUniqueOrThrow({ where: { id: jobId } });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Final render failed. Check server logs for sanitized renderer metadata.";

    await prisma.$transaction([
      prisma.render.update({
        where: { id: renderId },
        data: { status: "FAILED", completedAt: new Date() },
      }),
      prisma.project.update({
        where: { id: job.projectId },
        data: { status: "FAILED" },
      }),
    ]);

    return prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: message,
        completedAt: new Date(),
      },
    });
  }
}

async function getRenderableStoryboard(
  projectId: string,
  { requireVideos }: { requireVideos: boolean },
): Promise<StoryboardWithScenes> {
  const storyboard = await prisma.storyboard.findUnique({
    where: { projectId },
    include: {
      scenes: {
        include: { takes: { orderBy: { createdAt: "desc" } } },
        orderBy: { index: "asc" },
      },
    },
  });

  if (!storyboard) {
    throw new Error("Generate and approve a storyboard before final export.");
  }

  if (storyboard.status !== "APPROVED" && storyboard.status !== "COMPLETE") {
    throw new Error("Storyboard must be approved before final export.");
  }

  const scenes = storyboard.scenes.filter((scene) =>
    requireVideos
      ? scene.status === "COMPLETE"
      : scene.status === "APPROVED" || scene.status === "COMPLETE",
  );

  if (requireVideos && scenes.some((scene) => !scene.selectedVideoTakeId)) {
    throw new Error("Select completed video takes for every scene before render.");
  }

  if (scenes.length < 2 || scenes.length > 4) {
    throw new Error("Final export needs 2 to 4 completed scenes.");
  }

  return { ...storyboard, scenes };
}

async function buildReelCompositionInput({
  projectId,
  storyboard,
  narration,
  aiDisclosureEnabled,
  bgmEnabled,
}: {
  projectId: string;
  storyboard: StoryboardWithScenes;
  narration: Artifact | null;
  aiDisclosureEnabled: boolean;
  bgmEnabled: boolean;
}): Promise<ReelCompositionInput> {
  let startTimeSec = 0;
  const scenes = [];

  for (const scene of storyboard.scenes) {
    const take = scene.takes.find((item) => item.id === scene.selectedVideoTakeId);

    if (!take?.artifactId) {
      throw new Error("Every render scene needs a selected video artifact.");
    }

    const artifact = await prisma.artifact.findUniqueOrThrow({
      where: { id: take.artifactId },
    });

    scenes.push({
      videoUrl: artifactUrl(artifact),
      captionText: scene.captionText,
      startTimeSec,
      durationSec: scene.durationSec,
    });
    startTimeSec += scene.durationSec;
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
  });
  const bgm = bgmEnabled ? await getOrCreateSampleBgmArtifact(projectId) : null;

  return {
    scenes,
    narrationUrl: narration ? artifactUrl(narration) : undefined,
    bgmUrl: bgm ? artifactUrl(bgm) : undefined,
    brandWatermark: { text: project.businessName },
    aiDisclosureEnabled,
    safeZonePreset: storyboard.scenes[0]?.safeZonePreset ?? "TIKTOK_REELS",
  };
}

async function getLatestNarrationArtifact(projectId: string) {
  const job = await prisma.generationJob.findFirst({
    where: { projectId, type: "TTS", status: "COMPLETE" },
    orderBy: { completedAt: "desc" },
  });
  const output = job?.output;
  const narrationArtifactId =
    output && typeof output === "object" && !Array.isArray(output)
      ? (output as { narrationArtifactId?: unknown }).narrationArtifactId
      : null;

  if (typeof narrationArtifactId !== "string") {
    return null;
  }

  return prisma.artifact.findUnique({ where: { id: narrationArtifactId } });
}

async function fetchArtifactBuffer(artifact: Artifact) {
  const url = artifactUrl(artifact);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Stored audio artifact could not be read.");
  }

  return Buffer.from(await response.arrayBuffer());
}

function artifactUrl(artifact: Artifact) {
  if (artifact.publicUrl?.startsWith("http")) {
    return artifact.publicUrl;
  }

  const publicAppUrl = process.env.PUBLIC_APP_URL;

  if (publicAppUrl && !publicAppUrl.toLowerCase().includes("placeholder")) {
    return `${publicAppUrl.replace(/\/$/, "")}/api/artifacts/${artifact.id}/file`;
  }

  throw new Error(
    "PUBLIC_APP_URL must be configured so the renderer can read durable artifacts.",
  );
}

async function getOrCreateSampleBgmArtifact(projectId: string) {
  const existing = await prisma.artifact.findFirst({
    where: {
      projectId,
      type: "AUDIO",
      metadata: {
        path: ["operation"],
        equals: "sample_bgm",
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return existing;
  }

  return createStoredArtifact({
    projectId,
    fileName: "sample-bgm.wav",
    mimeType: "audio/wav",
    type: "AUDIO",
    body: generateSampleBgmWav(),
    durationSec: 30,
    metadata: {
      operation: "sample_bgm",
      source: "generated_local_sample",
      description: "Low-volume neutral tone bed for optional MVP BGM mixing.",
    },
  });
}

function generateSampleBgmWav() {
  const sampleRate = 24000;
  const durationSec = 30;
  const samples = sampleRate * durationSec;
  const data = Buffer.alloc(samples * 2);

  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const fade = Math.min(1, t / 1.5, (durationSec - t) / 1.5);
    const tone =
      Math.sin(2 * Math.PI * 110 * t) * 0.18 +
      Math.sin(2 * Math.PI * 165 * t) * 0.08 +
      Math.sin(2 * Math.PI * 220 * t) * 0.035;
    data.writeInt16LE(Math.trunc(Math.max(-1, Math.min(1, tone * fade)) * 0x7fff), i * 2);
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
  return wav;
}

function concatenateWav(buffers: Buffer[]) {
  const parsed = buffers.map(parseWav);
  const first = parsed[0];

  if (
    !first ||
    parsed.some(
      (item) =>
        item.audioFormat !== first.audioFormat ||
        item.channels !== first.channels ||
        item.sampleRate !== first.sampleRate ||
        item.bitsPerSample !== first.bitsPerSample,
    )
  ) {
    return Buffer.concat(buffers);
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

function parseWav(buffer: Buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("TTS returned non-WAV chunks; cannot concatenate safely.");
  }

  const dataOffset = buffer.indexOf("data");

  if (dataOffset < 0) {
    throw new Error("TTS WAV chunk is missing audio data.");
  }
  const dataLength = buffer.readUInt32LE(dataOffset + 4);

  return {
    audioFormat: buffer.readUInt16LE(20),
    channels: buffer.readUInt16LE(22),
    sampleRate: buffer.readUInt32LE(24),
    byteRate: buffer.readUInt32LE(28),
    blockAlign: buffer.readUInt16LE(32),
    bitsPerSample: buffer.readUInt16LE(34),
    data: buffer.subarray(dataOffset + 8, dataOffset + 8 + dataLength),
  };
}

function buildWaveform(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const bars = Array.from({ length: 48 }, (_, index) => {
    const word = words[index % Math.max(words.length, 1)] ?? "";
    return 0.18 + ((word.length * 13 + index * 7) % 70) / 100;
  });

  return bars.map((bar) => Number(bar.toFixed(2)));
}

function estimateNarrationDurationSec(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round((words / 2.6) * 10) / 10);
}

function toJsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

async function getRenderSettings(renderId: string) {
  const render = await prisma.render.findUnique({
    where: { id: renderId },
    select: { settings: true },
  });

  return render?.settings ?? {};
}
