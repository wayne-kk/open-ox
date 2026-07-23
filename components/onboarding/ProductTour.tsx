"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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

function formatProgress(
  template: string,
  current: number,
  total: number,
): string {
  // next-intl missing-key fallback looks like "onboarding.tourProgress"
  if (
    !template ||
    template.includes("tourProgress") ||
    template.includes("onboarding.")
  ) {
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
  const labels = useMemo(
    () => ({ ...DEFAULT_LABELS, ...labelsProp }),
    [labelsProp],
  );
  const { index, step, isFirst, isLast, next, back, skip, total } =
    useProductTour({
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
  const previousIndexRef = useRef(index);
  const reduceMotion = useReducedMotion();
  const direction = index >= previousIndexRef.current ? 1 : -1;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !step) return;
    onStepChange?.(step, index);
  }, [open, step, index, onStepChange]);

  useEffect(() => {
    previousIndexRef.current = index;
  }, [index]);

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
      }),
    );
  };

  useLayoutEffect(() => {
    if (!open || !step) return;
    remasureTarget();
    const id = step.target;
    if (id) {
      document
        .querySelector(`[data-ox-tour="${CSS.escape(id)}"]`)
        ?.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "smooth",
        });
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
        Math.abs(prev.width - r.width) < 1 &&
        Math.abs(prev.height - r.height) < 1
          ? prev
          : { width: r.width, height: r.height },
      );
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mounted, open, step?.id, index]);

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
  const isCentered = !step.target || step.placement === "center";
  const hasMedia = Boolean(step.media?.src || step.media?.node);
  const maxCardW = Math.min(
    isCentered && hasMedia ? 920 : isCentered ? 620 : 380,
    vw - VIEW_PAD * 2,
  );

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
            <motion.span
              aria-hidden
              className="pointer-events-none absolute"
              initial={false}
              animate={{
                top: hole.top - 2,
                left: hole.left - 2,
                width: hole.width + 4,
                height: hole.height + 4,
                borderRadius: holeRadius + 2,
              }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 30, mass: 0.8 }
              }
              style={{
                boxShadow: "0 0 0 9999px rgba(4, 6, 10, 0.72)",
              }}
            />
            <motion.span
              aria-hidden
              className="pointer-events-none absolute"
              initial={false}
              animate={{
                top: hole.top,
                left: hole.left,
                width: hole.width,
                height: hole.height,
                borderRadius: holeRadius,
              }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 260, damping: 30, mass: 0.8 }
              }
              style={{
                boxShadow:
                  "0 0 0 2px rgba(247, 147, 26, 0.55), 0 0 0 6px rgba(247, 147, 26, 0.12), 0 0 28px rgba(247, 147, 26, 0.2)",
              }}
            >
              <motion.span
                key={step.id}
                aria-hidden
                className="absolute inset-0 rounded-[inherit] border border-primary/70"
                animate={
                  reduceMotion
                    ? undefined
                    : { opacity: [0.75, 0.16], scale: [1, 1.025] }
                }
                transition={{
                  duration: 0.7,
                  ease: "easeOut",
                }}
              />
            </motion.span>
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

      <motion.div
        ref={cardRef}
        layout={!reduceMotion}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 18 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
        }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                layout: {
                  type: "spring",
                  stiffness: 260,
                  damping: 30,
                  mass: 0.85,
                },
                opacity: { duration: 0.2 },
                scale: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                y: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
              }
        }
        className={cn(
          "pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl",
          "border border-white/10 bg-[#0b0d11]/98 shadow-[0_32px_100px_-24px_rgba(0,0,0,0.96)]",
        )}
        style={{
          zIndex: 2,
          top: popover.top,
          left: popover.left,
          width: maxCardW,
          maxHeight: maxCardH,
          willChange: reduceMotion ? undefined : "transform",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <motion.div
          key={`sweep-${step.id}`}
          aria-hidden
          className="pointer-events-none absolute inset-x-10 top-0 z-20 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent"
          animate={
            reduceMotion
              ? undefined
              : { opacity: [0, 1, 0.3], scaleX: [0.2, 1, 0.6] }
          }
          transition={{ duration: 0.8, ease: "easeOut" }}
        />

        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={step.id}
            custom={direction}
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 36 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * -28 }
            }
            transition={
              reduceMotion
                ? { duration: 0.08 }
                : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
            }
            className="flex min-h-0 flex-1 flex-col"
            style={{
              willChange: reduceMotion ? undefined : "transform, opacity",
            }}
          >
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto",
                isCentered && hasMedia
                  ? "grid md:grid-cols-[minmax(0,0.88fr)_minmax(360px,1.12fr)]"
                  : isCentered
                    ? "p-6 sm:p-8"
                    : "p-5",
              )}
            >
              <div
                className={cn(
                  "relative flex min-w-0 flex-col",
                  isCentered && hasMedia ? "p-6 sm:p-8 md:p-10" : "",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      "min-w-0",
                      isCentered ? "space-y-4" : "space-y-2",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-mono tracking-[0.16em] text-primary/90",
                          isCentered ? "text-xs" : "text-[10px]",
                        )}
                      >
                        {progress}
                      </span>
                      {step.eyebrow ? (
                        <>
                          <span className="text-white/15">·</span>
                          <span
                            className={cn(
                              "truncate font-mono tracking-[0.1em] text-muted-foreground/70 uppercase",
                              isCentered ? "text-xs" : "text-[10px]",
                            )}
                          >
                            {step.eyebrow}
                          </span>
                        </>
                      ) : null}
                    </div>
                    <h2
                      id={`ox-tour-title-${step.id}`}
                      className={cn(
                        "font-heading font-semibold tracking-[-0.025em] text-foreground text-balance",
                        isCentered
                          ? "text-2xl leading-[1.15] sm:text-[32px]"
                          : "text-lg leading-snug",
                      )}
                    >
                      {step.title}
                    </h2>
                    {isCentered ? (
                      <p className="max-w-[34rem] text-[15px] leading-7 text-muted-foreground/90 text-pretty sm:text-base">
                        {step.description}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => skip()}
                    className="shrink-0 rounded-xl p-2 text-muted-foreground/70 transition-all duration-200 hover:bg-white/6 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    aria-label={labels.skip}
                    title={labels.skip}
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
                {!isCentered ? (
                  <p className="mt-3 text-[13px] leading-[1.65] text-muted-foreground/90 text-pretty">
                    {step.description}
                  </p>
                ) : null}

                <div
                  className={cn(
                    "mt-auto flex items-center gap-1.5",
                    isCentered ? "pt-8" : "pt-4",
                  )}
                >
                  {steps.map((s, i) => (
                    <span
                      key={s.id}
                      className={cn(
                        "h-1 rounded-full transition-all duration-300",
                        i === index
                          ? "w-8 bg-primary shadow-[0_0_12px_rgba(247,147,26,0.5)]"
                          : i < index
                            ? "w-3 bg-primary/45"
                            : "w-3 bg-white/10",
                      )}
                      aria-hidden
                    />
                  ))}
                </div>
              </div>

              {hasMedia ? (
                <div
                  className={cn(
                    "relative overflow-hidden",
                    isCentered
                      ? "min-h-56 border-t border-white/8 md:min-h-[420px] md:border-t-0 md:border-l"
                      : "mx-5 mb-5 mt-0 h-32 rounded-xl border border-white/8",
                  )}
                >
                  <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(90deg,rgba(11,13,17,0.52),transparent_22%),linear-gradient(0deg,rgba(11,13,17,0.5),transparent_38%)] md:block" />
                  {step.media?.node ? (
                    step.media.node
                  ) : (
                    <motion.img
                      src={step.media!.src}
                      alt={step.media!.alt ?? ""}
                      initial={
                        reduceMotion
                          ? false
                          : { scale: 1.06, x: direction * 12 }
                      }
                      animate={{ scale: 1, x: 0 }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full w-full object-cover object-center"
                      style={{
                        willChange: reduceMotion ? undefined : "transform",
                      }}
                    />
                  )}
                </div>
              ) : null}
            </div>

            <div
              className={cn(
                "flex shrink-0 items-center justify-between gap-3 border-t border-white/8",
                isCentered ? "px-6 py-4 sm:px-8" : "px-5 py-3.5",
              )}
            >
              <button
                type="button"
                onClick={() => skip()}
                className="rounded-lg px-2 py-2 text-[12px] text-muted-foreground/80 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                {labels.skip}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={back}
                  disabled={isFirst}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/3 px-4 py-2.5 text-[12px] font-medium text-muted-foreground transition-all duration-200 hover:bg-white/6 hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:pointer-events-none disabled:opacity-30"
                >
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {labels.back}
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-[0_0_24px_-6px_rgba(247,147,26,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d11]"
                >
                  {isLast ? labels.done : labels.next}
                  {!isLast ? (
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                  ) : null}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body,
  );
}
