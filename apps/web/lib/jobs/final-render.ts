import "server-only";

import type { Artifact, Prisma, Scene, Storyboard, Take } from "@prisma/client";

import { researchWebsite } from "@/lib/brand/website-research";
import { createStoredArtifact } from "@/lib/media/artifacts";
import {
  fitNarrationToScene,
  type SceneNarrationTiming,
} from "@/lib/media/narration-timing";
import { buildWavWaveform, concatenateWav, parseWav } from "@/lib/media/wav";
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
import { storyboardTimingIssue } from "@/lib/storyboards/timing";

type SceneWithTakes = Scene & { takes: Take[] };
type StoryboardWithScenes = Storyboard & { scenes: SceneWithTakes[] };
type NarrationScenePlan = {
  scene: SceneWithTakes;
  chunks: string[];
};
type SceneNarrationOutput = SceneNarrationTiming & {
  sceneId: string;
  sceneIndex: number;
  artifactId: string;
};
type RenderNarration = {
  legacyArtifact: Artifact | null;
  sceneNarrations: Map<
    string,
    { artifact: Artifact; timing: SceneNarrationOutput }
  >;
};

export async function createAndRunNarrationJob(projectId: string) {
  const storyboard = await getRenderableStoryboard(projectId, {
    requireVideos: false,
  });
  const scenePlans = storyboard.scenes.map((scene) => ({
    scene,
    chunks: chunkTtsText(scene.voiceoverText),
  }));
  const chunkCount = scenePlans.reduce(
    (total, scene) => total + scene.chunks.length,
    0,
  );

  const job = await prisma.generationJob.create({
    data: {
      projectId,
      type: "TTS",
      status: "QUEUED",
      model: QWEN_TTS_MODEL,
      input: {
        operation: "scene_narration_tts",
        version: 2,
        chunkCount,
        maxChars: QWEN_TTS_MAX_CHARS,
        sceneIds: storyboard.scenes.map((scene) => scene.id),
      },
    },
  });

  return runNarrationJob(job.id, storyboard.id, scenePlans);
}

export async function createAndRunFinalRenderJob({
  projectId,
  artifactBaseUrl,
  aiDisclosureEnabled = true,
  bgmEnabled = false,
}: {
  projectId: string;
  artifactBaseUrl: string;
  aiDisclosureEnabled?: boolean;
  bgmEnabled?: boolean;
}) {
  const projectAudioPolicy = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { outputMode: true, videoLengthSec: true },
  });
  const effectiveBgmEnabled =
    projectAudioPolicy.outputMode === "PRODUCT_SHOWCASE" ? false : bgmEnabled;
  const storyboard = await getRenderableStoryboard(projectId, {
    requireVideos: true,
  });
  const narration = await getLatestNarration(projectId, storyboard);
  const input = await buildReelCompositionInput({
    projectId,
    storyboard,
    narration,
    artifactBaseUrl,
    aiDisclosureEnabled,
    bgmEnabled: effectiveBgmEnabled,
  });
  const render = await prisma.render.create({
    data: {
      projectId,
      status: "QUEUED",
      format: "9:16",
      settings: {
        aiDisclosureEnabled,
        bgmEnabled: effectiveBgmEnabled,
        sourceClipAudio: "MUTED",
        audioPolicy:
          projectAudioPolicy.outputMode === "PRODUCT_SHOWCASE"
            ? "VOICEOVER_ONLY"
            : "NARRATION_WITH_OPTIONAL_BGM",
        logoIncluded: Boolean(input.brandWatermark?.logoUrl),
        logoLoadPolicy: input.brandWatermark?.logoUrl
          ? "WAIT_FOR_DOWNLOAD_AND_DECODE"
          : "TEXT_ONLY",
        brandLockupMode: input.brandWatermark?.logoUrl
          ? "LOGO_ONLY"
          : "TEXT_ONLY",
        showcaseFormat:
          projectAudioPolicy.outputMode === "PRODUCT_SHOWCASE" &&
          projectAudioPolicy.videoLengthSec === 5
            ? "SINGLE_CLIP_HERO_WITH_BRAND_CLOSER"
            : null,
        captionOverlaySceneCount: input.scenes.length > 0 ? 1 : 0,
        transitionStyles: input.scenes.map(
          (scene) => scene.transitionStyle ?? "CUT",
        ),
        safeZonePreset: input.safeZonePreset,
        narrationArtifactIds: [...narration.sceneNarrations.values()].map(
          (item) => item.artifact.id,
        ),
        legacyNarrationArtifactId: narration.legacyArtifact?.id ?? null,
        narrationTimingVersion: narration.sceneNarrations.size > 0 ? 2 : 1,
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
        bgmEnabled: effectiveBgmEnabled,
        logoIncluded: Boolean(input.brandWatermark?.logoUrl),
      },
    },
  });

  return runFinalRenderJob(job.id, render.id, input);
}

