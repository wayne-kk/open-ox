"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Loader2, Undo2, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignModeElementRect, DesignModeProperty } from "@/lib/studio/designMode/protocol";
import { computeFloatingEditorPosition } from "@/lib/studio/designMode/floatingEditorPosition";
import { colorToHex, parsePx, type UseDesignModeResult } from "../hooks/useDesignMode";

interface DesignModePreviewOverlayProps {
  designMode: UseDesignModeResult;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const FALLBACK_ANCHOR: DesignModeElementRect = { top: 72, left: 24, width: 160, height: 28 };

function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">{label}</span>
      {children}
    </div>
  );
}

export function DesignModePreviewOverlay({
  designMode,
  iframeRef,
  containerRef,
}: DesignModePreviewOverlayProps) {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 16, left: 16 });

  const {
    active,
    bridgeReady,
    bridgeError,
    selected,
    anchorRect,
    styles,
    textContent,
    canEditText,
    applyHint,
    patching,
    updateStyle,
    updateText,
    applyDirectPatch,
    undoLastApply,
    clearSelection,
  } = designMode;

  const editorOpen = active && bridgeReady && selected;
  const effectiveRect = anchorRect ?? FALLBACK_ANCHOR;

  useLayoutEffect(() => {
    if (!editorOpen) return;

    const updatePosition = () => {
      const container = containerRef.current;
      const iframe = iframeRef.current;
      const popup = popupRef.current;
      if (!container || !iframe) return;

      const containerRect = container.getBoundingClientRect();
      const iframeRect = iframe.getBoundingClientRect();
      const popupWidth = popup?.offsetWidth ?? 320;
      const popupHeight = popup?.offsetHeight ?? 360;

      const next = computeFloatingEditorPosition(
        effectiveRect,
        {
          top: iframeRect.top - containerRect.top,
          left: iframeRect.left - containerRect.left,
        },
        { width: containerRect.width, height: containerRect.height },
        { width: popupWidth, height: popupHeight }
      );
      setPosition(next);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [anchorRect, containerRef, editorOpen, effectiveRect, iframeRef, selected, styles, textContent]);

  if (!active) return null;

  const colorHex = colorToHex(styles.color);
  const fontSizePx = parsePx(styles.fontSize, 16);
  const paddingPx = parsePx(styles.padding, 0);
  const radiusPx = parsePx(styles.borderRadius, 0);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {!bridgeReady && !bridgeError ? (
        <div className="pointer-events-auto absolute left-3 top-3 max-w-[min(360px,calc(100%-24px))] rounded-lg border border-white/10 bg-background/90 px-3 py-2 font-mono text-[10px] text-muted-foreground/80 shadow-lg backdrop-blur-md">
          Connecting preview bridge…
        </div>
      ) : null}

      {bridgeError ? (
        <div className="pointer-events-auto absolute left-3 top-3 max-w-[min(420px,calc(100%-24px))] rounded-lg border border-red-500/30 bg-background/95 px-3 py-2 font-mono text-[10px] text-red-300/90 shadow-lg backdrop-blur-md">
          {bridgeError}
        </div>
      ) : null}

      {active && bridgeReady && !selected ? (
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-primary/25 bg-background/80 px-3 py-2 font-mono text-[10px] text-primary/80 shadow-lg backdrop-blur-md">
          Click an element in the preview
        </div>
      ) : null}

      {editorOpen && selected ? (
        <div
          ref={popupRef}
          className={cn(
            "pointer-events-auto absolute w-[min(320px,calc(100%-24px))]",
            "rounded-xl border border-white/12 bg-background/95 shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          )}
          style={{ top: position.top, left: position.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 border-b border-white/8 px-3 py-2">
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-widest text-primary/60">Design Mode</p>
              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/80 truncate" title={selected.selectorHint}>
                {selected.selectorHint}
              </p>
              {selected.source ? (
                <>
                  <p className="mt-0.5 font-mono text-[9px] text-emerald-400/80 truncate" title={selected.source.file}>
                    source: {selected.source.file}:{selected.source.line}
                  </p>
                  {selected.textKind && selected.textKind !== "static" ? (
                    <p className="mt-0.5 font-mono text-[9px] text-amber-400/80">
                      {selected.textKind} text — Modify fallback may be required
                    </p>
                  ) : null}
                </>
              ) : selected.oxId ? (
                <p className="mt-0.5 font-mono text-[9px] text-emerald-400/80 truncate" title={selected.oxId}>
                  legacy anchor: {selected.oxId}
                </p>
              ) : (
                <p className="mt-0.5 font-mono text-[9px] text-amber-400/80">
                  No source map — rebuild preview
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className="shrink-0 rounded-md border border-white/10 p-1 text-muted-foreground hover:text-foreground"
              aria-label="Close editor"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-3 px-3 py-3">
            {canEditText ? (
              <PropertyRow label="Copy / 文案">
                <textarea
                  rows={2}
                  value={textContent}
                  onChange={(e) => updateText(e.target.value)}
                  className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-[12px] text-foreground outline-none focus:border-primary/40"
                />
              </PropertyRow>
            ) : null}

            <div className="grid grid-cols-2 gap-2.5">
              <PropertyRow label="Color">
                <input
                  type="color"
                  value={colorHex}
                  onChange={(e) => updateStyle("color" satisfies DesignModeProperty, e.target.value)}
                  className="h-8 w-full cursor-pointer rounded-md border border-white/10 bg-transparent"
                />
              </PropertyRow>
              <PropertyRow label={`Size (${fontSizePx}px)`}>
                <input
                  type="range"
                  min={10}
                  max={96}
                  value={fontSizePx}
                  onChange={(e) => updateStyle("fontSize", `${e.target.value}px`)}
                  className="w-full accent-primary"
                />
              </PropertyRow>
              <PropertyRow label={`Padding (${paddingPx}px)`}>
                <input
                  type="range"
                  min={0}
                  max={96}
                  value={paddingPx}
                  onChange={(e) => updateStyle("padding", `${e.target.value}px`)}
                  className="w-full accent-primary"
                />
              </PropertyRow>
              <PropertyRow label={`Radius (${radiusPx}px)`}>
                <input
                  type="range"
                  min={0}
                  max={48}
                  value={radiusPx}
                  onChange={(e) => updateStyle("borderRadius", `${e.target.value}px`)}
                  className="w-full accent-primary"
                />
              </PropertyRow>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={patching}
                onClick={() => void applyDirectPatch()}
                className="defi-button px-3 py-1.5 text-[10px] font-medium flex items-center gap-1.5 disabled:opacity-40"
              >
                {patching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                {patching ? "Saving…" : "Apply to source"}
              </button>
              <button
                type="button"
                disabled
                onClick={undoLastApply}
                className="defi-button-outline px-3 py-1.5 text-[10px] font-medium flex items-center gap-1.5 disabled:opacity-40"
                title="Undo not available for direct patch yet"
              >
                <Undo2 className="h-3 w-3" />
                Undo
              </button>
            </div>

            {applyHint ? <p className="font-mono text-[10px] text-primary/75">{applyHint}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
