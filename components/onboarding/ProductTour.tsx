"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
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

export type ProductTourProps = {
  open: boolean;
  steps: ProductTourStep[];
  labels?: Partial<ProductTourLabels>;
  initialStep?: number;
  onComplete?: () => void;
  onSkip?: () => void;
  onClose?: () => void;
  className?: string;
};

/**
 * Mainstream product tour: body portal + dim overlay + spotlight + step card.
 * Host DOM untouched — targets via `[data-ox-tour]`. Media slot ready for images.
 */
export function ProductTour({
  open,
  steps,
  labels: labelsProp,
  initialStep = 0,
  onComplete,
  onSkip,
  onClose,
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

  useEffect(() => setMounted(true), []);

  const remasure = () => {
    if (!step) {
      setTargetRect(null);
      return;
    }
    setTargetRect(measureTourTarget(step.target, step.spotlightPadding ?? 12));
  };

  useLayoutEffect(() => {
    if (!open || !step) return;
    remasure();
    const id = step.target;
    if (id) {
      document
        .querySelector(`[data-ox-tour="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step?.id, step?.target]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => remasure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step?.id, step?.target]);

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

  const placement = resolvePlacement(step.placement, targetRect);
  const isCenter = placement === "center" || !targetRect;
  const cardW = isCenter ? 420 : 380;
  const popover = placeTourPopover(placement, targetRect, {
    width: cardW,
    height: step.media?.src || step.media?.node ? 420 : 300,
  });
  const progress = labels.progress
    .replace("{current}", String(index + 1))
    .replace("{total}", String(total));
  const hole = targetRect;
  const stepNo = String(index + 1).padStart(2, "0");

  return createPortal(
    <div
      className={cn("fixed inset-0 z-[200]", className)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`ox-tour-title-${step.id}`}
      data-ox-product-tour=""
    >
      <div className="absolute inset-0" onClick={() => (onClose ?? onSkip)?.()} aria-hidden>
        {hole ? (
          <>
            <div
              className="pointer-events-none absolute rounded-2xl transition-[top,left,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                top: hole.top,
                left: hole.left,
                width: hole.width,
                height: hole.height,
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.22), 0 0 0 9999px rgba(4,6,10,0.72), 0 0 48px rgba(247,147,26,0.12)",
              }}
            />
            <div
              className="pointer-events-none absolute rounded-2xl ring-1 ring-primary/35 transition-[top,left,width,height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                top: hole.top,
                left: hole.left,
                width: hole.width,
                height: hole.height,
              }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 55% at 50% 42%, rgba(20,24,32,0.35), rgba(4,6,10,0.82))",
            }}
          />
        )}
      </div>

      <div
        key={step.id}
        className={cn(
          "pointer-events-auto absolute overflow-hidden rounded-2xl",
          "border border-white/[0.08] bg-[#0c0e12]/96 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.04)]",
          "backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-300"
        )}
        style={{
          top: popover.top,
          left: popover.left,
          width: `min(${cardW}px, calc(100vw - 24px))`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media / designed placeholder */}
        <div className="relative h-[148px] overflow-hidden border-b border-white/[0.06]">
          {step.media?.node ? (
            step.media.node
          ) : step.media?.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={step.media.src}
              alt={step.media.alt ?? ""}
              className="h-full w-full object-cover"
            />
          ) : (
            <TourMediaPlaceholder stepNo={stepNo} title={step.title} />
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0c0e12] to-transparent" />
        </div>

        <div className="space-y-4 p-5 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-[0.18em] text-primary/90">
                  {progress}
                </span>
                {step.eyebrow ? (
                  <>
                    <span className="text-white/15">·</span>
                    <span className="truncate font-mono text-[10px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                      {step.eyebrow}
                    </span>
                  </>
                ) : null}
              </div>
              <h2
                id={`ox-tour-title-${step.id}`}
                className="font-heading text-[18px] font-semibold leading-snug tracking-tight text-foreground"
              >
                {step.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => skip()}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:bg-white/[0.06] hover:text-foreground"
              aria-label={labels.skip}
              title={labels.skip}
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          <p className="text-[13.5px] leading-[1.65] text-muted-foreground/90">{step.description}</p>

          <div className="flex items-center gap-1.5">
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === index
                    ? "w-6 bg-primary shadow-[0_0_12px_rgba(247,147,26,0.45)]"
                    : i < index
                      ? "w-3 bg-primary/45"
                      : "w-3 bg-white/[0.08]"
                )}
                aria-hidden
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 pt-0.5">
            <button
              type="button"
              onClick={back}
              disabled={isFirst}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
              {labels.back}
            </button>
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-[0_0_24px_-6px_rgba(247,147,26,0.55)] transition-opacity hover:opacity-95"
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

function TourMediaPlaceholder({ stepNo, title }: { stepNo: string; title: string }) {
  return (
    <div className="relative flex h-full w-full items-end overflow-hidden bg-[#10131a]">
      <div
        aria-hidden
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 18% 20%, rgba(247,147,26,0.18), transparent 55%), radial-gradient(ellipse 60% 50% at 88% 70%, rgba(100,120,180,0.12), transparent 50%), linear-gradient(160deg, #12161f 0%, #0a0c10 100%)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="relative z-[1] flex w-full items-end justify-between gap-3 px-5 pb-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-primary/80">{stepNo}</p>
          <p className="mt-1 max-w-[240px] truncate text-[12px] text-white/55">{title}</p>
        </div>
        <div className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" />
      </div>
    </div>
  );
}
