"use client";

import type { GraphNode } from "@/lib/atlas/types";
import { formatStepLabel } from "@/lib/atlas/parseSteps";

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(epochMs: number, flowStart: number): string {
  const elapsed = epochMs - flowStart;
  const s = Math.floor(elapsed / 1000);
  const ms = elapsed % 1000;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function EventStream({
  nodes,
  flowStart,
  maxItems = 24,
}: {
  nodes: GraphNode[];
  flowStart: number;
  maxItems?: number;
}) {
  const visible = nodes.slice(-maxItems);

  return (
    <div className="flex flex-col gap-1 font-mono text-[11px]">
      {visible.map((node) => (
        <div
          key={node.id}
          className="flex items-baseline gap-3 rounded px-2 py-1 hover:bg-white/5"
        >
          <span className="w-14 shrink-0 text-[10px] text-muted-foreground">
            [{formatTimestamp(node.timestamp, flowStart)}]
          </span>
          <span
            className={
              node.status === "ok" ? "text-primary" : "text-red-400"
            }
          >
            {node.status === "ok" ? ">" : "×"}
          </span>
          <span className="min-w-0 truncate text-foreground">
            {formatStepLabel(node.step)}
            {node.skillHint ? (
              <span className="ml-1 text-accent-tertiary/80">[{node.skillHint}]</span>
            ) : null}
          </span>
          {node.detail ? (
            <span className="truncate text-muted-foreground">{node.detail}</span>
          ) : null}
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
            +{formatMs(node.duration)}
          </span>
        </div>
      ))}
    </div>
  );
}
