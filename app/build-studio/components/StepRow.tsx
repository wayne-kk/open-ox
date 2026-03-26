"use client";

import { useState } from "react";
import type { BuildStep } from "../types/build-studio";
import { getStepNarrative } from "../lib/narratives";
import { TracePanel } from "./TracePanel";

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(epochMs: number, flowStartMs: number): string {
  const elapsed = epochMs - flowStartMs;
  const s = Math.floor(elapsed / 1000);
  const ms = elapsed % 1000;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function StepRow({ step, flowStart }: { step: BuildStep; flowStart: number }) {
  const [open, setOpen] = useState(false);
  const isSection = step.step.startsWith("generate_section:");
  const stepLabel = isSection
    ? step.step.replace("generate_section:", "section:")
    : step.step;
  const narrative = getStepNarrative(step);
  const hasTrace = step.trace != null;

  return (
    <div className="rounded-xl hover:bg-white/3">
      <div
        className="flex cursor-pointer items-start gap-2 px-2 py-2"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="w-[68px] shrink-0 pt-0.5 font-mono text-[10px] text-muted-foreground">
          [{formatTimestamp(step.timestamp, flowStart)}]
        </span>
        <span className={`shrink-0 pt-0.5 text-[11px] ${step.status === "ok" ? "text-primary" : "text-red-400"}`}>
          {step.status === "ok" ? ">" : "x"}
        </span>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className={`break-all font-mono text-[11px] ${isSection ? "text-accent-tertiary" : "text-foreground"}`}>
            {stepLabel}
            {step.skillId ? (
              <span className="ml-1.5 text-[10px] text-accent-tertiary/80">[{step.skillId}]</span>
            ) : null}
          </div>
        </div>
        {hasTrace && (
          <span className="shrink-0 pt-0.5 font-mono text-[9px] text-primary/40 uppercase tracking-wider">
            trace
          </span>
        )}
        <span className="shrink-0 pt-0.5 font-mono text-[10px] text-muted-foreground">
          +{formatMs(step.duration)}
        </span>
        <span className={`shrink-0 pt-0.5 text-[10px] transition-transform ${open ? "rotate-180" : ""} text-muted-foreground/40`}>
          ▾
        </span>
      </div>

      {open && (
        <div className="mx-2 mb-2 rounded-lg border border-white/6 bg-white/[0.03] px-3 py-2.5 text-[11px] leading-5">
          <div className="text-muted-foreground">{narrative.what}</div>
          <div className={`mt-1.5 ${step.status === "ok" ? "text-foreground/70" : "text-red-300/80"}`}>
            {narrative.output}
          </div>
          {narrative.note && (
            <div className="mt-1.5 break-words text-muted-foreground/50 italic">
              {narrative.note}
            </div>
          )}
          {step.trace && <TracePanel trace={step.trace} />}
        </div>
      )}
    </div>
  );
}
