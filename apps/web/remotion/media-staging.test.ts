import { createServer, type RequestListener, type Server } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { withStagedRenderMedia } from "./media-staging";
import type { ReelCompositionInput } from "./schema";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

describe("final render media staging", () => {
  it("downloads each source once and serves repeatable byte ranges locally", async () => {
    const video = mp4Fixture();
    let upstreamRequests = 0;
    const upstream = await startServer((request, response) => {
      upstreamRequests += 1;
      response.writeHead(200, {
        "Content-Length": video.length,
        "Content-Type": "video/mp4",
      });
      response.end(video);
    });
    const input = compositionInput(`${upstream}/video`);

    await withStagedRenderMedia(input, async (staged) => {
      expect(staged.scenes[0]?.videoUrl).toMatch(
        /^http:\/\/127\.0\.0\.1:\d+\/media\/0$/,
      );
      const source = staged.scenes[0]!.videoUrl;
      const firstRange = await fetch(source, {
        headers: { Range: "bytes=4-7" },
      });
      expect(firstRange.status).toBe(206);
      expect(firstRange.headers.get("content-range")).toBe(
        `bytes 4-7/${video.length}`,
      );
      expect(await firstRange.text()).toBe("ftyp");

      const secondRange = await fetch(source, {
        headers: { Range: "bytes=8-11" },
      });
      expect(secondRange.status).toBe(206);
      expect(await secondRange.text()).toBe("isom");
    });

    expect(upstreamRequests).toBe(1);
  });

  it("sniffs WAV audio instead of trusting an octet-stream header", async () => {
    const wav = wavFixture();
    const video = mp4Fixture();
    const upstream = await startServer((request, response) => {
      response.writeHead(200, { "Content-Type": "application/octet-stream" });
      response.end(request.url === "/video" ? video : wav);
    });
    const input = compositionInput(`${upstream}/video`);
    input.scenes[0]!.narration = {
      audioUrl: `${upstream}/audio`,
      offsetSec: 0,
      playbackRate: 1,
      sourceDurationSec: 1,
    };

    await withStagedRenderMedia(input, async (staged) => {
      const response = await fetch(staged.scenes[0]!.narration!.audioUrl);
      expect(response.headers.get("content-type")).toBe("audio/wav");
      expect(Buffer.from(await response.arrayBuffer())).toEqual(wav);
    });
  });

  it("fails before Remotion when narration bytes are not audio", async () => {
    const video = mp4Fixture();
    const upstream = await startServer((request, response) => {
      response.writeHead(200, { "Content-Type": "application/octet-stream" });
      response.end(request.url === "/video" ? video : Buffer.from("not audio"));
    });
    const input = compositionInput(`${upstream}/video`);
    input.scenes[0]!.narration = {
      audioUrl: `${upstream}/audio`,
      offsetSec: 0,
      playbackRate: 1,
      sourceDurationSec: 1,
    };

    await expect(
      withStagedRenderMedia(input, async () => "not reached"),
    ).rejects.toThrow(
      /Scene 1 narration audio could not be prepared.*not decodable audio media/i,
    );
  });
});

function compositionInput(videoUrl: string): ReelCompositionInput {
  return {
    scenes: [
      {
        videoUrl,
        captionText: "Own the moment",
        startTimeSec: 0,
        durationSec: 5,
        transitionStyle: "CUT",
      },
    ],
    aiDisclosureEnabled: true,
    safeZonePreset: "TIKTOK_REELS",
  };
}

async function startServer(handler: RequestListener): Promise<string> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  return `http://127.0.0.1:${address.port}`;
}

function mp4Fixture() {
  return Buffer.concat([
    Buffer.from([0, 0, 0, 24]),
    Buffer.from("ftypisom"),
    Buffer.alloc(20, 1),
  ]);
}

function wavFixture() {
  const body = Buffer.alloc(44);
  body.write("RIFF", 0, "ascii");
  body.writeUInt32LE(36, 4);
  body.write("WAVEfmt ", 8, "ascii");
  body.writeUInt32LE(16, 16);
  body.writeUInt16LE(1, 20);
  body.writeUInt16LE(1, 22);
  body.writeUInt32LE(24_000, 24);
  body.writeUInt32LE(48_000, 28);
  body.writeUInt16LE(2, 32);
  body.writeUInt16LE(16, 34);
  body.write("data", 36, "ascii");
  body.writeUInt32LE(0, 40);
  return body;
}
