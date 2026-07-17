import "server-only";

import { mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  getReelDurationFrames,
  REEL_FPS,
  REEL_HEIGHT,
  REEL_WIDTH,
  type ReelCompositionInput,
} from "./schema";
import { withStagedRenderMedia } from "./media-staging";

export type RenderedReel = {
  mp4: Buffer;
  thumbnail: Buffer;
  durationSec: number;
};

const RENDER_MEDIA_TIMEOUT_MS = 120_000;
const RENDER_CONCURRENCY = 2;

export async function renderReel(
  input: ReelCompositionInput,
): Promise<RenderedReel> {
  return withStagedRenderMedia(input, renderStagedReel);
}

async function renderStagedReel(
  input: ReelCompositionInput,
): Promise<RenderedReel> {
  const [{ bundle }, { renderMedia, renderStill, selectComposition }] =
    await Promise.all([
      runtimeImport<typeof import("@remotion/bundler")>("@remotion/bundler"),
      runtimeImport<typeof import("@remotion/renderer")>("@remotion/renderer"),
    ]);
  const entryPoint = path.join(process.cwd(), "remotion", "index.tsx");
  const serveUrl = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  });
  const durationInFrames = getReelDurationFrames(input);
  const composition = await selectComposition({
    serveUrl,
    id: "ReelComposition",
    inputProps: input,
    timeoutInMilliseconds: RENDER_MEDIA_TIMEOUT_MS,
  });
  const workDir = path.join(
    os.tmpdir(),
    `reelai-render-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  const outputLocation = path.join(workDir, "final.mp4");
  const thumbnailLocation = path.join(workDir, "thumbnail.png");

  try {
    await mkdir(workDir, { recursive: true });
    await renderMedia({
      codec: "h264",
      composition: {
        ...composition,
        durationInFrames,
        fps: REEL_FPS,
        height: REEL_HEIGHT,
        width: REEL_WIDTH,
      },
      inputProps: input,
      outputLocation,
      serveUrl,
      timeoutInMilliseconds: RENDER_MEDIA_TIMEOUT_MS,
      concurrency: RENDER_CONCURRENCY,
    });
    await renderStill({
      composition: {
        ...composition,
        durationInFrames,
        fps: REEL_FPS,
        height: REEL_HEIGHT,
        width: REEL_WIDTH,
      },
      frame: Math.min(REEL_FPS, durationInFrames - 1),
      imageFormat: "png",
      inputProps: input,
      output: thumbnailLocation,
      serveUrl,
      timeoutInMilliseconds: RENDER_MEDIA_TIMEOUT_MS,
    });

    return {
      durationSec: durationInFrames / REEL_FPS,
      mp4: await readFile(outputLocation),
      thumbnail: await readFile(thumbnailLocation),
    };
  } finally {
    await rm(workDir, { force: true, recursive: true });
  }
}

function runtimeImport<T>(specifier: string): Promise<T> {
  const dynamicImport = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<T>;

  return dynamicImport(specifier);
}
