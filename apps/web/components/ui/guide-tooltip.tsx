"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type TooltipSide = "top" | "bottom";

type TooltipPosition = {
  arrowLeft: number;
  left: number;
  side: TooltipSide;
  top: number;
};

const VIEWPORT_GUTTER = 12;
const TOOLTIP_GAP = 10;
const HOVER_DELAY_MS = 420;

export function GuideTooltip({
  children,
  className,
  content,
  side = "top",
}: {
  children: ReactElement<Record<string, unknown>>;
  className?: string;
  content: string;
  side?: TooltipSide;
}) {
  const descriptionId = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);

  const clearOpenTimer = useCallback(() => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearOpenTimer();
    setIsOpen(false);
    setPosition(null);
  }, [clearOpenTimer]);

  const open = useCallback(
    (delay: number) => {
      clearOpenTimer();
      openTimerRef.current = window.setTimeout(() => {
        setIsOpen(true);
        openTimerRef.current = null;
      }, delay);
    },
    [clearOpenTimer],
  );

  const updatePosition = useCallback(() => {
    const trigger = wrapperRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;

    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const hasRoomAbove =
      triggerRect.top >= tooltipRect.height + TOOLTIP_GAP + VIEWPORT_GUTTER;
    const hasRoomBelow =
      window.innerHeight - triggerRect.bottom >=
      tooltipRect.height + TOOLTIP_GAP + VIEWPORT_GUTTER;
    const resolvedSide =
      side === "top" && !hasRoomAbove && hasRoomBelow
        ? "bottom"
        : side === "bottom" && !hasRoomBelow && hasRoomAbove
          ? "top"
          : side;
    const triggerCenter = triggerRect.left + triggerRect.width / 2;
    const maxLeft = Math.max(
      VIEWPORT_GUTTER,
      window.innerWidth - tooltipRect.width - VIEWPORT_GUTTER,
    );
    const left = Math.min(
      Math.max(triggerCenter - tooltipRect.width / 2, VIEWPORT_GUTTER),
      maxLeft,
    );
    const top =
      resolvedSide === "top"
        ? triggerRect.top - tooltipRect.height - TOOLTIP_GAP
        : triggerRect.bottom + TOOLTIP_GAP;
    const arrowLeft = Math.min(
      Math.max(triggerCenter - left, 18),
      Math.max(18, tooltipRect.width - 18),
    );

    setPosition({ arrowLeft, left, side: resolvedSide, top });
  }, [side]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => clearOpenTimer, [clearOpenTimer]);

  const existingDescription = children.props["aria-describedby"];
  const describedBy = [
    typeof existingDescription === "string" ? existingDescription : null,
    descriptionId,
  ]
    .filter(Boolean)
    .join(" ");
  const trigger = cloneElement(children, {
    "aria-describedby": describedBy,
  });

  return (
    <span
      className={cn("inline-flex max-w-full", className)}
      data-slot="guide-tooltip-trigger"
      data-state={isOpen ? "open" : "closed"}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
      onFocusCapture={() => open(0)}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") close();
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") open(HOVER_DELAY_MS);
      }}
      onPointerLeave={close}
      ref={wrapperRef}
    >
      {trigger}
      <span className="sr-only" id={descriptionId} role="tooltip">
        {content}
      </span>
      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              aria-hidden="true"
              className="guide-tooltip pointer-events-none fixed z-[100] w-max max-w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-white/10 bg-[#171a18]/95 px-3.5 py-3 text-left shadow-[0_18px_50px_rgba(0,0,0,0.48)] backdrop-blur-xl"
              data-side={position?.side ?? side}
              ref={tooltipRef}
              style={{
                left: position?.left ?? 0,
                opacity: position ? 1 : 0,
                top: position?.top ?? 0,
              }}
            >
              <span className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-primary">
                <span className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(183,255,60,0.75)]" />
                Reel AI guide
              </span>
              <span className="block text-xs leading-5 text-[#e7ebe5]">
                {content}
              </span>
              <span
                className="absolute size-2 rotate-45 border-white/10 bg-[#171a18]"
                style={{
                  borderBottomWidth: position?.side === "top" ? 1 : 0,
                  borderRightWidth: position?.side === "top" ? 1 : 0,
                  borderTopWidth: position?.side === "bottom" ? 1 : 0,
                  borderLeftWidth: position?.side === "bottom" ? 1 : 0,
                  bottom: position?.side === "top" ? -5 : undefined,
                  left: (position?.arrowLeft ?? 24) - 4,
                  top: position?.side === "bottom" ? -5 : undefined,
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

export type { TooltipSide };
