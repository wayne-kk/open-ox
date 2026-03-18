"use client";

import { Check, AlertTriangle, Loader2 } from "lucide-react";
import type { GraphNode } from "@/lib/atlas/types";
import { formatStepLabel } from "@/lib/atlas/parseSteps";

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function StepNode({
  node,
  isActive,
  isSelected,
  onClick,
}: {
  node: GraphNode;
  isActive: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const label = formatStepLabel(node.step);
  const statusColor =
    node.status === "error"
      ? "border-red-400/50 text-red-300"
      : node.status === "ok"
        ? "border-emerald-500/40 text-emerald-300"
        : isActive
          ? "border-primary/60 text-primary shadow-[0_0_16px_rgba(247,147,26,0.35)]"
          : "border-white/15 text-muted-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        atlas-node-in group flex w-full flex-col gap-1 rounded-lg border px-3 py-2 text-left
        transition-all duration-200
        hover:border-primary/40 hover:bg-white/5
        ${statusColor}
        ${isSelected ? "ring-2 ring-primary/50 ring-offset-2 ring-offset-[#0a0c10]" : ""}
      `}
    >
      <div className="flex items-start gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/5">
          {node.status === "error" ? (
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          ) : node.status === "ok" ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : isActive ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-white/30" />
          )}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="truncate font-mono text-[11px] uppercase tracking-[0.12em]">
            {label}
          </div>
          {node.detail ? (
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
              {node.detail}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex w-full items-center justify-between gap-2">
        {node.duration > 0 ? (
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
            +{formatMs(node.duration)}
          </span>
        ) : <span />}
        {node.skillHint ? (
          <span className="shrink-0 max-w-[120px] truncate rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-accent-tertiary/90" title={node.skillHint}>
            {node.skillHint.replace(/^component\./, "")}
          </span>
        ) : null}
      </div>
    </button>
  );
}
