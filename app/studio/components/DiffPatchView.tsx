"use client";

import { useState } from "react";
import type { ModifyDiff } from "@/app/studio/hooks/useBuildStudio";

export function DiffPatchLines({ patch }: { patch: string }) {
  const lines = patch.split("\n");
  return (
    <div className="overflow-x-auto bg-[#080a0d]">
      {lines.map((line, i) => {
        const isAdd = line.startsWith("+") && !line.startsWith("+++");
        const isDel = line.startsWith("-") && !line.startsWith("---");
        const isHunk = line.startsWith("@@");
        const isMeta = line.startsWith("---") || line.startsWith("+++");
        return (
          <div
            key={i}
            className={`px-3 py-px whitespace-pre leading-5 font-mono text-[11px] ${
              isAdd
                ? "bg-green-500/10 text-green-300/90"
                : isDel
                  ? "bg-red-500/10 text-red-300/80"
                  : isHunk
                    ? "text-blue-400/60 bg-blue-500/5"
                    : isMeta
                      ? "text-muted-foreground/40"
                      : "text-muted-foreground/60"
            }`}
          >
            {line || " "}
          </div>
        );
      })}
    </div>
  );
}

export function DiffBlock({ diff }: { diff: ModifyDiff }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-white/8 overflow-hidden text-[11px] font-mono">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between bg-white/3 px-3 py-2 hover:bg-white/5 transition-colors text-left"
      >
        <span className="text-foreground/80 truncate max-w-[60%]">{diff.file}</span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-green-400/80">+{diff.stats.additions}</span>
          <span className="text-red-400/80">-{diff.stats.deletions}</span>
          <span className={`text-muted-foreground/50 transition-transform ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </div>
      </button>
      {open ? <DiffPatchLines patch={diff.patch} /> : null}
    </div>
  );
}
