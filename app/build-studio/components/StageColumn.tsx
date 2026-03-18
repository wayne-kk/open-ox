"use client";

import type { Stage } from "@/lib/atlas/types";
import { StepNode } from "./StepNode";

export function StageColumn({
  stage,
  activeIndex,
  selectedNodeId,
  onSelectNode,
}: {
  stage: Stage;
  activeIndex: number;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}) {
  const isRepair = stage.id === "repair";

  return (
    <div className="flex w-[200px] shrink-0 flex-col rounded-xl border border-white/10 bg-white/[0.02] transition-colors hover:border-white/15">
      <div
        className={`flex items-center justify-center gap-2 border-b border-white/10 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] ${
          isRepair ? "bg-amber-500/10 text-amber-400/90" : "bg-white/5 text-muted-foreground"
        }`}
      >
        {stage.label}
      </div>

      <div className="flex flex-col gap-2 p-2">
        {stage.nodes.map((node) => (
          <StepNode
            key={node.id}
            node={node}
            isActive={activeIndex === node.index}
            isSelected={selectedNodeId === node.id}
            onClick={() => onSelectNode(node.id)}
          />
        ))}
      </div>
    </div>
  );
}
