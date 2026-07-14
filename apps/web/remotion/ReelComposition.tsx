"use client";

import { Video } from "@remotion/media";
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { ReelCompositionInput } from "./schema";
import {
  getBgmVolume,
  getBrandWatermarkWindow,
  getSceneNarrationWindow,
  NARRATION_MIX_VOLUME,
} from "./schema";

export function ReelComposition(input: ReelCompositionInput) {
  const { fps } = useVideoConfig();
  const brandWindow = getBrandWatermarkWindow(input, fps);

  return (
    <AbsoluteFill style={{ backgroundColor: "#080b10" }}>
      {input.scenes.map((scene, index) => {
        const from = Math.round(scene.startTimeSec * fps);
        const durationInFrames = Math.max(
          1,
          Math.round(scene.durationSec * fps),
        );

        const narrationWindow = getSceneNarrationWindow(scene, fps);

        return (
          <Sequence
            durationInFrames={durationInFrames}
            from={from}
            key={`${scene.videoUrl}-${index}`}
          >
            <SceneLayer
              caption={scene.captionText}
              scene={scene}
              safeZonePreset={input.safeZonePreset}
            />
            {scene.narration && narrationWindow ? (
              <Sequence
                durationInFrames={narrationWindow.durationInFrames}
                from={Math.max(0, narrationWindow.from - from)}
              >
                <Audio
                  playbackRate={scene.narration.playbackRate}
                  src={scene.narration.audioUrl}
                  volume={(frame) =>
                    narrationEnvelope(
                      frame,
                      narrationWindow.durationInFrames,
                      fps,
                    )
                  }
                />
              </Sequence>
            ) : null}
          </Sequence>
        );
      })}

      {input.narrationUrl ? <Audio src={input.narrationUrl} /> : null}
      {input.bgmUrl ? <BgmLayer input={input} /> : null}

      {brandWindow ? (
        <Sequence
          durationInFrames={brandWindow.durationInFrames}
          from={brandWindow.from}
        >
          <BrandWatermark watermark={input.brandWatermark} />
        </Sequence>
      ) : null}
      {input.aiDisclosureEnabled ? <Disclosure /> : null}
    </AbsoluteFill>
  );
}

function BgmLayer({ input }: { input: ReelCompositionInput }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return <Audio src={input.bgmUrl!} volume={getBgmVolume(input, frame, fps)} />;
}

function narrationEnvelope(frame: number, duration: number, fps: number) {
  const fadeFrames = Math.max(1, Math.round(fps * 0.06));
  const fadeIn = interpolate(frame, [0, fadeFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [Math.max(0, duration - fadeFrames), duration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return Math.min(fadeIn, fadeOut) * NARRATION_MIX_VOLUME;
}

function SceneLayer({
  scene,
  caption,
  safeZonePreset,
}: {
  scene: ReelCompositionInput["scenes"][number];
  caption: string;
  safeZonePreset: ReelCompositionInput["safeZonePreset"];
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 80 },
  });

  return (
    <AbsoluteFill>
      <Video
        delayRenderRetries={2}
        delayRenderTimeoutInMilliseconds={120_000}
        muted
        objectFit="cover"
        src={scene.videoUrl}
        style={{
          height: "100%",
          width: "100%",
        }}
      />
      <div
        style={{
          ...captionStyle(safeZonePreset),
          transform: `translateX(-50%) scale(${0.96 + scale * 0.04})`,
        }}
      >
        {caption}
      </div>
    </AbsoluteFill>
  );
}

function BrandWatermark({
  watermark,
}: {
  watermark?: ReelCompositionInput["brandWatermark"];
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({
    frame,
    fps,
    config: { damping: 90, stiffness: 110 },
  });

  if (!watermark?.text && !watermark?.logoUrl) {
    return null;
  }

  return (
    <div
      style={{
        alignItems: "center",
        backdropFilter: "blur(16px)",
        background: "rgba(8,11,16,0.56)",
        border: "1px solid rgba(255,255,255,0.22)",
        borderRadius: 18,
        boxShadow: "0 18px 60px rgba(0,0,0,0.28)",
        color: "rgba(255,255,255,0.94)",
        display: "flex",
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 32,
        fontWeight: 700,
        gap: 16,
        left: 56,
        opacity: entrance,
        padding: "14px 18px",
        position: "absolute",
        textShadow: "0 2px 18px rgba(0,0,0,0.45)",
        top: 76,
        transform: `translateY(${Math.round((1 - entrance) * -12)}px)`,
      }}
    >
      {watermark.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          src={watermark.logoUrl}
          style={{
            borderRadius: 8,
            height: 58,
            maxWidth: 240,
            objectFit: "contain",
            width: "auto",
          }}
        />
      ) : null}
      {watermark.text ? (
        <span style={{ maxWidth: 420 }}>{watermark.text}</span>
      ) : null}
    </div>
  );
}

function Disclosure() {
  return (
    <div
      style={{
        background: "rgba(8,11,16,0.58)",
        border: "1px solid rgba(255,255,255,0.24)",
        borderRadius: 12,
        bottom: 50,
        color: "rgba(255,255,255,0.86)",
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 24,
        fontWeight: 600,
        letterSpacing: 0,
        padding: "10px 16px",
        position: "absolute",
        right: 46,
      }}
    >
      AI-assisted ad
    </div>
  );
}

function captionStyle(safeZonePreset: ReelCompositionInput["safeZonePreset"]) {
  const bottom =
    safeZonePreset === "NONE"
      ? 120
      : safeZonePreset === "YOUTUBE_SHORTS"
        ? 310
        : 360;

  return {
    background:
      "linear-gradient(180deg, rgba(8,11,16,0.88), rgba(8,11,16,0.70))",
    border: "1px solid rgba(255,255,255,0.24)",
    borderRadius: 18,
    bottom,
    boxShadow: "0 22px 80px rgba(0,0,0,0.42)",
    color: "white",
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: 58,
    fontWeight: 800,
    left: "50%",
    letterSpacing: 0,
    lineHeight: 1.08,
    maxWidth: 900,
    padding: "26px 34px",
    position: "absolute" as const,
    textAlign: "center" as const,
    textShadow: "0 3px 24px rgba(0,0,0,0.46)",
    width: "fit-content",
  };
}

export function SampleBgmAudio() {
  return staticFile("sample-bgm.mp3");
}
