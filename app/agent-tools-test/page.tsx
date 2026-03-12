/* Agent Tools Test Page
 * 用于手动测试 AI Engine（processInput）+ system tools 的完整链路。
 * 通过 /api/ai 调用后端，前端展示请求 / 响应和一点使用提示。
 */

"use client";

import { useState } from "react";

type Mode = "agent" | "code_agent" | "skill" | "flow" | "build_site";

interface AiResponse {
  content: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result: string;
  }>;
  iterations?: number;
  skill?: string;
  steps?: Array<{ skill: string; output: string }>;
  sessionId?: string;
  architecturePlan?: unknown;
  verified?: boolean;
  generatedFiles?: string[];
  buildSteps?: Array<{ step: string; status: "ok" | "error"; detail?: string }>;
  error?: string;
}

export default function AgentToolsTestPage() {
  const [input, setInput] = useState(
    "我想搭建一个万圣节宣传页面，赛博朋克风格，主要包含活动介绍、特色亮点、活动时间表和报名入口。"
  );
  const [mode, setMode] = useState<Mode>("build_site");
  const [skill, setSkill] = useState("");
  const [flow, setFlow] = useState("");
  const [memory, setMemory] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [rawJson, setRawJson] = useState<string>("");

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResponse(null);
    setRawJson("");

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          mode,
          skill: skill || undefined,
          flow: flow || undefined,
          memory: memory || undefined,
        }),
      });

      const json = (await res.json()) as AiResponse;
      setRawJson(JSON.stringify(json, null, 2));
      setResponse(json);
    } catch (err) {
      setResponse({
        content: "",
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Agent / CodeAgent 流程测试入口
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            通过调用{" "}
            <code className="rounded bg-zinc-900/5 px-1 py-0.5 text-xs">
              /api/ai
            </code>{" "}
            ，测试{" "}
            <code className="rounded bg-zinc-900/5 px-1 py-0.5 text-xs">
              processInput
            </code>{" "}
            如何根据自然语言指令自动选择 skill / system tools（例如{" "}
            <code className="rounded bg-zinc-900/5 px-1 py-0.5 text-xs">
              write_file
            </code>
            、{" "}
            <code className="rounded bg-zinc-900/5 px-1 py-0.5 text-xs">
              format_code
            </code>{" "}
            等），以及完整的 prompt 规划流程。你只需要写指令，具体用哪个 tool
            由 Agent 自己推断。
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)]">
          <form
            onSubmit={handleRun}
            className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                输入 & 模式
              </span>
              <div className="flex gap-2 text-xs">
                {(["agent", "code_agent", "skill", "flow", "build_site"] as Mode[]).map(
                  (m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`rounded-full border px-3 py-1 ${
                        mode === m
                          ? "border-zinc-900 bg-zinc-900 text-zinc-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                          : "border-zinc-300 text-zinc-700 hover:border-zinc-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-400"
                      }`}
                    >
                      {m}
                    </button>
                  )
                )}
              </div>
            </div>

            <textarea
              rows={6}
              className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-400"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入要测试的指令，例如：'用 Code Agent 帮我创建一个新的页面，并用 write_file 写入到 app/xxx/page.tsx。'"
            />

            <div className="grid gap-3 text-xs md:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className="text-zinc-500 dark:text-zinc-400">
                  skill（skill 模式）
                </span>
                <input
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 outline-none focus:border-zinc-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-400"
                  value={skill}
                  onChange={(e) => setSkill(e.target.value)}
                  placeholder="如 codegen.generatePage"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-zinc-500 dark:text-zinc-400">
                  flow（flow 模式）
                </span>
                <input
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 outline-none focus:border-zinc-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-400"
                  value={flow}
                  onChange={(e) => setFlow(e.target.value)}
                  placeholder="如 build-landing-page"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-zinc-500 dark:text-zinc-400">
                  memory（可选，会传给 processInput）
                </span>
                <input
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 outline-none focus:border-zinc-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:focus:border-zinc-400"
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                  placeholder="任意字符串或序列化上下文"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex items-center justify-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading ? "Running..." : "Run /api/ai"}
            </button>
          </form>

          <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                响应 & Tool 调用
              </span>
              {response && (
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  mode: <code className="rounded bg-zinc-900/5 px-1 py-0.5">{mode}</code>
                  {response.skill && (
                    <>
                      {" · "}skill:{" "}
                      <code className="rounded bg-zinc-900/5 px-1 py-0.5">
                        {response.skill}
                      </code>
                    </>
                  )}
                </span>
              )}
            </div>

            <div className="max-h-[360px] space-y-3 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-[11px] leading-relaxed dark:border-zinc-800 dark:bg-zinc-900">
              {response ? (
                <>
                  {response.error && (
                    <p className="text-red-500">Error: {response.error}</p>
                  )}
                  {response.content && (
                    <div>
                      <div className="mb-1 font-medium text-zinc-700 dark:text-zinc-200">
                        content
                      </div>
                      <pre className="whitespace-pre-wrap text-[11px] text-zinc-800 dark:text-zinc-100">
                        {response.content}
                      </pre>
                    </div>
                  )}

                  {response.toolCalls && response.toolCalls.length > 0 && (
                    <div>
                      <div className="mb-1 font-medium text-zinc-700 dark:text-zinc-200">
                        Tool 调用时间线
                      </div>
                      <ol className="space-y-2">
                        {response.toolCalls.map((t, idx) => (
                          <li
                            key={`${t.name}-${idx}`}
                            className="rounded-lg border border-zinc-200 bg-white/70 p-2 dark:border-zinc-700 dark:bg-zinc-900/60"
                          >
                            <div className="mb-1 flex items-center justify-between">
                              <span className="font-medium text-zinc-800 dark:text-zinc-100">
                                Step {idx + 1}:{" "}
                                <code className="rounded bg-zinc-900/5 px-1 py-0.5">
                                  {t.name}
                                </code>
                              </span>
                            </div>
                            <div className="grid gap-1 md:grid-cols-2">
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                  args
                                </div>
                                <pre className="mt-0.5 max-h-28 overflow-auto rounded bg-zinc-900/5 p-1.5 text-[10px] text-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100">
                                  {JSON.stringify(t.args ?? {}, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                  result
                                </div>
                                <pre className="mt-0.5 max-h-28 overflow-auto rounded bg-zinc-900/5 p-1.5 text-[10px] text-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100">
                                  {t.result}
                                </pre>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {response.steps && response.steps.length > 0 && (
                    <div>
                      <div className="mb-1 font-medium text-zinc-700 dark:text-zinc-200">
                        Flow 步骤
                      </div>
                      <ol className="space-y-1">
                        {response.steps.map((s, idx) => (
                          <li key={`${s.skill}-${idx}`}>
                            <span className="font-medium">
                              {idx + 1}.{" "}
                              <code className="rounded bg-zinc-900/5 px-1 py-0.5">
                                {s.skill}
                              </code>
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {response.buildSteps && response.buildSteps.length > 0 && (
                    <div>
                      <div className="mb-1 font-medium text-zinc-700 dark:text-zinc-200">
                        Build Steps
                      </div>
                      <ol className="space-y-1">
                        {response.buildSteps.map((s, idx) => (
                          <li key={`${s.step}-${idx}`} className="flex items-start gap-2">
                            <span className={s.status === "ok" ? "text-emerald-500" : "text-red-500"}>
                              {s.status === "ok" ? "✓" : "✗"}
                            </span>
                            <span className="font-mono text-[10px]">
                              <span className="font-medium">{s.step}</span>
                              {s.detail && (
                                <span className="ml-1 text-zinc-500 dark:text-zinc-400">
                                  — {s.detail}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {response.generatedFiles && response.generatedFiles.length > 0 && (
                    <div>
                      <div className="mb-1 font-medium text-zinc-700 dark:text-zinc-200">
                        Generated Files ({response.generatedFiles.length})
                      </div>
                      <ul className="space-y-0.5 font-mono text-[10px] text-zinc-700 dark:text-zinc-300">
                        {response.generatedFiles.map((f) => (
                          <li key={f}>📄 {f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {typeof response.iterations === "number" && (
                    <p className="text-zinc-600 dark:text-zinc-400">
                      iterations: {response.iterations}
                    </p>
                  )}

                  {response.sessionId && (
                    <p className="text-zinc-600 dark:text-zinc-400">
                      sessionId: {response.sessionId}
                    </p>
                  )}

                  {typeof response.verified === "boolean" && (
                    <p className="text-zinc-600 dark:text-zinc-400">
                      verified: {String(response.verified)}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-zinc-500 dark:text-zinc-400">
                  还没有调用。填写输入后点击右侧按钮，即可看到 Agent/CodeAgent
                  的完整响应，以及使用 system tools 的信息。
                </p>
              )}
            </div>

            {rawJson && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
                  查看原始 JSON
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-black/90 p-3 text-[11px] text-zinc-100">
                  {rawJson}
                </pre>
              </details>
            )}
          </section>
        </section>

        <section className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
          <div className="font-medium text-zinc-800 dark:text-zinc-200">
            使用建议
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              想测试 <code>write_file</code> / <code>format_code</code>{" "}
              等 system tools，可以在输入里显式要求 Code Agent 使用这些工具生成 / 修改文件。
            </li>
            <li>
              想测试普通 Agent，可以切换到{" "}
              <code className="rounded bg-zinc-900/5 px-1 py-0.5">
                agent
              </code>{" "}
              模式，仅输入自然语言问题即可。
            </li>
            <li>
              想验证某个 skill 或预定义 flow 的行为，可以切换到{" "}
              <code className="rounded bg-zinc-900/5 px-1 py-0.5">skill</code>{" "}
              或{" "}
              <code className="rounded bg-zinc-900/5 px-1 py-0.5">flow</code>{" "}
              模式，并在对应输入框中填入标识符。
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