async function runNarrationJob(
  jobId: string,
  storyboardId: string,
  scenePlans: NarrationScenePlan[],
) {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date(), error: null },
  });
  const job = await prisma.generationJob.findUniqueOrThrow({
    where: { id: jobId },
  });

  try {
    const sceneNarrations: SceneNarrationOutput[] = [];
    let globalChunkIndex = 0;

    for (const plan of scenePlans) {
      if (plan.chunks.length === 0) continue;

      const generated = [];
      for (const [sceneChunkIndex, chunk] of plan.chunks.entries()) {
        globalChunkIndex += 1;
        const result = await synthesizeSpeechWithQwen({
          model: job.model ?? QWEN_TTS_MODEL,
          text: chunk,
        });
        const providerAudio = await fetch(result.audioUrl);
        if (!providerAudio.ok) {
          throw new Error("Provider narration audio could not be downloaded.");
        }
        const audioBuffer = Buffer.from(await providerAudio.arrayBuffer());
        const artifact = await createStoredArtifact({
          projectId: job.projectId,
          fileName: `scene-${plan.scene.index}-narration-chunk-${globalChunkIndex}.wav`,
          mimeType:
            providerAudio.headers.get("content-type") ??
            `audio/${result.audioFormat}`,
          type: "AUDIO",
          body: audioBuffer,
          metadata: {
            operation: "scene_narration_tts_chunk",
            sceneId: plan.scene.id,
            sceneIndex: plan.scene.index,
            sceneChunkIndex,
            sceneChunkCount: plan.chunks.length,
            model: result.model,
            providerAudioUrl: result.audioUrl,
            providerRequestId: result.providerRequestId,
            sampleRate: result.sampleRate,
            usage: toJsonSafe(result.usage),
          },
        });
        generated.push({ artifact, audioBuffer });
      }

      const audioBuffers = generated.map((item) => item.audioBuffer);
      const combinedAudio =
        audioBuffers.length === 1
          ? audioBuffers[0]
          : concatenateWav(audioBuffers);
      const durationSec = parseWav(combinedAudio).durationSec;
      let timing: SceneNarrationTiming;

      try {
        timing = fitNarrationToScene({
          sceneDurationSec: plan.scene.durationSec,
          sourceDurationSec: durationSec,
        });
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Narration is too long.";
        const recommendedWords = Math.max(
          3,
          Math.floor((plan.scene.durationSec - 0.38) * 2.5),
        );
        throw new Error(
          `Scene ${plan.scene.index}: ${detail} Shorten this voiceover to about ${recommendedWords} words, then generate narration again.`,
        );
      }

      const narration = await createStoredArtifact({
        projectId: job.projectId,
        fileName: `scene-${plan.scene.index}-narration-${Date.now()}.wav`,
        mimeType: "audio/wav",
        type: "AUDIO",
        body: combinedAudio,
        durationSec,
        metadata: {
          operation: "scene_narration_tts",
          timingVersion: 2,
          sceneId: plan.scene.id,
          sceneIndex: plan.scene.index,
          model: job.model ?? QWEN_TTS_MODEL,
          chunkCount: plan.chunks.length,
          chunkArtifactIds: generated.map((item) => item.artifact.id),
          sourceDurationSec: timing.sourceDurationSec,
          audibleDurationSec: timing.audibleDurationSec,
          offsetSec: timing.offsetSec,
          playbackRate: timing.playbackRate,
          waveform: buildWavWaveform(combinedAudio),
        },
      });

      sceneNarrations.push({
        ...timing,
        sceneId: plan.scene.id,
        sceneIndex: plan.scene.index,
        artifactId: narration.id,
      });
    }

    const completedAt = new Date();
    const transaction = await prisma.$transaction([
      prisma.scene.updateMany({
        where: { storyboardId },
        data: { narrationArtifactId: null },
      }),
      ...sceneNarrations.map((narration) =>
        prisma.scene.update({
          where: { id: narration.sceneId },
          data: { narrationArtifactId: narration.artifactId },
        }),
      ),
      prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETE",
          output: {
            version: 2,
            sceneNarrations,
            sceneCount: sceneNarrations.length,
            silentSceneCount: scenePlans.length - sceneNarrations.length,
            chunkCount: globalChunkIndex,
            durationSec: sceneNarrations.reduce(
              (total, narration) => total + narration.audibleDurationSec,
              0,
            ),
          },
          completedAt,
        },
      }),
    ]);

    return transaction.at(-1)!;
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
        bgmDuckedUnderNarration: Boolean(
          input.bgmUrl && input.scenes.some((scene) => scene.narration),
        ),
        narrationTimingVersion: input.scenes.some((scene) => scene.narration)
          ? 2
          : input.narrationUrl
            ? 1
            : null,
        sceneNarrationCount: input.scenes.filter((scene) => scene.narration)
          .length,
        captionOverlaySceneCount: input.scenes.length > 0 ? 1 : 0,
        transitionStyles: input.scenes.map(
          (scene) => scene.transitionStyle ?? "CUT",
        ),
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
      project: { select: { outputMode: true, videoLengthSec: true } },
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

  const timingIssue = storyboardTimingIssue({
    outputMode: storyboard.project.outputMode,
    targetDurationSec: storyboard.project.videoLengthSec,
    durations: storyboard.scenes.map((scene) => scene.durationSec),
  });
  if (timingIssue) {
    throw new Error(timingIssue);
  }
  if (
    requireVideos &&
    storyboard.scenes.some(
      (scene) =>
        scene.status !== "COMPLETE" ||
        !scene.takes.some(
          (take) =>
            take.id === scene.selectedVideoTakeId &&
            take.kind === "VIDEO" &&
            take.status === "COMPLETE" &&
            take.artifactId,
        ),
    )
  ) {
    throw new Error(
      "Complete and select a video take for every storyboard scene before render.",
    );
  }
  if (
    !requireVideos &&
    storyboard.scenes.some(
      (scene) => scene.status !== "APPROVED" && scene.status !== "COMPLETE",
    )
  ) {
    throw new Error(
      "Approve every storyboard scene before generating narration.",
    );
  }

  return storyboard;
}

