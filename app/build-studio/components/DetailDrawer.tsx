"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { GraphNode } from "@/lib/atlas/types";
import { formatStepLabel } from "@/lib/atlas/parseSteps";

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function DetailDrawer({
  node,
  onClose,
}: {
  node: GraphNode | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  if (!node) return null;

  const label = formatStepLabel(node.step);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel: fixed right, not clipped by parent overflow */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[360px] flex-col border-l border-white/10 bg-[#0a0c10]/98 shadow-[-8px_0_32px_rgba(0,0,0,0.5)]"
        role="dialog"
        aria-label="Step detail"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Step Detail
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-5">
          <div>
            <div className="font-mono text-sm uppercase tracking-wider text-primary">
              {label}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                  node.status === "ok"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-red-500/20 text-red-300"
                }`}
              >
                {node.status}
              </span>
              <span className="rounded-md bg-white/10 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                {node.stage}
              </span>
              <span className="rounded-md bg-white/10 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                {node.kind}
              </span>
            </div>
          </div>

          {node.duration > 0 ? (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Duration
              </div>
              <div className="mt-1 font-mono text-base text-foreground">
                +{formatMs(node.duration)}
              </div>
            </div>
          ) : null}

          {node.detail ? (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Output
              </div>
              <div className="mt-1 rounded-lg bg-black/30 px-3 py-2 font-mono text-[12px] leading-6 text-foreground">
                {node.detail}
              </div>
            </div>
          ) : null}

          {node.skillHint ? (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Skill
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-accent-tertiary/30 bg-accent-tertiary/10 px-3 py-2 text-sm text-accent-tertiary">
                <span className="rounded bg-accent-tertiary/20 px-1.5 py-0.5 text-[10px] font-medium">
                  AGENT
                </span>
                <span className="font-mono text-xs">
                  {node.skillHint}
                </span>
              </div>
            </div>
          ) : null}

          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Raw Step ID
            </div>
            <div className="mt-1 break-all rounded-lg bg-black/30 px-3 py-2 font-mono text-[11px] text-muted-foreground">
              {node.step}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
