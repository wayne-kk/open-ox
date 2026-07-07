"use client";

import { MousePointer2, Undo2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DesignModeElementPayload, DesignModeProperty } from "@/lib/studio/designMode/protocol";
import { colorToHex, parsePx, type UseDesignModeResult } from "../hooks/useDesignMode";

interface DesignModePanelProps {
  designMode: UseDesignModeResult;
  hasGeneratedProject: boolean;
}

function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">{label}</span>
      {children}
    </div>
  );
}

function SelectedSummary({ selected }: { selected: DesignModeElementPayload }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/25 px-3 py-2">
      <p className="font-mono text-[10px] text-primary/70 truncate">{selected.selectorHint}</p>
      {selected.textPreview ? (
        <p className="mt-1 text-[11px] text-muted-foreground/80 line-clamp-2">&ldquo;{selected.textPreview}&rdquo;</p>
      ) : null}
    </div>
  );
}

export function DesignModePanel({ designMode, hasGeneratedProject }: DesignModePanelProps) {
  if (!designMode.featureEnabled || !hasGeneratedProject) {
    return null;
  }

  const {
    active,
    bridgeReady,
    bridgeError,
    selected,
    styles,
    pendingEdits,
    applyHint,
    setActive,
    updateStyle,
    applyDraftToModify,
    undoLastApply,
  } = designMode;

  const colorHex = colorToHex(styles.color);
  const fontSizePx = parsePx(styles.fontSize, 16);
  const paddingPx = parsePx(styles.padding, 0);
  const radiusPx = parsePx(styles.borderRadius, 0);

  return (
    <div className="border-b border-white/8 bg-black/20 px-3 py-2.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MousePointer2 className="h-3.5 w-3.5 shrink-0 text-primary/60" />
          <span className="font-mono text-[9px] uppercase tracking-widest text-primary/60">Design Mode</span>
          {pendingEdits.length > 0 ? (
            <span className="font-mono text-[9px] text-muted-foreground/60">{pendingEdits.length} queued</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setActive(!active)}
          className={cn(
            "defi-button-outline px-2.5 py-1 text-[10px] font-medium",
            active && "border-primary/40 text-primary"
          )}
        >
          {active ? "Exit pick" : "Pick element"}
        </button>
      </div>

      {active && !bridgeReady ? (
        <p className="font-mono text-[10px] text-muted-foreground/70">
          Connecting preview bridge… reload preview if pick mode stays unavailable.
        </p>
      ) : null}
      {bridgeError ? <p className="font-mono text-[10px] text-red-400/90">{bridgeError}</p> : null}

      {active && bridgeReady && !selected ? (
        <p className="font-mono text-[10px] text-muted-foreground/75">
          Click an element in the preview to inspect color, font-size, padding, and border-radius.
        </p>
      ) : null}

      {selected ? (
        <div className="space-y-3">
          <SelectedSummary selected={selected} />
          <div className="grid grid-cols-2 gap-3">
            <PropertyRow label="Color">
              <input
                type="color"
                value={colorHex}
                onChange={(e) => updateStyle("color" satisfies DesignModeProperty, e.target.value)}
                className="h-8 w-full cursor-pointer rounded-md border border-white/10 bg-transparent"
              />
            </PropertyRow>
            <PropertyRow label={`Font size (${fontSizePx}px)`}>
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
              onClick={applyDraftToModify}
              className="defi-button px-3 py-1.5 text-[10px] font-medium flex items-center gap-1.5"
            >
              <Wand2 className="h-3 w-3" />
              Apply → Modify draft
            </button>
            <button
              type="button"
              disabled={pendingEdits.length === 0}
              onClick={undoLastApply}
              className="defi-button-outline px-3 py-1.5 text-[10px] font-medium flex items-center gap-1.5 disabled:opacity-40"
            >
              <Undo2 className="h-3 w-3" />
              Undo last
            </button>
          </div>
        </div>
      ) : null}

      {applyHint ? <p className="font-mono text-[10px] text-primary/75">{applyHint}</p> : null}
    </div>
  );
}
