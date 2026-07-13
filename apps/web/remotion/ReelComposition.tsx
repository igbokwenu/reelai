"use client";

import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { ReelCompositionInput } from "./schema";

export function ReelComposition(input: ReelCompositionInput) {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#080b10" }}>
      {input.scenes.map((scene, index) => {
        const from = Math.round(scene.startTimeSec * fps);
        const durationInFrames = Math.max(
          1,
          Math.round(scene.durationSec * fps),
        );

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
          </Sequence>
        );
      })}

      {input.narrationUrl ? <Audio src={input.narrationUrl} /> : null}
      {input.bgmUrl ? <Audio src={input.bgmUrl} volume={0.18} /> : null}

      <BrandWatermark watermark={input.brandWatermark} />
      {input.aiDisclosureEnabled ? <Disclosure /> : null}
    </AbsoluteFill>
  );
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
      <OffthreadVideo
        muted
        src={scene.videoUrl}
        style={{
          height: "100%",
          objectFit: "cover",
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
  if (!watermark?.text && !watermark?.logoUrl) {
    return null;
  }

  return (
    <div
      style={{
        alignItems: "center",
        color: "rgba(255,255,255,0.82)",
        display: "flex",
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 32,
        fontWeight: 700,
        gap: 16,
        left: 56,
        position: "absolute",
        textShadow: "0 2px 18px rgba(0,0,0,0.45)",
        top: 76,
      }}
    >
      {watermark.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          src={watermark.logoUrl}
          style={{
            borderRadius: 10,
            height: 52,
            objectFit: "contain",
            width: 52,
          }}
        />
      ) : null}
      {watermark.text ? <span>{watermark.text}</span> : null}
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
