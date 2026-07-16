"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  measureTourTarget,
  placeTourPopover,
  resolvePlacement,
  type SpotlightRect,
} from "./spotlight";
import type { ProductTourLabels, ProductTourStep } from "./types";
import { useProductTour } from "./useProductTour";

const DEFAULT_LABELS: ProductTourLabels = {
  next: "下一步",
  back: "上一步",
  skip: "跳过",
  done: "开始使用",
  progress: "{current} / {total}",
};

const TOUR_Z = 9999;
const VIEW_PAD = 16;

function formatProgress(template: string, current: number, total: number): string {
  // next-intl missing-key fallback looks like "onboarding.tourProgress"
  if (!template || template.includes("tourProgress") || template.includes("onboarding.")) {
    return `${current} / ${total}`;
  }
  return template
    .replaceAll("{current}", String(current))
    .replaceAll("{total}", String(total));
}

export type ProductTourProps = {
  open: boolean;
  steps: ProductTourStep[];
  labels?: Partial<ProductTourLabels>;
  initialStep?: number;
  onComplete?: () => void;
  onSkip?: () => void;
  onClose?: () => void;
  /** Fires when the active step changes (including on open). */
  onStepChange?: (step: ProductTourStep, index: number) => void;
  className?: string;
};

/**
 * Product tour: body portal above all app chrome.
 * Spotlight hugs the target; card is measured and kept fully on-screen.
 */
