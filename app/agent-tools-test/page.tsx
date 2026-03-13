"use client";

import { useState, useRef, useEffect } from "react";

type Mode = "agent" | "code_agent" | "skill" | "build_site";

interface BuildStep {
  step: string;
  status: "ok" | "error";
  detail?: string;
  timestamp: number;
  duration: number;
}

interface AiResponse {
  content: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result: string }>;
  iterations?: number;
  skill?: string;
  steps?: Array<{ skill: string; output: string }>;
  sessionId?: string;
  verified?: boolean;
  generatedFiles?: string[];
  buildSteps?: BuildStep[];
  buildTotalDuration?: number;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function buildFileTree(files: string[]): string {
  if (files.length === 0) return "";
  return files
    .map((f, i) => {
      const isLast = i === files.length - 1;
      return `  ${isLast ? "└──" : "├──"} ${f}`;
    })
    .join("\n");
}

// ─── Terminal Line Component ──────────────────────────────────────────────────

function TermLine({
  prefix,
  children,
  color = "text-zinc-300",
  dim = false,
}: {
  prefix?: string;
  children: React.ReactNode;
  color?: string;
  dim?: boolean;
}) {
  return (
    <div className={`flex gap-2 font-mono text-[12px] leading-6 ${dim ? "opacity-50" : ""}`}>
      {prefix && (
        <span className="shrink-0 select-none text-zinc-600">{prefix}</span>
      )}
      <span className={color}>{children}</span>
    </div>
  );
}

// ─── Mode Badge ───────────────────────────────────────────────────────────────