async function buildReelCompositionInput({
  projectId,
  storyboard,
  narration,
  artifactBaseUrl,
  aiDisclosureEnabled,
  bgmEnabled,
}: {
  projectId: string;
  storyboard: StoryboardWithScenes;
  narration: RenderNarration;
  artifactBaseUrl: string;
  aiDisclosureEnabled: boolean;
  bgmEnabled: boolean;
}): Promise<ReelCompositionInput> {
  let startTimeSec = 0;
  const scenes = [];

  for (const scene of storyboard.scenes) {
    const take = scene.takes.find(
      (item) => item.id === scene.selectedVideoTakeId,
    );

    if (!take?.artifactId) {
      throw new Error("Every render scene needs a selected video artifact.");
    }

    const artifact = await prisma.artifact.findUniqueOrThrow({
      where: { id: take.artifactId },
    });

    scenes.push({
      videoUrl: artifactUrl(artifact, artifactBaseUrl),
      captionText: scene.captionText,
      startTimeSec,
      durationSec: scene.durationSec,
      transitionStyle: scene.transitionStyle,
      narration: narration.sceneNarrations.has(scene.id)
        ? {
            audioUrl: artifactUrl(
              narration.sceneNarrations.get(scene.id)!.artifact,
              artifactBaseUrl,
            ),
            sourceDurationSec: narration.sceneNarrations.get(scene.id)!.timing
              .sourceDurationSec,
            offsetSec: narration.sceneNarrations.get(scene.id)!.timing
              .offsetSec,
            playbackRate: narration.sceneNarrations.get(scene.id)!.timing
              .playbackRate,
          }
        : undefined,
    });
    startTimeSec += scene.durationSec;
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      sources: {
        where: { type: "LOGO" },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  const logoArtifactIds = project.sources.flatMap((source) =>
    source.artifactId ? [source.artifactId] : [],
  );
  const logoArtifact = logoArtifactIds.length
    ? await prisma.artifact.findFirst({
        where: {
          id: { in: logoArtifactIds },
          projectId,
          mimeType: { startsWith: "image/" },
        },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const uploadedLogoUrl = logoArtifact
    ? artifactUrl(logoArtifact, artifactBaseUrl)
    : null;
  const verifiedWebsiteLogoUrl = uploadedLogoUrl
    ? null
    : await findVerifiedWebsiteLogoUrl(project.websiteUrl);
  const bgm = bgmEnabled ? await getOrCreateSampleBgmArtifact(projectId) : null;

  return {
    scenes,
    narrationUrl: narration.legacyArtifact
      ? artifactUrl(narration.legacyArtifact, artifactBaseUrl)
      : undefined,
    bgmUrl: bgm ? artifactUrl(bgm, artifactBaseUrl) : undefined,
    brandWatermark:
      (uploadedLogoUrl ?? verifiedWebsiteLogoUrl)
        ? {
            logoUrl: uploadedLogoUrl ?? verifiedWebsiteLogoUrl ?? undefined,
            showOn: "LAST",
          }
        : {
            text: project.businessName,
            showOn: "LAST",
          },
    aiDisclosureEnabled,
    safeZonePreset: storyboard.scenes[0]?.safeZonePreset ?? "TIKTOK_REELS",
  };
}

async function findVerifiedWebsiteLogoUrl(websiteUrl: string | null) {
  if (!websiteUrl) return null;

  const research = await researchWebsite(websiteUrl);
  const visual = research?.visualUrls.find((candidate) =>
    /\b(?:logo|wordmark)\b/i.test(candidate.label),
  );

  return visual?.url ?? null;
}

async function getLatestNarration(
  projectId: string,
  storyboard: StoryboardWithScenes,
): Promise<RenderNarration> {
  const job = await prisma.generationJob.findFirst({
    where: { projectId, type: "TTS", status: "COMPLETE" },
    orderBy: { completedAt: "desc" },
  });
  const output = asRecord(job?.output);
  const sceneNarrations = parseSceneNarrationOutput(output?.sceneNarrations);

  if (sceneNarrations.length > 0) {
    const currentSceneById = new Map(
      storyboard.scenes.map((scene) => [scene.id, scene]),
    );
    const artifactIds = sceneNarrations.map((item) => item.artifactId);
    const artifacts = await prisma.artifact.findMany({
      where: { id: { in: artifactIds }, projectId, type: "AUDIO" },
    });
    const artifactById = new Map(
      artifacts.map((artifact) => [artifact.id, artifact]),
    );
    const currentNarrations = new Map<
      string,
      { artifact: Artifact; timing: SceneNarrationOutput }
    >();

    for (const timing of sceneNarrations) {
      const scene = currentSceneById.get(timing.sceneId);
      const artifact = artifactById.get(timing.artifactId);
      if (scene?.narrationArtifactId === timing.artifactId && artifact) {
        currentNarrations.set(timing.sceneId, { artifact, timing });
      }
    }

    return { legacyArtifact: null, sceneNarrations: currentNarrations };
  }

  const narrationArtifactId =
    typeof output?.narrationArtifactId === "string"
      ? output.narrationArtifactId
      : null;

  if (!narrationArtifactId) {
    return { legacyArtifact: null, sceneNarrations: new Map() };
  }

  return {
    legacyArtifact: await prisma.artifact.findFirst({
      where: { id: narrationArtifactId, projectId, type: "AUDIO" },
    }),
    sceneNarrations: new Map(),
  };
}

function parseSceneNarrationOutput(value: unknown): SceneNarrationOutput[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const record = asRecord(item);
    if (
      typeof record?.sceneId !== "string" ||
      typeof record.artifactId !== "string" ||
      typeof record.sceneIndex !== "number" ||
      typeof record.offsetSec !== "number" ||
      typeof record.playbackRate !== "number" ||
      typeof record.sourceDurationSec !== "number" ||
      typeof record.audibleDurationSec !== "number"
    ) {
      return [];
    }

    return [
      {
        sceneId: record.sceneId,
        artifactId: record.artifactId,
        sceneIndex: record.sceneIndex,
        offsetSec: record.offsetSec,
        playbackRate: record.playbackRate,
        sourceDurationSec: record.sourceDurationSec,
        audibleDurationSec: record.audibleDurationSec,
      },
    ];
  });
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function artifactUrl(artifact: Artifact, artifactBaseUrl: string) {
  return `${artifactBaseUrl.replace(/\/$/, "")}/api/artifacts/${artifact.id}/file`;
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
    data.writeInt16LE(
      Math.trunc(Math.max(-1, Math.min(1, tone * fade)) * 0x7fff),
      i * 2,
    );
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
