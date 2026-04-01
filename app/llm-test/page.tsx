"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Loader2 } from "lucide-react";

interface TestResult {
    success: boolean;
    elapsed: number;
    method?: string;
    httpStatus?: number;
    content?: string;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    model?: string;
    finishReason?: string;
    error?: string;
    code?: string;
    cause?: string;
    causeChain?: string[];
    config?: { baseURL: string; model: string };
}

const PRESETS = [
    { label: "Quick ping", prompt: "Say hello in 5 words", maxTokens: 50 },
    { label: "Medium", prompt: "Create a 5-color dark cyberpunk palette for a tech brand. Include hex codes and usage notes.", maxTokens: 500 },
    { label: "Large (design system)", prompt: "Create a comprehensive design system for a modern bicycle brand website. Include: design philosophy, color palette with hex codes, typography scale, component styles, layout strategy, animation guidelines, spacing system. Be thorough.", maxTokens: 0 },
    { label: "Stress test", prompt: "Write a detailed 2000-word technical specification for a Next.js e-commerce website including all components, pages, API routes, database schema, and deployment strategy.", maxTokens: 0 },
];

export default function LLMTestPage() {
    const [prompt, setPrompt] = useState("Say hello in 5 words");
    const [model, setModel] = useState("");
    const [maxTokens, setMaxTokens] = useState(50);
    const [useSDK, setUseSDK] = useState(false);
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState<TestResult[]>([]);

    const runTest = async () => {
        setRunning(true);
        try {
            const res = await fetch("/api/llm-test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, model: model || undefined, maxTokens: maxTokens || undefined, useSDK }),
            });
            const data = await res.json();
            setResults((prev) => [data, ...prev]);
        } catch (err) {
            setResults((prev) => [{ success: false, elapsed: 0, error: String(err) }, ...prev]);
        } finally {
            setRunning(false);
        }
    };

    return (
        <main className="relative min-h-screen bg-background">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(247,147,26,0.14),transparent_28%)]" />

            <div className="relative z-1 mx-auto max-w-4xl px-6 py-8">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/" className="defi-button-outline px-4 py-2 text-[11px] font-medium flex items-center gap-1.5">
                        <ArrowLeft className="h-4 w-4" />
                        Home
                    </Link>
                    <div>
                        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">Diagnostics</div>
                        <h1 className="text-lg font-semibold text-foreground">LLM API Test</h1>
                    </div>
                </div>

                <div className="rounded-xl border border-white/8 bg-background/60 backdrop-blur-xl p-5 space-y-4 mb-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">Model (empty = default)</label>
                            <input
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                placeholder="gpt-5.2"
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:border-primary/50 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">Max tokens (0 = unlimited)</label>
                            <input
                                type="number"
                                value={maxTokens}
                                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 0)}
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] text-foreground focus:border-primary/50 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">Prompt</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={3}
                            className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:border-primary/50 focus:outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={runTest}
                            disabled={running || !prompt.trim()}
                            className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-primary transition-all hover:bg-primary/20 disabled:opacity-30"
                        >
                            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                            {running ? "Running…" : "Run Test"}
                        </button>

                        {/* SDK toggle */}
                        <button
                            onClick={() => setUseSDK((v) => !v)}
                            className={`rounded-lg border px-3 py-2 font-mono text-[9px] uppercase tracking-widest transition-colors ${useSDK
                                    ? "border-primary/40 bg-primary/10 text-primary"
                                    : "border-white/10 text-muted-foreground/50 hover:text-foreground hover:border-white/20"
                                }`}
                        >
                            {useSDK ? "✓ OpenAI SDK" : "Native fetch"}
                        </button>

                        <div className="h-4 w-px bg-white/10" />

                        {PRESETS.map((p) => (
                            <button
                                key={p.label}
                                onClick={() => { setPrompt(p.prompt); setMaxTokens(p.maxTokens); }}
                                className="rounded-lg border border-white/8 px-3 py-1.5 font-mono text-[9px] text-muted-foreground/60 hover:text-foreground hover:border-white/20 transition-colors"
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    {results.map((r, i) => (
                        <div key={i} className={`rounded-xl border overflow-hidden ${r.success ? "border-green-400/20" : "border-red-400/20"}`}>
                            <div className={`px-4 py-2.5 flex items-center justify-between ${r.success ? "bg-green-400/5" : "bg-red-400/5"}`}>
                                <div className="flex items-center gap-3">
                                    <span className={`font-mono text-[10px] font-bold ${r.success ? "text-green-400" : "text-red-400"}`}>
                                        {r.success ? "✓ OK" : "✗ FAIL"}
                                    </span>
                                    {r.method && (
                                        <span className="font-mono text-[9px] text-blue-400/70 border border-blue-400/20 px-1.5 py-0.5 rounded">{r.method}</span>
                                    )}
                                    <span className="font-mono text-[10px] text-muted-foreground">{(r.elapsed / 1000).toFixed(1)}s</span>
                                    {r.httpStatus && <span className="font-mono text-[9px] text-muted-foreground/50">HTTP {r.httpStatus}</span>}
                                    {r.model && <span className="font-mono text-[9px] text-muted-foreground/50">{r.model}</span>}
                                </div>
                                {r.usage && (
                                    <span className="font-mono text-[9px] text-muted-foreground/40">
                                        {r.usage.prompt_tokens}→{r.usage.completion_tokens} tokens
                                    </span>
                                )}
                            </div>

                            <div className="px-4 py-3 space-y-2">
                                {r.config && (
                                    <p className="font-mono text-[9px] text-muted-foreground/30">
                                        {r.config.baseURL} · {r.config.model}
                                    </p>
                                )}
                                {r.content && (
                                    <pre className="font-mono text-[10px] text-foreground/70 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                        {r.content}
                                    </pre>
                                )}
                                {(r.error || r.code || r.causeChain) && (
                                    <div className="space-y-1">
                                        {r.error && <p className="font-mono text-[10px] text-red-400 break-words">{typeof r.error === "string" ? r.error : JSON.stringify(r.error)}</p>}
                                        {r.code && <p className="font-mono text-[9px] text-red-400/60">code: {r.code}</p>}
                                        {r.cause && <p className="font-mono text-[9px] text-red-400/60">cause: {r.cause}</p>}
                                        {r.causeChain && r.causeChain.length > 0 && (
                                            <p className="font-mono text-[9px] text-red-400/60">chain: {r.causeChain.join(" → ")}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}
