"use client";

import { Check, AlertTriangle, Loader2, Clock } from "lucide-react";
import type { GraphNode } from "@/lib/atlas/types";
import { formatStepLabel } from "@/lib/atlas/parseSteps";

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Map stage/kind to an accent color class */
function getAccentColor(node: GraphNode): string {
  if (node.status === "error") return "border-red-500/50 bg-red-500/5";
  if (node.stage === "repair") return "border-amber-500/50 bg-amber-500/5";
  if (node.stage === "verify") return "border-blue-400/40 bg-blue-400/5";
  if (node.stage === "generate") return "border-accent-tertiary/35 bg-accent-tertiary/5";
  if (node.stage === "design") return "border-purple-400/35 bg-purple-400/5";
  return "border-white/12 bg-white/[0.02]";
}

function getStatusIcon(node: GraphNode, isActive: boolean) {
  if (node.status === "error") {
    return (
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 ring-1 ring-red-500/40">
        <AlertTriangle className="h-3 w-3 text-red-400" />
      </div>
    );
  }
  if (node.status === "ok") {
    const color =
      node.stage === "repair" ? "bg-amber-500/20 ring-amber-500/40 text-amber-400"
        : node.stage === "verify" ? "bg-blue-500/20 ring-blue-500/40 text-blue-400"
          : node.stage === "generate" ? "bg-accent-tertiary/20 ring-accent-tertiary/40 text-accent-tertiary"
            : "bg-emerald-500/20 ring-emerald-500/40 text-emerald-400";
    return (
      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ${color}`}>
        <Check className="h-3 w-3" />
      </div>
    );
  }
  if (isActive || node.status === "active") {
    return (
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 ring-1 ring-primary/50">
        <Loader2 className="h-3 w-3 animate-spin text-primary" />
      </div>
    );
  }
  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
      <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
    </div>
  );
}

function getLabelColor(node: GraphNode): string {
  if (node.status === "error") return "text-red-300";
  if (node.stage === "repair") return "text-amber-300";
  if (node.stage === "verify") return "text-blue-300";
  if (node.stage === "generate") return "text-accent-tertiary";
  if (node.stage === "design") return "text-purple-300";
  return "text-foreground";
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
  const accentBorder = getAccentColor(node);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        atlas-node-in group w-full rounded-lg border text-left
        transition-all duration-200
        hover:brightness-110
        ${accentBorder}
        ${isSelected ? "ring-2 ring-primary/60 ring-offset-1 ring-offset-background" : ""}
        ${isActive || node.status === "active" ? "shadow-[0_0_18px_rgba(247,147,26,0.25)]" : ""}
      `}
    >
      {/* Header row */}
      <div className="flex items-start gap-2.5 px-3 pt-2.5 pb-2">
        <div className="mt-0.5 shrink-0">
          {getStatusIcon(node, isActive)}
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          {/* Step label — truncate to one line */}
          <div className={`truncate font-mono text-[11px] font-medium leading-tight tracking-[0.08em] uppercase ${getLabelColor(node)}`}>
            {label}
          </div>

          {/* Detail — single line truncate */}
          {node.detail && (
            <div className="mt-1 truncate font-body text-[11px] leading-snug text-muted-foreground">
              {node.detail}
            </div>
          )}
        </div>
      </div>

      {/* Footer row: timing + skill */}
      {(node.duration > 0 || node.skillHint) && (
        <div className="flex items-center justify-between gap-2 border-t border-white/6 px-3 py-1.5">
          {node.duration > 0 ? (
            <div className="flex items-center gap-1 text-muted-foreground/60">
              <Clock className="h-2.5 w-2.5" />
              <span className="font-mono text-[10px]">{formatMs(node.duration)}</span>
            </div>
          ) : <span />}

          {node.skillHint && (
            <span
              className="max-w-[140px] truncate rounded-sm bg-accent-tertiary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent-tertiary/80 ring-1 ring-accent-tertiary/20"
              title={node.skillHint}
            >
              {node.skillHint.replace(/^component\./, "")}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