const MODE_META: Record<Mode, { label: string; color: string; desc: string }> = {
  build_site: { label: "build_site", color: "bg-violet-500/15 text-violet-400 border-violet-500/30", desc: "Landing page generation flow" },
  agent:      { label: "agent",      color: "bg-blue-500/15 text-blue-400 border-blue-500/30",     desc: "LLM tool-calling agent" },
  code_agent: { label: "code_agent", color: "bg-amber-500/15 text-amber-400 border-amber-500/30",  desc: "Code generation agent with verify" },
  skill:      { label: "skill",      color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", desc: "Single skill execution" },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentToolsTestPage() {
  const [input, setInput] = useState(
    "我想搭建一个万圣节宣传页面，赛博朋克风格，主要包含活动介绍、特色亮点、活动时间表和报名入口。"
  );
  const [mode, setMode] = useState<Mode>("build_site");
  const [skillName, setSkillName] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const terminalRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [response, loading]);

  // Live elapsed timer while loading
  useEffect(() => {
    if (loading && startedAt) {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startedAt);
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, startedAt]);

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    const t0 = Date.now();
    setStartedAt(t0);
    setElapsed(0);
    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, mode, skill: skillName || undefined }),
      });

      // ── SSE streaming (build_site mode) ──────────────────────────────
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream")) {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const chunk of lines) {
            const line = chunk.replace(/^data:\s*/, "").trim();
            if (!line) continue;
            try {
              const event = JSON.parse(line) as {
                type: "step" | "done" | "error";
                [k: string]: unknown;
              };

              if (event.type === "step") {
                // Append step incrementally so terminal updates in real-time
                const step = event as unknown as BuildStep;
                setResponse((prev) => ({
                  content: prev?.content ?? "",
                  generatedFiles: prev?.generatedFiles,
                  buildTotalDuration: prev?.buildTotalDuration,
                  buildSteps: [...(prev?.buildSteps ?? []), step],
                }));
              } else if (event.type === "done") {
                const result = event.result as AiResponse;
                setResponse(result);
              } else if (event.type === "error") {
                setResponse({ content: "", error: String(event.message) });
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }
      } else {
        // ── Regular JSON (other modes) ───────────────────────────────────
        const json = (await res.json()) as AiResponse;
        setResponse(json);
      }
    } catch (err) {
      setResponse({
        content: "",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  const flowStart =
    response?.buildSteps?.[0]?.timestamp != null
      ? response.buildSteps[0].timestamp - response.buildSteps[0].duration
      : startedAt ?? 0;

  return (
    <div className="flex h-screen flex-col bg-[#0e0e10] text-zinc-100 overflow-hidden">
      {/* ── Top bar ── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/6 px-5">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-300">
            AI Build Studio
          </span>
          <span className="text-xs text-zinc-600">— open-ox dev console</span>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          {loading && (
            <span className="flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-yellow-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" />
              running · {formatMs(elapsed)}
            </span>
          )}
          {!loading && response && (
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${
                response.error
                  ? "border-red-500/30 bg-red-500/10 text-red-400"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  response.error ? "bg-red-400" : "bg-emerald-400"
                }`}
              />
              {response.error
                ? "failed"
                : response.buildTotalDuration
                ? `done · ${formatMs(response.buildTotalDuration)}`
                : "done"}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Input Panel ── */}
        <aside className="flex w-[340px] shrink-0 flex-col gap-4 border-r border-white/6 bg-[#111113] p-4">
          {/* Mode selector */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Mode
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(MODE_META) as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-lg border px-3 py-1.5 text-left text-[11px] font-medium transition-all ${
                    mode === m
                      ? MODE_META[m].color + " border-current"
                      : "border-white/[0.07] text-zinc-500 hover:border-white/15 hover:text-zinc-300"
                  }`}
                >
                  {MODE_META[m].label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600">{MODE_META[mode].desc}</p>
          </div>

          {/* Input textarea */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Input
            </span>
            <textarea
              rows={7}
              className="w-full resize-none rounded-xl border border-white/[0.07] bg-[#0e0e10] px-3 py-2.5 font-mono text-[12px] text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入自然语言指令..."
            />
          </div>

          {/* Skill input (only for skill mode) */}
          {mode === "skill" && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                Skill Name
              </span>
              <input
                className="rounded-lg border border-white/[0.07] bg-[#0e0e10] px-3 py-2 font-mono text-[12px] text-zinc-200 placeholder-zinc-600 outline-none focus:border-emerald-500/50 transition-all"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="e.g. landing.generate_section"
              />
            </div>
          )}

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={loading}
            className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Running...
              </>
            ) : (
              <>
                <span className="text-base leading-none">▶</span>
                Run
              </>
            )}
          </button>

          {/* Tips */}
          <div className="rounded-xl border border-white/5 bg-white/2 p-3 text-[10px] text-zinc-600">
            <div className="mb-1.5 font-semibold text-zinc-500">Quick tips</div>
            <ul className="space-y-1 leading-relaxed">
              <li>· <code className="text-zinc-400">build_site</code> 触发完整建站 Flow</li>
              <li>· <code className="text-zinc-400">agent</code> 模式 LLM 自主选 tool</li>
              <li>· <code className="text-zinc-400">skill</code> 模式需填写 Skill Name</li>
            </ul>
          </div>
        </aside>

        {/* ── Right: Terminal Console ── */}
        <main className="flex flex-1 flex-col overflow-hidden bg-[#0a0a0c]">
          {/* Terminal title bar */}
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/5 px-4">
            <span className="font-mono text-[11px] text-zinc-500">
              {loading
                ? `● running ${mode} · ${formatMs(elapsed)}`
                : response
                ? `● ${mode} · ${response.buildSteps?.length ?? 0} steps · ${
                    response.generatedFiles?.length ?? 0
                  } files`
                : "● idle"}
            </span>
            {response?.buildTotalDuration && (
              <span className="font-mono text-[11px] text-zinc-600">
                total: {formatMs(response.buildTotalDuration)}
              </span>
            )}
          </div>

          {/* Terminal body */}
          <div
            ref={terminalRef}
            className="flex-1 overflow-auto px-5 py-4 font-mono text-[12px] leading-6"
          >
            {!response && !loading && (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mb-2 text-3xl">⬡</div>
                  <div className="text-sm text-zinc-600">
                    Configure and run a flow to see output here
                  </div>
                </div>
              </div>
            )}

            {(response || loading) && (
              <div className="space-y-0.5">
                {/* Command echo */}
                <TermLine prefix="$" color="text-zinc-400">
                  run {mode}
                  {skillName ? ` --skill ${skillName}` : ""}{" "}
                  <span className="text-zinc-600">
                    &quot;
                    {input.length > 60 ? input.slice(0, 60) + "…" : input}
                    &quot;
                  </span>
                </TermLine>

                <div className="my-2 border-t border-white/4" />

                {/* Build steps */}
                {response?.buildSteps?.map((step, idx) => {
                  const ts = formatTimestamp(step.timestamp, flowStart);
                  const isSection = step.step.startsWith("generate_section:");
                  const stepLabel = isSection
                    ? step.step.replace("generate_section:", "section:")
                    : step.step;

                  return (
                    <div key={`${step.step}-${idx}`} className="flex items-baseline gap-3">
                      {/* Timestamp */}
                      <span className="w-[72px] shrink-0 text-[10px] text-zinc-700">
                        [{ts}]
                      </span>
                      {/* Status icon */}
                      <span
                        className={`shrink-0 text-[11px] ${
                          step.status === "ok" ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {step.status === "ok" ? "✓" : "✗"}
                      </span>
                      {/* Step name */}
                      <span
                        className={`shrink-0 ${
                          isSection ? "text-sky-400" : "text-violet-400"
                        } font-medium`}
                        style={{ minWidth: "220px" }}
                      >
                        {stepLabel}
                      </span>
                      {/* Detail */}
                      {step.detail && (
                        <span className="text-zinc-500 truncate">{step.detail}</span>
                      )}
                      {/* Duration */}
                      <span className="ml-auto shrink-0 text-[10px] text-zinc-700">
                        +{formatMs(step.duration)}
                      </span>
                    </div>
                  );
                })}

                {/* Loading cursor */}
                {loading && (
                  <>
                    <div className="my-1 border-t border-white/4" />
                    <TermLine color="text-yellow-400">
                      <span className="animate-pulse">⟳</span>
                      <span className="ml-2 text-zinc-500">executing… {formatMs(elapsed)}</span>
                    </TermLine>
                  </>
                )}

                {/* Error */}
                {response?.error && (
                  <>
                    <div className="my-2 border-t border-white/4" />
                    <TermLine color="text-red-400">
                      ✗ Error: {response.error}
                    </TermLine>
                  </>
                )}

                {/* Content output (agent/skill mode) */}
                {response?.content && !response.buildSteps && (
                  <>
                    <div className="my-2 border-t border-white/4" />
                    <TermLine dim color="text-zinc-500">output</TermLine>
                    <pre className="mt-1 whitespace-pre-wrap text-zinc-200">
                      {response.content}
                    </pre>
                  </>
                )}

                {/* Tool calls */}
                {response?.toolCalls && response.toolCalls.length > 0 && (
                  <>
                    <div className="my-2 border-t border-white/4" />
                    {response.toolCalls.map((t, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <TermLine color="text-amber-400">
                          <span className="text-zinc-600">[{String(idx + 1).padStart(2, "0")}]</span>
                          <span className="ml-2">tool:{t.name}</span>
                          {t.args?.path != null && (
                            <span className="ml-2 text-zinc-500">
                              {String(t.args.path)}
                            </span>
                          )}
                        </TermLine>
                      </div>
                    ))}
                  </>
                )}

                {/* Generated files tree */}
                {response?.generatedFiles && response.generatedFiles.length > 0 && (
                  <>
                    <div className="my-3 border-t border-white/4" />
                    <TermLine color="text-zinc-400">
                      Generated files ({response.generatedFiles.length})
                    </TermLine>
                    <pre className="mt-1 text-[11px] text-zinc-500">
                      {buildFileTree(response.generatedFiles)}
                    </pre>
                  </>
                )}

                {/* Summary line */}
                {response && !loading && (
                  <>
                    <div className="my-3 border-t border-white/4" />
                    <TermLine
                      color={response.error ? "text-red-400" : "text-emerald-400"}
                    >
                      {response.error ? "✗ flow failed" : "✓ flow complete"}
                      {response.buildTotalDuration &&
                        ` · ${formatMs(response.buildTotalDuration)}`}
                      {typeof response.iterations === "number" &&
                        ` · ${response.iterations} iterations`}
                      {response.sessionId &&
                        ` · session ${response.sessionId.slice(0, 8)}`}
                    </TermLine>
                    <TermLine prefix="$" color="text-zinc-700 animate-pulse">
                      █
                    </TermLine>
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
