"use client";

import { Video } from "@remotion/media";
import {
  linearTiming,
  TransitionSeries,
  type TransitionPresentation,
} from "@remotion/transitions";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { fade } from "@remotion/transitions/fade";
import { iris } from "@remotion/transitions/iris";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { ReelCompositionInput } from "./schema";
import {
  getBgmVolume,
  getBrandWatermarkWindow,
  getFinalCaptionWindow,
  getSceneNarrationWindow,
  getTransitionDurationFrames,
  NARRATION_MIX_VOLUME,
} from "./schema";

export function ReelComposition(input: ReelCompositionInput) {
  const { fps } = useVideoConfig();
  const brandWindow = getBrandWatermarkWindow(input, fps);
  const sceneLayers = input.scenes.flatMap((scene, index) => {
    const transitionDurationInFrames =
      index === 0 ? 0 : getTransitionDurationFrames(scene, fps);
    const sceneDurationInFrames = Math.max(
      1,
      Math.round(scene.durationSec * fps),
    );
    const sequenceDurationInFrames =
      sceneDurationInFrames + transitionDurationInFrames;
    const narrationWindow = getSceneNarrationWindow(scene, fps);
    const layers = [];

    if (transitionDurationInFrames > 0) {
      layers.push(
        <TransitionSeries.Transition
          key={`transition-${index}`}
          presentation={transitionPresentation(scene.transitionStyle)}
          timing={linearTiming({
            durationInFrames: transitionDurationInFrames,
          })}
        />,
      );
    }

    layers.push(
      <TransitionSeries.Sequence
        durationInFrames={sequenceDurationInFrames}
        key={`${scene.videoUrl}-${index}`}
      >
        <SceneLayer
          caption={scene.captionText}
          contentStartFrame={transitionDurationInFrames}
          playbackRate={sceneDurationInFrames / sequenceDurationInFrames}
          scene={scene}
          safeZonePreset={input.safeZonePreset}
          showCaption={index === input.scenes.length - 1}
        />
        {scene.narration && narrationWindow ? (
          <Sequence
            durationInFrames={narrationWindow.durationInFrames}
            from={
              transitionDurationInFrames +
              Math.max(0, Math.round(scene.narration.offsetSec * fps))
            }
          >
            <Audio
              playbackRate={scene.narration.playbackRate}
              src={scene.narration.audioUrl}
              volume={(frame) =>
                narrationEnvelope(frame, narrationWindow.durationInFrames, fps)
              }
            />
          </Sequence>
        ) : null}
      </TransitionSeries.Sequence>,
    );

    return layers;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#080b10" }}>
      <TransitionSeries>{sceneLayers}</TransitionSeries>

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

  return (
    <Audio loop src={input.bgmUrl!} volume={getBgmVolume(input, frame, fps)} />
  );
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
  showCaption,
  contentStartFrame,
  playbackRate,
}: {
  scene: ReelCompositionInput["scenes"][number];
  caption: string;
  safeZonePreset: ReelCompositionInput["safeZonePreset"];
  showCaption: boolean;
  contentStartFrame: number;
  playbackRate: number;
}) {
  const currentFrame = useCurrentFrame();
  const frame = Math.max(0, currentFrame - contentStartFrame);
  const { fps } = useVideoConfig();
  const captionWindow = getFinalCaptionWindow(scene, fps);
  const captionFrame = frame - captionWindow.from;
  const captionIsVisible =
    showCaption &&
    captionFrame >= 0 &&
    captionFrame < captionWindow.durationInFrames;

  return (
    <AbsoluteFill>
      <Video
        delayRenderRetries={2}
        delayRenderTimeoutInMilliseconds={120_000}
        muted
        objectFit="cover"
        playbackRate={playbackRate}
        src={scene.videoUrl}
        style={{
          height: "100%",
          width: "100%",
        }}
      />
      {captionIsVisible ? (
        <FinalCaption
          caption={caption}
          frame={captionFrame}
          safeZonePreset={safeZonePreset}
        />
      ) : null}
    </AbsoluteFill>
  );
}

function FinalCaption({
  caption,
  frame,
  safeZonePreset,
}: {
  caption: string;
  frame: number;
  safeZonePreset: ReelCompositionInput["safeZonePreset"];
}) {
  const { fps } = useVideoConfig();
  const entrance = spring({
    frame,
    fps,
    config: { damping: 24, mass: 0.9, stiffness: 120 },
    durationInFrames: Math.max(1, Math.round(fps * 0.55)),
  });
  const fade = interpolate(frame, [0, Math.max(1, fps * 0.32)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const blur = interpolate(entrance, [0, 1], [10, 0]);
  const rise = interpolate(entrance, [0, 1], [34, 0]);
  const accentScale = interpolate(entrance, [0, 1], [0.12, 1]);
  const fontSize = caption.length > 82 ? 50 : caption.length > 52 ? 57 : 66;

  return (
    <div style={captionPositionStyle(safeZonePreset)}>
      <div
        style={{
          background:
            "radial-gradient(circle at 18% 0%, rgba(255,255,255,0.11), transparent 38%), linear-gradient(135deg, rgba(7,10,16,0.84), rgba(12,15,22,0.66))",
          backdropFilter: "blur(22px) saturate(115%)",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 30,
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.14), 0 30px 100px rgba(0,0,0,0.48)",
          opacity: fade,
          overflow: "hidden",
          padding: "30px 34px 32px",
          position: "relative",
          transform: `translateY(${rise}px)`,
          WebkitBackdropFilter: "blur(22px) saturate(115%)",
        }}
      >
        <div
          style={{
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.95), rgba(207,216,230,0.52), transparent)",
            borderRadius: 999,
            height: 3,
            marginBottom: 22,
            opacity: 0.88,
            transform: `scaleX(${accentScale})`,
            transformOrigin: "left center",
            width: 154,
          }}
        />
        <div
          style={{
            background:
              "linear-gradient(180deg, #ffffff 0%, #f8f9fc 58%, #dce2eb 100%)",
            backgroundClip: "text",
            color: "white",
            filter: `blur(${blur}px)`,
            fontFamily:
              '"Helvetica Neue", "Inter", "Avenir Next", Arial, sans-serif',
            fontSize,
            fontWeight: 760,
            letterSpacing: -1.8,
            lineHeight: 1.08,
            overflowWrap: "anywhere",
            textAlign: "left",
            textShadow: "0 4px 30px rgba(0,0,0,0.42)",
            transform: `translateY(${rise * 0.45}px)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {caption}
        </div>
      </div>
    </div>
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
        <Img
          alt=""
          delayRenderTimeoutInMilliseconds={120_000}
          maxRetries={4}
          pauseWhenLoading
          src={watermark.logoUrl}
          style={{
            borderRadius: 8,
            height: 174,
            maxWidth: 720,
            objectFit: "contain",
            width: "auto",
          }}
        />
      ) : null}
      {!watermark.logoUrl && watermark.text ? (
        <span style={{ maxWidth: 420 }}>{watermark.text}</span>
      ) : null}
    </div>
  );
}

function transitionPresentation(
  style: ReelCompositionInput["scenes"][number]["transitionStyle"],
): TransitionPresentation<Record<string, unknown>> {
  switch (style) {
    case "FADE":
      return fade({
        shouldFadeOutExitingScene: true,
      }) as unknown as TransitionPresentation<Record<string, unknown>>;
    case "SLIDE":
      return slide({
        direction: "from-right",
      }) as unknown as TransitionPresentation<Record<string, unknown>>;
    case "WIPE":
      return wipe({
        direction: "from-left",
      }) as unknown as TransitionPresentation<Record<string, unknown>>;
    case "IRIS":
      return iris({
        width: 1080,
        height: 1920,
      }) as unknown as TransitionPresentation<Record<string, unknown>>;
    case "CLOCK_WIPE":
      return clockWipe({
        width: 1080,
        height: 1920,
      }) as unknown as TransitionPresentation<Record<string, unknown>>;
    default:
      return fade({
        shouldFadeOutExitingScene: true,
      }) as unknown as TransitionPresentation<Record<string, unknown>>;
  }
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

function captionPositionStyle(
  safeZonePreset: ReelCompositionInput["safeZonePreset"],
) {
  const bottom =
    safeZonePreset === "NONE"
      ? 120
      : safeZonePreset === "YOUTUBE_SHORTS"
        ? 310
        : 360;

  return {
    bottom,
    left: "50%",
    position: "absolute" as const,
    transform: "translateX(-50%)",
    width: 900,
  };
}