export function ProductTour({
  open,
  steps,
  labels: labelsProp,
  initialStep = 0,
  onComplete,
  onSkip,
  onClose,
  onStepChange,
  className,
}: ProductTourProps) {
  const labels = useMemo(() => ({ ...DEFAULT_LABELS, ...labelsProp }), [labelsProp]);
  const { index, step, isFirst, isLast, next, back, skip, total } = useProductTour({
    steps,
    open,
    initialStep,
    onComplete,
    onSkip,
  });

  const [mounted, setMounted] = useState(false);
  const [targetRect, setTargetRect] = useState<SpotlightRect | null>(null);
  const [cardSize, setCardSize] = useState({ width: 360, height: 260 });
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !step) return;
    onStepChange?.(step, index);
  }, [open, step, index, onStepChange]);

  const remasureTarget = () => {
    if (!step) {
      setTargetRect(null);
      return;
    }
    setTargetRect(
      measureTourTarget(step.target, step.spotlightPadding ?? 6, {
        align: step.spotlightAlign,
        maxHeightRatio: step.spotlightMaxHeightRatio,
        maxHeightPx: step.spotlightMaxHeightPx,
        contentSelector: step.spotlightContentSelector,
        contentAxis: step.spotlightContentAxis,
        clampAboveTargetId: step.spotlightClampAbove,
      })
    );
  };

  useLayoutEffect(() => {
    if (!open || !step) return;
    remasureTarget();
    const id = step.target;
    if (id) {
      document
        .querySelector(`[data-ox-tour="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      // Panel switches (e.g. → Preview) need a couple of frames before the target is measurable.
      const t1 = window.setTimeout(remasureTarget, 80);
      const t2 = window.setTimeout(remasureTarget, 280);
      const t3 = window.setTimeout(remasureTarget, 520);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        window.clearTimeout(t3);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step?.id, step?.target, step?.panel]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => remasureTarget();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step?.id, step?.target]);

  // Measure the real card so placement uses true height (avoids bottom clipping).
  useLayoutEffect(() => {
    if (!open) return;
    const el = cardRef.current;
    if (!el) return;
    const sync = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      setCardSize((prev) =>
        Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1
          ? prev
          : { width: r.width, height: r.height }
      );
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, step?.id, index]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        (onClose ?? onSkip)?.();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, back, onClose, onSkip]);

  if (!mounted || !open || !step || total === 0) return null;

  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const maxCardH = Math.max(200, vh - VIEW_PAD * 2);
  const maxCardW = Math.min(360, vw - VIEW_PAD * 2);

  const placement = resolvePlacement(step.placement, targetRect, cardSize);
  const popover = placeTourPopover(placement, targetRect, {
    width: Math.min(cardSize.width, maxCardW),
    height: Math.min(cardSize.height, maxCardH),
  });
  const progress = formatProgress(labels.progress, index + 1, total);
  const hole = targetRect;
  const holeRadius = Math.max(8, Math.min(hole?.radius ?? 12, 20));
  const dismiss = () => (onClose ?? onSkip)?.();

  return createPortal(
    <div
      className={cn("fixed inset-0", className)}
      style={{ zIndex: TOUR_Z }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`ox-tour-title-${step.id}`}
      data-ox-product-tour=""
    >
      <button
        type="button"
        aria-label={labels.skip}
        className="absolute inset-0 cursor-default border-0 bg-transparent p-0"
        onClick={dismiss}
      >
        {hole ? (
          <>
            {/* Soft amber glow around the cutout */}
            <span
              aria-hidden
              className="pointer-events-none absolute transition-[top,left,width,height,border-radius] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                top: hole.top - 2,
                left: hole.left - 2,
                width: hole.width + 4,
                height: hole.height + 4,
                borderRadius: holeRadius + 2,
                boxShadow: "0 0 0 9999px rgba(4, 6, 10, 0.72)",
              }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute transition-[top,left,width,height,border-radius] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                top: hole.top,
                left: hole.left,
                width: hole.width,
                height: hole.height,
                borderRadius: holeRadius,
                boxShadow:
                  "0 0 0 2px rgba(247, 147, 26, 0.55), 0 0 0 6px rgba(247, 147, 26, 0.12), 0 0 28px rgba(247, 147, 26, 0.2)",
              }}
            />
          </>
        ) : (
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 55% at 50% 42%, rgba(20,24,32,0.35), rgba(4,6,10,0.82))",
            }}
          />
        )}
      </button>

      <div
        ref={cardRef}
        key={step.id}
        className={cn(
          "pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl",
          "border border-white/10 bg-[#0c0e12] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.92)]",
          "animate-in fade-in-0 zoom-in-95 duration-300"
        )}
        style={{
          zIndex: 2,
          top: popover.top,
          left: popover.left,
          width: maxCardW,
          maxHeight: maxCardH,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-[0.16em] text-primary/90">
                  {progress}
                </span>
                {step.eyebrow ? (
                  <>
                    <span className="text-white/15">·</span>
                    <span className="truncate font-mono text-[10px] tracking-[0.1em] text-muted-foreground/70 uppercase">
                      {step.eyebrow}
                    </span>
                  </>
                ) : null}
              </div>
              <h2
                id={`ox-tour-title-${step.id}`}
                className="font-heading text-[16px] font-semibold leading-snug tracking-tight text-foreground"
              >
                {step.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => skip()}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:bg-white/6 hover:text-foreground"
              aria-label={labels.skip}
              title={labels.skip}
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          <p className="text-[13px] leading-[1.6] text-muted-foreground/90">{step.description}</p>

          {(step.media?.src || step.media?.node) && (
            <div className="overflow-hidden rounded-xl border border-white/8">
              {step.media?.node ? (
                step.media.node
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={step.media!.src}
                  alt={step.media!.alt ?? ""}
                  className="h-28 w-full object-cover"
                />
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 pt-0.5">
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === index
                    ? "w-5 bg-primary shadow-[0_0_10px_rgba(247,147,26,0.4)]"
                    : i < index
                      ? "w-2.5 bg-primary/45"
                      : "w-2.5 bg-white/8"
                )}
                aria-hidden
              />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/8 px-4 py-3">
          <button
            type="button"
            onClick={() => skip()}
            className="rounded-lg px-2 py-2 text-[12px] text-muted-foreground/80 transition-colors hover:text-foreground"
          >
            {labels.skip}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={back}
              disabled={isFirst}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/3 px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-white/6 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
              {labels.back}
            </button>
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-[0_0_20px_-6px_rgba(247,147,26,0.5)] transition-opacity hover:opacity-95"
            >
              {isLast ? labels.done : labels.next}
              {!isLast ? <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} /> : null}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
