"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { GraphNode } from "@/lib/atlas/types";
import type { StepTrace, StepLlmCall } from "../../studio/types/build-studio";
import { formatStepLabel } from "@/lib/atlas/parseSteps";

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Token Bar ────────────────────────────────────────────────────────────────

function TokenBar({ input, output }: { input: number; output: number }) {
  const total = input + output;
  const inPct = total > 0 ? (input / total) * 100 : 50;
  const outPct = 100 - inPct;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
        <span>tokens</span>
        <span>{total.toLocaleString()} total</span>
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div className="h-full bg-blue-400/60 transition-all duration-500" style={{ width: `${inPct}%` }} />
        <div className="h-full bg-emerald-400/60 transition-all duration-500" style={{ width: `${outPct}%` }} />
      </div>
      <div className="flex justify-between font-mono text-[9px]">
        <span className="text-blue-400/70">↑ {input.toLocaleString()} in</span>
        <span className="text-emerald-400/70">↓ {output.toLocaleString()} out</span>
      </div>
    </div>
  );
}

// ─── LLM Section ─────────────────────────────────────────────────────────────

type LlmTab = "user" | "system" | "response";

function LlmSection({ llmCall }: { llmCall: StepLlmCall }) {
  const tabs = ([
    { id: "user" as LlmTab, label: "User", available: !!llmCall.userMessage },
    { id: "system" as LlmTab, label: "System", available: !!llmCall.systemPrompt },
    { id: "response" as LlmTab, label: "Response", available: !!llmCall.rawResponse },
  ] as const).filter((t) => t.available);

  const [active, setActive] = useState<LlmTab>(tabs[0]?.id ?? "user");
  const hasTokens = llmCall.inputTokens != null && llmCall.outputTokens != null;

  return (
    <div className="space-y-3">
      {llmCall.model && (
        <div className="font-mono text-[9px] uppercase tracking-widest text-accent-tertiary/70">
          {llmCall.model}
        </div>
      )}
      {hasTokens && <TokenBar input={llmCall.inputTokens!} output={llmCall.outputTokens!} />}
      {tabs.length > 0 && (
        <>
          <div className="flex gap-0 border-b border-white/6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${active === tab.id
                    ? "border-b border-primary text-primary"
                    : "text-muted-foreground/40 hover:text-muted-foreground"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="max-h-[320px] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent]">
            {active === "system" && llmCall.systemPrompt && (
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-[1.6] text-muted-foreground/70">
                {llmCall.systemPrompt}
              </pre>
            )}
            {active === "user" && llmCall.userMessage && (
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-[1.6] text-muted-foreground/80">
                {llmCall.userMessage}
              </pre>
            )}
            {active === "response" && llmCall.rawResponse && (
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-[1.6] text-[#c7d0dc]/80">
                {llmCall.rawResponse}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Validation Section ───────────────────────────────────────────────────────

function ValidationSection({ result }: { result: NonNullable<StepTrace["validationResult"]> }) {
  const passed = result.checks.filter((c) => c.passed).length;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
        <span>checks</span>
        <span className={result.passed ? "text-emerald-400/80" : "text-red-400/80"}>
          {passed}/{result.checks.length}
        </span>
      </div>
      {result.checks.map((check) => (
        <div
          key={check.name}
          className={`flex items-start gap-2 rounded-md px-2.5 py-2 text-[11px] ${check.passed ? "bg-emerald-400/6 text-emerald-300/80" : "bg-red-400/6 text-red-300/80"
            }`}
        >
          <span className="shrink-0 font-mono">{check.passed ? "✓" : "✗"}</span>
          <div className="min-w-0">
            <div className="font-mono tracking-wide">{check.name}</div>
            {check.detail && (
              <div className="mt-0.5 break-words text-[10px] opacity-60">{check.detail}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── IO Section ───────────────────────────────────────────────────────────────

function GeneratedImagesSection({ images }: { images: Array<{ filename: string; prompt: string; path: string | null; durationMs?: number }> }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  if (images.length === 0) return null;

  const handleCopy = (prompt: string, idx: number) => {
    navigator.clipboard.writeText(prompt);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <div className="space-y-2">
      <div className="font-mono text-[9px] uppercase tracking-widest text-violet-400/70">
        Generated Images ({images.length})
      </div>
      {images.map((img, i) => (
        <div key={i} className="rounded-lg border border-violet-500/10 bg-violet-500/5 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-violet-300/80">
              {img.path ?? img.filename}
              {img.durationMs ? ` · ${(img.durationMs / 1000).toFixed(1)}s` : ""}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(img.prompt, i)}
              className="rounded px-1.5 py-0.5 text-[9px] text-violet-400/60 hover:bg-violet-500/10 hover:text-violet-300 transition-colors"
            >
              {copiedIdx === i ? "✓ 已复制" : "复制 prompt"}
            </button>
          </div>
          <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-[1.5] text-muted-foreground/60">
            {img.prompt}
          </pre>
        </div>
      ))}
    </div>
  );
}

function IoSection({ value }: { value: Record<string, unknown> }) {
  return (
    <pre className="max-h-[280px] overflow-y-auto whitespace-pre-wrap break-all rounded-lg bg-black/30 p-3 font-mono text-[11px] leading-[1.6] text-[#c7d0dc]/70 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent]">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// ─── Trace Tabs ───────────────────────────────────────────────────────────────

type TraceTab = "llm" | "validation" | "input" | "output";

function TraceSection({ trace }: { trace: StepTrace }) {
  const tabs: Array<{ id: TraceTab; label: string; badge?: string }> = [
    trace.llmCall && { id: "llm" as TraceTab, label: "LLM Call" },
    trace.validationResult && {
      id: "validation" as TraceTab,
      label: "Checks",
      badge: trace.validationResult.passed ? "✓" : "✗",
    },
    trace.input && { id: "input" as TraceTab, label: "Input" },
    trace.output && { id: "output" as TraceTab, label: "Output" },
  ].filter(Boolean) as Array<{ id: TraceTab; label: string; badge?: string }>;

  const [active, setActive] = useState<TraceTab>(tabs[0]?.id ?? "llm");

  if (tabs.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Trace</div>
      <div className="rounded-xl border border-white/8 bg-black/20">
        <div className="flex gap-0 border-b border-white/6 px-1 pt-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`flex items-center gap-1 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${active === tab.id
                  ? "border-b border-primary text-primary"
                  : "text-muted-foreground/40 hover:text-muted-foreground"
                }`}
            >
              {tab.label}
              {tab.badge && (
                <span className={`text-[9px] ${tab.badge === "✓" ? "text-emerald-400" : "text-red-400"}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="p-3">
          {active === "llm" && trace.llmCall && <LlmSection llmCall={trace.llmCall} />}
          {active === "validation" && trace.validationResult && (
            <ValidationSection result={trace.validationResult} />
          )}
          {active === "input" && trace.input && <IoSection value={trace.input} />}
          {active === "output" && trace.output && (
            <>
              {Array.isArray(trace.output.generatedImages) && trace.output.generatedImages.length > 0 && (
                <GeneratedImagesSection
                  images={trace.output.generatedImages as Array<{ filename: string; prompt: string; path: string | null }>}
                />
              )}
              <IoSection value={trace.output} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

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
      {/* Backdrop — scoped to the parent container, not the full viewport */}
      <div className="absolute inset-0 z-40 bg-black/30" onClick={onClose} aria-hidden="true" />

      <div
        className="absolute right-0 top-0 z-50 flex h-full w-full max-w-[420px] flex-col border-l border-white/10 bg-[#0a0c10]/98 shadow-[-12px_0_40px_rgba(0,0,0,0.6)]"
        role="dialog"
        aria-label="Step detail"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Step Detail
            </div>
            <div className="mt-1 truncate font-mono text-sm font-medium uppercase tracking-wide text-primary">
              {label}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent]">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${node.status === "ok" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
              }`}>
              {node.status}
            </span>
            <span className="rounded-md bg-white/10 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              {node.stage}
            </span>
            <span className="rounded-md bg-white/10 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              {node.kind}
            </span>
            {node.duration > 0 && (
              <span className="rounded-md bg-white/10 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                +{formatMs(node.duration)}
              </span>
            )}
          </div>

          {/* Detail / output */}
          {node.detail && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Output</div>
              <div className="mt-1.5 rounded-lg bg-black/30 px-3 py-2.5 font-mono text-[12px] leading-6 text-foreground break-all">
                {node.detail}
              </div>
            </div>
          )}

          {/* Skill */}
          {node.skillHint && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Skill</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg border border-accent-tertiary/30 bg-accent-tertiary/10 px-3 py-2 text-sm text-accent-tertiary">
                <span className="rounded bg-accent-tertiary/20 px-1.5 py-0.5 text-[10px] font-medium">AGENT</span>
                <span className="font-mono text-xs">{node.skillHint}</span>
              </div>
            </div>
          )}

          {/* Trace data */}
          {node.trace && <TraceSection trace={node.trace} />}

          {/* Raw step ID */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Step ID</div>
            <div className="mt-1.5 break-all rounded-lg bg-black/30 px-3 py-2 font-mono text-[11px] text-muted-foreground">
              {node.step}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
