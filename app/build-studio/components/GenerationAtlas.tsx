"use client";

import { useState, useEffect, useRef } from "react";
import { parseStepsToTopology } from "@/lib/atlas/parseSteps";
import type { TopologyGraph } from "@/lib/atlas/types";
import { StageColumn } from "./StageColumn";
import { DetailDrawer } from "./DetailDrawer";
import { EventStream } from "./EventStream";
import { PannableCanvas } from "./PannableCanvas";

interface GenerationAtlasProps {
  steps: Array<{ step: string; status: "ok" | "error"; detail?: string; timestamp: number; duration: number }>;
  flowStart: number;
  loading?: boolean;
  verificationStatus?: "passed" | "failed";
  totalDuration?: number;
  /** Render only topology canvas + stage columns (no textual event stream). */
  showEventStream?: boolean;
}

export function GenerationAtlas({
  steps,
  flowStart,
  loading = false,
  verificationStatus,
  totalDuration,
  showEventStream = true,
}: GenerationAtlasProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const graph: TopologyGraph | null =
    steps.length > 0 ? parseStepsToTopology(steps, flowStart) : null;

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [steps.length]);

  if (!graph || graph.stages.length === 0) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-4 p-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          No steps yet
        </div>
        <p className="max-w-sm text-center font-body text-sm text-muted-foreground">
          Run a build to see the generation topology.
        </p>
      </div>
    );
  }

  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId);
  const activeIndex = loading ? steps.length : -1;

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4">
      {/* Pipeline overview bar */}
      <div className="flex shrink-0 items-center gap-2 overflow-x-auto">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Flow
        </span>
        <div className="flex items-center gap-1">
          {graph.stages.map((stage, i) => (
            <div key={stage.id} className="flex items-center gap-1">
              <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-[10px] text-foreground">
                {stage.label}
              </span>
              {i < graph.stages.length - 1 ? (
                <span className="text-white/30">→</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Horizontal pipeline flow — draggable canvas */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-white/10 bg-black/20">
        <div className="absolute bottom-2 left-2 z-10 rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
          Drag to pan
        </div>
        <PannableCanvas>
          {graph.stages.map((stage, stageIndex) => (
            <div key={stage.id} className="flex items-stretch">
              <StageColumn
                stage={stage}
                activeIndex={activeIndex}
                selectedNodeId={selectedNodeId}
                onSelectNode={(id) => setSelectedNodeId((prev) => (prev === id ? null : id))}
              />
              {stageIndex < graph.stages.length - 1 ? (
                <div className="flex shrink-0 items-center px-1">
                  <div className="bg-linear-to-r h-px w-6 from-white/20 to-white/5" />
                  <svg
                    className="h-4 w-4 shrink-0 text-white/30"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ) : null}
            </div>
          ))}

          {loading ? (
            <div className="flex shrink-0 items-center pl-4">
              <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 shadow-[0_0_20px_rgba(247,147,26,0.2)]">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                  Executing...
                </span>
              </div>
            </div>
          ) : null}
        </PannableCanvas>
      </div>

      {/* Detail drawer: overlay panel (fixed right, not clipped) */}
      <DetailDrawer
        node={selectedNode ?? null}
        onClose={() => setSelectedNodeId(null)}
      />

      {/* Bottom: event stream */}
      {showEventStream ? (
        <div
          ref={scrollRef}
          className="shrink-0 rounded-lg border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-sm"
        >
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Event Stream · {steps.length} steps
            {totalDuration ? ` · ${(totalDuration / 1000).toFixed(1)}s total` : ""}
            {verificationStatus ? ` · ${verificationStatus}` : ""}
          </div>
          <EventStream nodes={graph.nodes} flowStart={flowStart} />
        </div>
      ) : null}
    </div>
  );
}
