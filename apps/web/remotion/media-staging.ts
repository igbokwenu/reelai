import "server-only";

import { createServer, type Server } from "node:http";

import { parseByteRange } from "@/lib/media/http-range";

import type { ReelCompositionInput } from "./schema";

type MediaKind = "video" | "audio" | "image";

type MediaReference = {
  kind: MediaKind;
  label: string;
  url: string;
};

type StagedAsset = {
  body: Buffer;
  mimeType: string;
};

const DOWNLOAD_ATTEMPTS = 3;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const MAX_ASSET_BYTES = 256 * 1024 * 1024;

export async function withStagedRenderMedia<T>(
  input: ReelCompositionInput,
  render: (stagedInput: ReelCompositionInput) => Promise<T>,
) {
  const references = collectMediaReferences(input);
  if (references.length === 0) return render(input);

  const assets = await Promise.all(
    references.map(async (reference, index) => ({
      path: `/media/${index}`,
      reference,
      asset: await downloadAndValidate(reference),
    })),
  );
  const server = await startMediaServer(
    new Map(assets.map((item) => [item.path, item.asset])),
  );
  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("Final render media staging could not start locally.");
  }

  const localUrlBySource = new Map(
    assets.map((item) => [
      item.reference.url,
      `http://127.0.0.1:${address.port}${item.path}`,
    ]),
  );

  try {
    return await render(remapMediaUrls(input, localUrlBySource));
  } finally {
    await closeServer(server);
  }
}

function collectMediaReferences(input: ReelCompositionInput) {
  const references: MediaReference[] = [];

  for (const [index, scene] of input.scenes.entries()) {
    references.push({
      kind: "video",
      label: `Scene ${index + 1} video`,
      url: scene.videoUrl,
    });
    if (scene.narration) {
      references.push({
        kind: "audio",
        label: `Scene ${index + 1} narration audio`,
        url: scene.narration.audioUrl,
      });
    }
  }
  if (input.narrationUrl) {
    references.push({
      kind: "audio",
      label: "Legacy narration audio",
      url: input.narrationUrl,
    });
  }
  if (input.bgmUrl) {
    references.push({
      kind: "audio",
      label: "Background music",
      url: input.bgmUrl,
    });
  }
  if (input.brandWatermark?.logoUrl) {
    references.push({
      kind: "image",
      label: "Brand logo",
      url: input.brandWatermark.logoUrl,
    });
  }

  return [
    ...new Map(
      references.map((reference) => [reference.url, reference]),
    ).values(),
  ];
}

async function downloadAndValidate(reference: MediaReference) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    try {
      const response = await fetch(reference.url, {
        headers: { Accept: acceptHeader(reference.kind) },
        signal: controller.signal,
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (
          !isRetryableStatus(response.status) ||
          attempt === DOWNLOAD_ATTEMPTS
        ) {
          throw new Error(`HTTP ${response.status}`);
        }
        continue;
      }

      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_ASSET_BYTES) {
        await response.body?.cancel();
        throw new Error("asset exceeds the 256 MB render limit");
      }

      const body = Buffer.from(await response.arrayBuffer());
      if (body.length === 0 || body.length > MAX_ASSET_BYTES) {
        throw new Error(
          body.length === 0
            ? "asset is empty"
            : "asset exceeds the 256 MB render limit",
        );
      }
      return {
        body,
        mimeType: validatedMimeType(
          body,
          reference.kind,
          response.headers.get("content-type"),
        ),
      } satisfies StagedAsset;
    } catch (error) {
      lastError = error;
      if (attempt < DOWNLOAD_ATTEMPTS && isRetryableDownloadError(error)) {
        await wait(350 * attempt);
        continue;
      }
      break;
    } finally {
      clearTimeout(timeout);
    }
  }

  const detail =
    lastError instanceof Error && lastError.name !== "AbortError"
      ? ` (${lastError.message})`
      : "";
  throw new Error(
    `${reference.label} could not be prepared for final rendering${detail}. The source artifact is preserved; regenerate only that media item if this continues.`,
  );
}

function validatedMimeType(
  body: Buffer,
  kind: MediaKind,
  upstreamMimeType: string | null,
) {
  const detected = detectMimeType(body);
  const compatible =
    kind === "video"
      ? detected === "video/mp4" || detected === "video/webm"
      : kind === "audio"
        ? detected?.startsWith("audio/")
        : detected?.startsWith("image/");

  if (!compatible) {
    const upstream = upstreamMimeType?.split(";", 1)[0]?.trim();
    throw new Error(
      `received ${detected ?? upstream ?? "an unknown format"}, not decodable ${kind} media`,
    );
  }
  return detected!;
}

