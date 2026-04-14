"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Play, Loader2, Trash2, Save, Download, CheckSquare, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { HamsterLoader } from "@/components/ui/hamster-loader";

interface QueryItem { id: string; text: string }
interface WorkflowOutputs {
    style1?: string;
    style2?: string;
    problem1?: string;
    problem2?: string;
    Comparison?: string;
}
interface EvalResult { status: "running" | "done" | "error"; outputs: WorkflowOutputs; error?: string }

export default function StyleEvalPage() {
    const [queries, setQueries] = useState<QueryItem[]>([]);
    const [input, setInput] = useState("");
    const [results, setResults] = useState<Record<string, EvalResult>>({});
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [batchRunning, setBatchRunning] = useState(false);
    const [runningId, setRunningId] = useState<string | null>(null);
    const [savedPath, setSavedPath] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const abortRef = useRef(false);

    // ── 加载 queries ──
    useEffect(() => {
        fetch("/api/style-eval/queries")
            .then((r) => r.json())
            .then((data) => { if (Array.isArray(data)) setQueries(data); })
            .finally(() => setLoading(false));
    }, []);

    // ── 添加 query（持久化） ──
    const addQuery = async () => {
        const text = input.trim();
        if (!text) return;
        setInput("");
        const res = await fetch("/api/style-eval/queries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });
        const row = await res.json();
        if (row.id) setQueries((prev) => [...prev, row]);
    };

    // ── 删除 query（持久化） ──
    const removeQuery = async (id: string) => {
        setQueries((prev) => prev.filter((q) => q.id !== id));
        setResults((prev) => { const n = { ...prev }; delete n[id]; return n; });
        setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
        await fetch(`/api/style-eval/queries/${id}`, { method: "DELETE" });
    };

    // ── 选择 ──
    const toggleSelect = (id: string) => {
        setSelected((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    };

    const toggleAll = () => {
        if (selected.size === queries.length) setSelected(new Set());
        else setSelected(new Set(queries.map((q) => q.id)));
    };

    // ── 从任意层级提取 outputs ──
    const extractOutputs = (obj: Record<string, unknown>): WorkflowOutputs | null => {
        const keys: (keyof WorkflowOutputs)[] = ["style1", "style2", "problem1", "problem2", "Comparison"];
        // 直接在顶层
        if (keys.some((k) => typeof obj[k] === "string")) {
            const out: WorkflowOutputs = {};
            for (const k of keys) if (typeof obj[k] === "string") out[k] = obj[k] as string;
            return out;
        }
        // 在 obj.outputs
        if (obj.outputs && typeof obj.outputs === "object") {
            const o = obj.outputs as Record<string, unknown>;
            if (keys.some((k) => typeof o[k] === "string")) {
                const out: WorkflowOutputs = {};
                for (const k of keys) if (typeof o[k] === "string") out[k] = o[k] as string;
                return out;
            }
        }
        // 在 obj.data.outputs
        if (obj.data && typeof obj.data === "object") {
            const d = obj.data as Record<string, unknown>;
            if (d.outputs && typeof d.outputs === "object") {
                const o = d.outputs as Record<string, unknown>;
                if (keys.some((k) => typeof o[k] === "string")) {
                    const out: WorkflowOutputs = {};
                    for (const k of keys) if (typeof o[k] === "string") out[k] = o[k] as string;
                    return out;
                }
            }
        }
        return null;
    };

    // ── 单条调用 Dify workflow ──
    const runOne = useCallback(async (id: string, query: string) => {
        setRunningId(id);
        setResults((prev) => ({ ...prev, [id]: { status: "running", outputs: {} } }));

        try {
            const res = await fetch("/api/style-eval", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? `HTTP ${res.status}`);
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error("No response body");

            const decoder = new TextDecoder();
            let buffer = "";
            let outputs: WorkflowOutputs = {};

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    const raw = line.slice(6).trim();
                    if (!raw || raw === "[DONE]") continue;
                    try {
                        const evt = JSON.parse(raw);
                        console.log("[style-eval] SSE event:", evt.event, evt);

                        // 尝试从任何事件中提取 outputs
                        const found = extractOutputs(evt);
                        if (found) {
                            outputs = { ...outputs, ...found };
                            setResults((prev) => ({ ...prev, [id]: { status: "running", outputs } }));
                        }
                    } catch { /* skip non-JSON */ }
                }
            }

            setResults((prev) => ({ ...prev, [id]: { status: "done", outputs } }));
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            setResults((prev) => ({ ...prev, [id]: { status: "error", outputs: {}, error: msg } }));
        } finally {
            setRunningId(null);
        }
    }, []);

    // ── 批量运行选中的 ──
    const runSelected = useCallback(async () => {
        const toRun = queries.filter((q) => selected.has(q.id));
        if (toRun.length === 0) return;
        setBatchRunning(true);
        abortRef.current = false;
        for (const q of toRun) {
            if (abortRef.current) break;
            await runOne(q.id, q.text);
        }
        setBatchRunning(false);
    }, [queries, selected, runOne]);

    const stopBatch = () => { abortRef.current = true; };

    // ── 生成 Markdown 报告 ──
    const buildReport = useCallback(() => {
        const now = new Date().toLocaleString();
        let md = `# Style Evaluation Report\n\n> Generated: ${now}\n\n---\n\n`;
        for (const q of queries) {
            const r = results[q.id];
            md += `## Query: ${q.text}\n\n`;
            if (!r) { md += `_Not evaluated_\n\n---\n\n`; continue; }
            if (r.status === "error") { md += `**Error:** ${r.error}\n\n---\n\n`; continue; }
            const o = r.outputs;
            if (o.style1) md += `### 版本一 详细风格\n\n${o.style1}\n\n`;
            if (o.style2) md += `### 版本二 详细风格\n\n${o.style2}\n\n`;
            if (o.problem1) md += `### 问题分析一\n\n${o.problem1}\n\n`;
            if (o.problem2) md += `### 问题分析二\n\n${o.problem2}\n\n`;
            if (o.Comparison) md += `### 对比总结\n\n${o.Comparison}\n\n`;
            md += `---\n\n`;
        }
        return md;
    }, [queries, results]);

    const saveReport = useCallback(async () => {
        const content = buildReport();
        const res = await fetch("/api/style-eval/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
        });
        const data = await res.json();
        if (data.path) setSavedPath(data.path);
    }, [buildReport]);

    const downloadReport = useCallback(() => {
        const content = buildReport();
        const blob = new Blob([content], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `style-eval-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }, [buildReport]);

    const hasResults = Object.values(results).some((r) => r.status === "done");
    const isRunning = batchRunning || !!runningId;

    return (
        <main className="relative min-h-screen bg-background ">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,147,26,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(255,214,0,0.1),transparent_24%),radial-gradient(circle_at_bottom,rgba(234,88,12,0.1),transparent_30%)]" />

            <header className="relative z-10 border-b border-white/8 bg-background/75 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 lg:px-8">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="defi-button-outline px-4 py-2 text-[11px] font-medium">
                            <ArrowLeft className="h-4 w-4" /> Home
                        </Link>
                        <div>
                            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">Style Evaluation</div>
                            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">Design System QA</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasResults && (
                            <>
                                <button onClick={saveReport} className="defi-button-outline px-3 py-1.5 text-[10px] font-medium">
                                    <Save className="h-3 w-3" /> Save
                                </button>
                                <button onClick={downloadReport} className="defi-button-outline px-3 py-1.5 text-[10px] font-medium">
                                    <Download className="h-3 w-3" /> Download
                                </button>
                            </>
                        )}
                        <button
                            onClick={batchRunning ? stopBatch : runSelected}
                            disabled={selected.size === 0 || (isRunning && !batchRunning)}
                            className="defi-button px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] disabled:opacity-40"
                        >
                            {batchRunning ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Stop</> : <><Play className="h-3.5 w-3.5" /> Run {selected.size > 0 ? `(${selected.size})` : ""}</>}
                        </button>
                    </div>
                </div>
            </header>

            <div className="relative z-10 mx-auto max-w-7xl px-6 py-8 lg:px-8 space-y-6">
                <div className="flex gap-3">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addQuery()}
                        placeholder="Add a query..."
                        className="defi-input flex-1 px-4 py-2.5 text-sm"
                    />
                    <button onClick={addQuery} disabled={!input.trim()} className="defi-button px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] disabled:opacity-40">
                        <Plus className="h-3.5 w-3.5" /> Add
                    </button>
                </div>

                {savedPath && (
                    <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-2 text-xs text-green-400">
                        Report saved: <code className="font-mono">{savedPath}</code>
                    </div>
                )}

                {loading && (
                    <div className="text-center py-16"><HamsterLoader size="sm" className="mx-auto" /></div>
                )}

                {!loading && queries.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground text-sm">No queries yet.</div>
                )}

                {!loading && queries.length > 0 && (
                    <div className="flex items-center gap-2">
                        <button onClick={toggleAll} className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                            {selected.size === queries.length ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5" />}
                            {selected.size === queries.length ? "Deselect all" : "Select all"}
                        </button>
                        {selected.size > 0 && (
                            <span className="font-mono text-[10px] text-primary">{selected.size} selected</span>
                        )}
                    </div>
                )}

                {queries.map((q, idx) => {
                    const r = results[q.id];
                    const isThis = runningId === q.id;
                    const checked = selected.has(q.id);
                    return (
                        <div key={q.id} className={`defi-panel border p-5 transition-all duration-300 ${checked ? "border-primary/40" : "border-white/10 hover:border-primary/30"}`}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <button onClick={() => toggleSelect(q.id)} className="mt-0.5 shrink-0">
                                        {checked ? <CheckSquare className="h-4 w-4 text-primary" /> : <Square className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />}
                                    </button>
                                    <span className="font-mono text-[10px] text-muted-foreground mt-1 shrink-0">#{idx + 1}</span>
                                    <p className="text-sm text-foreground break-words">{q.text}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => runOne(q.id, q.text)}
                                        disabled={isRunning}
                                        className="defi-button-outline px-3 py-1.5 text-[10px] font-medium disabled:opacity-40"
                                    >
                                        {isThis ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                                        {r ? "Re-run" : "Run"}
                                    </button>
                                    <button onClick={() => removeQuery(q.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            {r && r.status === "error" && (
                                <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{r.error}</div>
                            )}
                            {r && r.status !== "error" && Object.values(r.outputs).some(Boolean) && (
                                <div className="mt-4 space-y-4">
                                    {r.status === "running" && (
                                        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary/70">
                                            <Loader2 className="h-3 w-3 animate-spin" /> Processing...
                                        </div>
                                    )}

                                    {/* style1 + style2 并排 */}
                                    {(r.outputs.style1 || r.outputs.style2) && (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {r.outputs.style1 && (
                                                <OutputCard label="版本一 详细风格" color="border-primary/20 bg-primary/[0.03]" content={r.outputs.style1} />
                                            )}
                                            {r.outputs.style2 && (
                                                <OutputCard label="版本二 详细风格" color="border-accent-tertiary/20 bg-accent-tertiary/[0.03]" content={r.outputs.style2} />
                                            )}
                                        </div>
                                    )}

                                    {/* problem1 + problem2 并排 */}
                                    {(r.outputs.problem1 || r.outputs.problem2) && (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {r.outputs.problem1 && (
                                                <OutputCard label="问题分析一" color="border-orange-500/20 bg-orange-500/[0.03]" content={r.outputs.problem1} />
                                            )}
                                            {r.outputs.problem2 && (
                                                <OutputCard label="问题分析二" color="border-orange-500/20 bg-orange-500/[0.03]" content={r.outputs.problem2} />
                                            )}
                                        </div>
                                    )}

                                    {/* Comparison 独占一行 */}
                                    {r.outputs.Comparison && (
                                        <OutputCard label="对比总结" color="border-green-500/20 bg-green-500/[0.03]" content={r.outputs.Comparison} />
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </main>
    );
}

// ── Markdown 输出卡片 ──
function OutputCard({ label, color, content }: { label: string; color: string; content: string }) {
    return (
        <div className={`rounded-lg border ${color} p-4 overflow-hidden`}>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">{label}</div>
            <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed text-muted-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground [&_code]:text-primary [&_code]:bg-primary/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-black/30 [&_pre]:border [&_pre]:border-white/10 [&_pre]:rounded-lg [&_table]:border-collapse [&_th]:border [&_th]:border-white/10 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-foreground [&_td]:border [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-1.5 [&_ul]:list-disc [&_ol]:list-decimal [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
        </div>
    );
}
