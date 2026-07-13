"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Code2, Loader2, Undo2, Wand2, X } from "lucide-react";
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

const PROPERTY_META: Record<DesignModeProperty, { label: string; unit: string }> = {
  color: { label: "Color", unit: "" },
  fontSize: { label: "Size", unit: "px" },
  padding: { label: "Padding", unit: "px" },
  borderRadius: { label: "Radius", unit: "px" },
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-medium text-muted-foreground">{children}</span>;
}

function MappedChip({ utility }: { utility: string }) {
  return (
    <span
      className="inline-flex max-w-full truncate rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary"
      title={utility}
    >
      {utility}
    </span>
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
    className,
    mappedUtilities,
    textContent,
    canEditText,
    applyHint,
    patching,
    canDirectPatch,
    directEditCapable,
    precheckReason,
    showModifyHandoff,
    updateStyle,
    updateText,
    updateClassName,
    applyDirectPatch,
    handoffToModify,
    undoLastApply,
    clearSelection,
  } = designMode;

  /** Floating Direct editor only when local + Direct env. */
  const editorOpen = active && bridgeReady && selected && directEditCapable;
  const showSelectionPill = active && bridgeReady && Boolean(selected);
  const effectiveRect = anchorRect ?? FALLBACK_ANCHOR;
  const mappedEntries = Object.entries(mappedUtilities) as Array<[DesignModeProperty, string]>;
  /** Freeze panel while editing the same element - RECT_UPDATED from size/style tweaks must not bounce the popup. */
  const selectionKey = selected
    ? `${selected.source?.file ?? ""}:${selected.source?.line ?? ""}:${selected.source?.column ?? ""}:${selected.selectorHint}`
    : null;
  const lockedForSelectionRef = useRef<string | null>(null);
  const placeRectRef = useRef(effectiveRect);
  placeRectRef.current = effectiveRect;

  useLayoutEffect(() => {
    if (!editorOpen || !selectionKey) {
      lockedForSelectionRef.current = null;
      return;
    }

    const place = (force: boolean) => {
      if (!force && lockedForSelectionRef.current === selectionKey) return;

      const container = containerRef.current;
      const iframe = iframeRef.current;
      const popup = popupRef.current;
      if (!container || !iframe) return;

      const containerRect = container.getBoundingClientRect();
      const iframeRect = iframe.getBoundingClientRect();
      const popupWidth = popup?.offsetWidth ?? 360;
      const popupHeight = popup?.offsetHeight ?? 480;
      const rect = placeRectRef.current;

      const next = computeFloatingEditorPosition(
        rect,
        {
          top: iframeRect.top - containerRect.top,
          left: iframeRect.left - containerRect.left,
        },
        { width: containerRect.width, height: containerRect.height },
        { width: popupWidth, height: popupHeight }
      );
      lockedForSelectionRef.current = selectionKey;
      setPosition(next);
    };

    place(lockedForSelectionRef.current !== selectionKey);

    const onResize = () => {
      lockedForSelectionRef.current = null;
      place(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [containerRef, editorOpen, iframeRef, selectionKey]);

  if (!active) return null;

  const colorHex = colorToHex(styles.color);
  const fontSizePx = parsePx(styles.fontSize, 16);
  const paddingPx = parsePx(styles.padding, 0);
  const radiusPx = parsePx(styles.borderRadius, 0);
  const sourceLabel = selected?.source
    ? `${selected.source.file.split("/").pop()}:${selected.source.line}`
    : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {!bridgeReady && !bridgeError ? (
        <div className="pointer-events-auto absolute left-3 top-3 max-w-[min(360px,calc(100%-24px))] rounded-xl border border-border bg-popover/95 px-3 py-2 text-[11px] text-muted-foreground shadow-[var(--box-shadow-neon-lg)] backdrop-blur-xl">
          Connecting preview bridge…
        </div>
      ) : null}

      {bridgeError ? (
        <div className="pointer-events-auto absolute left-3 top-3 max-w-[min(420px,calc(100%-24px))] rounded-xl border border-destructive/30 bg-popover/95 px-3 py-2 text-[11px] text-destructive shadow-[var(--box-shadow-neon-lg)] backdrop-blur-xl">
          {bridgeError}
        </div>
      ) : null}

      {active && bridgeReady && !selected ? (
        <div className="pointer-events-none absolute left-3 top-3 rounded-xl border border-primary/30 bg-popover/95 px-3 py-2 text-[11px] text-primary shadow-[var(--box-shadow-neon-lg)] backdrop-blur-xl">
          Click an element in the preview
        </div>
      ) : null}

      {showSelectionPill ? (
        <div className="pointer-events-auto absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-popover/95 px-3 py-1.5 shadow-[var(--box-shadow-neon-lg)] backdrop-blur-xl">
          <span className="inline-flex h-2 w-2 rounded-full bg-sky-400" aria-hidden />
          <span className="text-[11px] font-medium text-foreground">1 selection</span>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-full px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-[0.98]"
          >
            Clear
          </button>
        </div>
      ) : null}

      {editorOpen && selected ? (
        <div
          ref={popupRef}
          className={cn(
            "pointer-events-auto absolute w-[min(360px,calc(100%-24px))]",
            "overflow-hidden rounded-2xl border border-border",
            "bg-popover/95 shadow-[var(--box-shadow-neon-lg)]",
            "backdrop-blur-xl"
          )}
          style={{ top: position.top, left: position.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-3.5 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 items-center rounded-md bg-primary/15 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Edit
                </span>
                <p className="truncate font-mono text-[11px] text-muted-foreground" title={selected.selectorHint}>
                  {selected.tagName.toLowerCase()}
                </p>
              </div>
              {sourceLabel ? (
                <p className="mt-1.5 truncate font-mono text-[10px] text-emerald-400/90" title={selected.source?.file}>
                  {sourceLabel}
                </p>
              ) : (
                <p className="mt-1.5 text-[10px] text-amber-400/90">No source map - use Modify</p>
              )}
              {precheckReason ? <p className="mt-1 text-[10px] leading-snug text-amber-400/90">{precheckReason}</p> : null}
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className="shrink-0 rounded-lg border border-border p-1.5 text-muted-foreground transition hover:border-border hover:bg-muted hover:text-foreground/90 active:scale-[0.98]"
              aria-label="Close editor"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-h-[min(520px,70vh)] space-y-4 overflow-y-auto px-3.5 py-3.5">
            {canEditText ? (
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Copy</FieldLabel>
                <textarea
                  rows={2}
                  value={textContent}
                  onChange={(e) => updateText(e.target.value)}
                  className="w-full resize-y rounded-xl border border-border bg-muted px-3 py-2 text-[13px] leading-relaxed text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/45 focus:ring-1 focus:ring-primary/25"
                  placeholder="Visible text"
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <FieldLabel>Tailwind classes</FieldLabel>
                <Code2 className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden />
              </div>
              <textarea
                rows={3}
                value={className}
                onChange={(e) => updateClassName(e.target.value)}
                spellCheck={false}
                className="w-full resize-y rounded-xl border border-border bg-muted px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground/90 outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/45 focus:ring-1 focus:ring-primary/25"
                placeholder="text-lg font-medium text-white"
              />
              <p className="text-[10px] leading-snug text-muted-foreground">
                Edit utilities directly. Style controls below map into this class string.
              </p>
            </div>

            {mappedEntries.length > 0 ? (
              <div className="flex flex-col gap-1.5 rounded-xl border border-primary/20 bg-primary/6 px-2.5 py-2">
                <FieldLabel>Mapped to Tailwind</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {mappedEntries.map(([property, utility]) => (
                    <MappedChip key={property} utility={utility} />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel>{PROPERTY_META.color.label}</FieldLabel>
                  {mappedUtilities.color ? <MappedChip utility={mappedUtilities.color} /> : null}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colorHex}
                    onChange={(e) => updateStyle("color" satisfies DesignModeProperty, e.target.value)}
                    className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={colorHex}
                    onChange={(e) => updateStyle("color", e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-muted px-2 py-1.5 font-mono text-[11px] text-foreground/90 outline-none focus:border-primary/40"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <FieldLabel>
                    {PROPERTY_META.fontSize.label} ({fontSizePx}
                    {PROPERTY_META.fontSize.unit})
                  </FieldLabel>
                </div>
                <input
                  type="range"
                  min={10}
                  max={96}
                  value={fontSizePx}
                  onChange={(e) => updateStyle("fontSize", `${e.target.value}px`)}
                  className="w-full accent-primary"
                />
                {mappedUtilities.fontSize ? <MappedChip utility={mappedUtilities.fontSize} /> : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel>
                  {PROPERTY_META.padding.label} ({paddingPx}
                  {PROPERTY_META.padding.unit})
                </FieldLabel>
                <input
                  type="range"
                  min={0}
                  max={96}
                  value={paddingPx}
                  onChange={(e) => updateStyle("padding", `${e.target.value}px`)}
                  className="w-full accent-primary"
                />
                {mappedUtilities.padding ? <MappedChip utility={mappedUtilities.padding} /> : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel>
                  {PROPERTY_META.borderRadius.label} ({radiusPx}
                  {PROPERTY_META.borderRadius.unit})
                </FieldLabel>
                <input
                  type="range"
                  min={0}
                  max={48}
                  value={radiusPx}
                  onChange={(e) => updateStyle("borderRadius", `${e.target.value}px`)}
                  className="w-full accent-primary"
                />
                {mappedUtilities.borderRadius ? <MappedChip utility={mappedUtilities.borderRadius} /> : null}
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-border px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={patching || !canDirectPatch}
                onClick={() => void applyDirectPatch()}
                className="defi-button px-3.5 py-1.5 text-[11px] font-medium disabled:opacity-40"
                title={precheckReason ?? "Apply Direct patch to source"}
              >
                {patching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                {patching ? "Saving…" : "Apply"}
              </button>
              {(showModifyHandoff || !canDirectPatch) && selected ? (
                <button
                  type="button"
                  disabled={patching}
                  onClick={handoffToModify}
                  className="defi-button-outline px-3.5 py-1.5 text-[11px] font-medium disabled:opacity-40"
                >
                  Use Modify
                </button>
              ) : null}
              <button
                type="button"
                disabled
                onClick={undoLastApply}
                className="defi-button-outline px-3 py-1.5 text-[11px] font-medium disabled:opacity-40"
                title="Undo not available for direct patch yet"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </button>
            </div>
            {applyHint ? <p className="text-[11px] leading-snug text-primary/80">{applyHint}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