function detectMimeType(body: Buffer) {
  if (body.length >= 12 && body.toString("ascii", 4, 8) === "ftyp") {
    const brand = body.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (/^M4A/.test(brand)) return "audio/mp4";
    return "video/mp4";
  }
  if (
    body.length >= 12 &&
    body.toString("ascii", 0, 4) === "RIFF" &&
    body.toString("ascii", 8, 12) === "WAVE"
  ) {
    return "audio/wav";
  }
  if (
    body.length >= 3 &&
    (body.toString("ascii", 0, 3) === "ID3" ||
      (body[0] === 0xff && (body[1]! & 0xe0) === 0xe0))
  ) {
    return "audio/mpeg";
  }
  if (body.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return "video/webm";
  }
  if (body.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
  if (body.toString("ascii", 0, 4) === "fLaC") return "audio/flac";
  if (
    body
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    body[0] === 0x00 &&
    body[1] === 0x00 &&
    body[2] === 0x01 &&
    body[3] === 0x00
  ) {
    return "image/x-icon";
  }
  if (
    body.toString("ascii", 0, 4) === "RIFF" &&
    body.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (body.toString("ascii", 0, 6).match(/^GIF8[79]a$/)) {
    return "image/gif";
  }
  const textPrefix = body.toString("utf8", 0, Math.min(body.length, 512));
  if (/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(textPrefix)) {
    return "image/svg+xml";
  }
  return null;
}

async function startMediaServer(assets: Map<string, StagedAsset>) {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const asset = assets.get(pathname);
    if (!asset) {
      response.writeHead(404).end();
      return;
    }

    const corsHeaders = {
      "Access-Control-Allow-Headers": "Content-Type, Range",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers":
        "Accept-Ranges, Content-Length, Content-Range, Content-Type",
    };
    if (request.method === "OPTIONS") {
      response.writeHead(204, corsHeaders).end();
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, corsHeaders).end();
      return;
    }

    const requestedRange = request.headers.range ?? null;
    const range = parseByteRange(requestedRange, asset.body.length);
    if (requestedRange && !range) {
      response
        .writeHead(416, {
          ...corsHeaders,
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes */${asset.body.length}`,
        })
        .end();
      return;
    }
    const body = range
      ? asset.body.subarray(range.start, range.end + 1)
      : asset.body;
    const headers: Record<string, string> = {
      ...corsHeaders,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600, immutable",
      "Content-Length": String(body.length),
      "Content-Type": asset.mimeType,
    };
    if (range) {
      headers["Content-Range"] =
        `bytes ${range.start}-${range.end}/${asset.body.length}`;
    }
    response.writeHead(range ? 206 : 200, headers);
    response.end(request.method === "HEAD" ? undefined : body);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  return server;
}

function remapMediaUrls(
  input: ReelCompositionInput,
  localUrlBySource: Map<string, string>,
): ReelCompositionInput {
  const remap = (url: string) => localUrlBySource.get(url) ?? url;
  return {
    ...input,
    scenes: input.scenes.map((scene) => ({
      ...scene,
      videoUrl: remap(scene.videoUrl),
      narration: scene.narration
        ? { ...scene.narration, audioUrl: remap(scene.narration.audioUrl) }
        : undefined,
    })),
    narrationUrl: input.narrationUrl ? remap(input.narrationUrl) : undefined,
    bgmUrl: input.bgmUrl ? remap(input.bgmUrl) : undefined,
    brandWatermark: input.brandWatermark
      ? {
          ...input.brandWatermark,
          logoUrl: input.brandWatermark.logoUrl
            ? remap(input.brandWatermark.logoUrl)
            : undefined,
        }
      : undefined,
  };
}

async function closeServer(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

function acceptHeader(kind: MediaKind) {
  if (kind === "video") return "video/mp4,video/webm;q=0.9,*/*;q=0.1";
  if (kind === "audio") return "audio/wav,audio/mpeg,audio/*;q=0.9,*/*;q=0.1";
  return "image/*,*/*;q=0.1";
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableDownloadError(error: unknown) {
  if (error instanceof TypeError) return true;
  return error instanceof Error && error.name === "AbortError";
}

function wait(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
