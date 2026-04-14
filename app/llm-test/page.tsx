"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Loader2, Plus, Trash2, Settings, Zap } from "lucide-react";
import { HamsterLoader } from "@/components/ui/hamster-loader";

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
    config?: { baseURL: string; model: string; thinking_level?: "minimal" | "low" | "medium" | "high" };
}

interface ModelInfo {
    id: string;
    displayName: string;
    contextWindow: number;
    supportsThinking: boolean;
}

interface StepInfo {
    id: string;
    label: string;
}

function isGeminiModelId(modelId: string): boolean {
    return modelId.toLowerCase().includes("gemini");
}

const PRESETS = [
    { label: "Quick ping", prompt: "Say hello in 5 words", maxTokens: 50 },
    { label: "Medium", prompt: "Create a 5-color dark cyberpunk palette. Include hex codes.", maxTokens: 500 },
    { label: "Large", prompt: "Create a comprehensive design system for a modern brand website.", maxTokens: 0 },
];

type Tab = "test" | "models";

/* ═══════════════════════════════════════════════════
   Model Management Panel
   ═══════════════════════════════════════════════════ */
function ModelManagement() {
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [steps, setSteps] = useState<StepInfo[]>([]);
    const [stepModels, setStepModels] = useState<Record<string, string>>({});
    /** Per-step `thinking_level` for chat/completions (used by generate_section when set) */
    const [stepThinkingLevels, setStepThinkingLevels] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    // New model form
    const [newId, setNewId] = useState("");
    const [newName, setNewName] = useState("");
    const [newCtx, setNewCtx] = useState(128000);
    const [newThinking, setNewThinking] = useState(false);
    const [adding, setAdding] = useState(false);
    const [savingStep, setSavingStep] = useState<string | null>(null);

    const fetchModels = useCallback(async () => {
        const res = await fetch("/api/models");
        const data = await res.json();
        setModels(data.models ?? []);
        setSteps(data.steps ?? []);
        setStepModels(data.stepModels ?? {});
        const rawThinking = (data.stepThinkingLevels ?? {}) as Record<string, string | null>;
        const thinking: Record<string, string> = {};
        for (const s of data.steps ?? []) {
            thinking[s.id] = rawThinking[s.id] ?? "";
        }
        setStepThinkingLevels(thinking);
        setLoading(false);
    }, []);

    useEffect(() => { fetchModels(); }, [fetchModels]);

    const handleAdd = async () => {
        if (!newId.trim() || !newName.trim()) return;
        setAdding(true);
        await fetch("/api/models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: newId.trim(), displayName: newName.trim(), contextWindow: newCtx, supportsThinking: newThinking }),
        });
        setNewId(""); setNewName(""); setNewCtx(128000); setNewThinking(false);
        setAdding(false);
        fetchModels();
    };

    const handleDelete = async (id: string) => {
        if (!confirm(`删除模型 ${id}？`)) return;
        await fetch("/api/models", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        });
        fetchModels();
    };

    const handleStepModelChange = async (stepName: string, modelId: string) => {
        setSavingStep(stepName);
        setStepModels((prev) => ({ ...prev, [stepName]: modelId }));
        const canUseThinkingLevel = stepName === "generate_section" && !!modelId && isGeminiModelId(modelId);
        if (!modelId) {
            setStepThinkingLevels((prev) => {
                const next = { ...prev };
                next[stepName] = "";
                return next;
            });
        } else if (!canUseThinkingLevel) {
            setStepThinkingLevels((prev) => {
                const next = { ...prev };
                next[stepName] = "";
                return next;
            });
        }
        const res = await fetch("/api/models", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                stepName,
                modelId: modelId || null,
                ...(canUseThinkingLevel ? { thinkingLevel: stepThinkingLevels[stepName] || null } : { thinkingLevel: null }),
            }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "保存步骤模型失败" }));
            alert(`保存失败：${err.error ?? "未知错误"}`);
            await fetchModels();
        }
        setSavingStep(null);
    };

    const handleStepThinkingChange = async (stepName: string, level: string) => {
        const modelId = stepModels[stepName];
        if (!modelId) return;
        setSavingStep(stepName);
        setStepThinkingLevels((prev) => ({ ...prev, [stepName]: level }));
        const res = await fetch("/api/models", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                stepName,
                modelId,
                thinkingLevel: level || null,
            }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "保存 thinking_level 失败" }));
            alert(`保存失败：${err.error ?? "未知错误"}`);
            await fetchModels();
        }
        setSavingStep(null);
    };

    if (loading) return <div className="flex justify-center py-12"><HamsterLoader size="sm" /></div>;

    return (
        <div className="space-y-8">
            {/* Model list */}
            <div>
                <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">可用模型</h3>
                <div className="space-y-2">
                    {models.map((m) => (
                        <div key={m.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-[12px] font-semibold text-white">{m.displayName}</span>
                                <span className="font-mono text-[10px] text-muted-foreground/70">{m.id}</span>
                                <span className="font-mono text-[10px] text-muted-foreground/60">{(m.contextWindow / 1000).toFixed(0)}K ctx</span>
                                {m.supportsThinking && (
                                    <span className="font-mono text-[9px] text-purple-400/80 border border-purple-400/20 bg-purple-400/5 px-1.5 py-0.5 rounded">Thinking</span>
                                )}
                            </div>
                            <button
                                onClick={() => handleDelete(m.id)}
                                className="rounded-lg p-1.5 text-muted-foreground/60 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                title="删除"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add model form */}
                <div className="mt-4 rounded-xl border border-dashed border-white/10 p-4">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-3">添加自定义模型</div>
                    <div className="grid grid-cols-3 gap-3">
                        <input
                            value={newId}
                            onChange={(e) => setNewId(e.target.value)}
                            placeholder="model-id (如 claude-4)"
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:border-primary/50 outline-none"
                        />
                        <input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="显示名称"
                            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:border-primary/50 outline-none"
                        />
                        <div className="flex gap-2">
                            <input
                                type="number"
                                value={newCtx}
                                onChange={(e) => setNewCtx(parseInt(e.target.value) || 128000)}
                                placeholder="Context"
                                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] text-foreground focus:border-primary/50 outline-none"
                            />
                            <button
                                onClick={() => setNewThinking((v) => !v)}
                                className={`shrink-0 rounded-lg border px-3 py-2 font-mono text-[10px] transition-colors ${newThinking ? "border-purple-400/40 bg-purple-400/10 text-purple-400" : "border-white/10 text-muted-foreground/50 hover:text-foreground"}`}
                                title="支持 Thinking 模式"
                            >
                                {newThinking ? "🧠 Thinking" : "🧠"}
                            </button>
                            <button
                                onClick={handleAdd}
                                disabled={adding || !newId.trim() || !newName.trim()}
                                className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-4 py-2 font-mono text-[10px] text-primary hover:bg-primary/20 transition-colors disabled:opacity-30"
                            >
                                {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                添加
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Step model assignment */}
            <div>
                <h3 className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-4">步骤模型配置</h3>
                <p className="font-mono text-[10px] text-muted-foreground/70 mb-4">
                    为不同的生成步骤指定模型。留空则使用项目默认模型。组件生成步骤可额外设置{" "}
                    <code className="text-muted-foreground/80">thinking_level</code>（会随 LLM 请求透传）。
                </p>
                <div className="space-y-2">
                    {steps.map((step) => (
                        (() => {
                            const selectedModelId = stepModels[step.id] ?? "";
                            const showThinkingLevel =
                                step.id === "generate_section" &&
                                !!selectedModelId &&
                                isGeminiModelId(selectedModelId);
                            return (
                        <div key={step.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
                            <div className="flex items-center gap-3">
                                <Zap className="h-3.5 w-3.5 text-primary/40" />
                                <div>
                                    <span className="font-mono text-[11px] text-white">{step.label}</span>
                                    <span className="ml-2 font-mono text-[10px] text-muted-foreground/60">{step.id}</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={stepModels[step.id] ?? ""}
                                    onChange={(e) => handleStepModelChange(step.id, e.target.value)}
                                    className="appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 pr-8 font-mono text-[10px] text-muted-foreground outline-none cursor-pointer hover:border-primary/30 transition-colors"
                                >
                                    <option value="">默认</option>
                                    {models.map((m) => (
                                        <option key={m.id} value={m.id}>{m.displayName}</option>
                                    ))}
                                </select>
                                {showThinkingLevel && (
                                    <select
                                        value={stepThinkingLevels[step.id] ?? ""}
                                        onChange={(e) => handleStepThinkingChange(step.id, e.target.value)}
                                        disabled={!selectedModelId}
                                        title={!selectedModelId ? "请先为该步骤选择 Gemini 模型" : "thinking_level"}
                                        className="appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 pr-8 font-mono text-[10px] text-muted-foreground outline-none cursor-pointer hover:border-primary/30 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        <option value="">thinking 默认</option>
                                        <option value="minimal">minimal</option>
                                        <option value="low">low</option>
                                        <option value="medium">medium</option>
                                        <option value="high">high</option>
                                    </select>
                                )}
                                {savingStep === step.id && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                            </div>
                        </div>
                            );
                        })()
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════
   LLM Test Panel
   ═══════════════════════════════════════════════════ */
function LLMTestPanel() {
    const [prompt, setPrompt] = useState("Say hello in 5 words");
    const [model, setModel] = useState("");
    const [maxTokens, setMaxTokens] = useState(50);
    const [thinkingLevel, setThinkingLevel] = useState<"" | "minimal" | "low" | "medium" | "high">("");
    const [useSDK, setUseSDK] = useState(false);
    const [running, setRunning] = useState(false);
    const [results, setResults] = useState<TestResult[]>([]);
    const [models, setModels] = useState<ModelInfo[]>([]);

    useEffect(() => {
        fetch("/api/models").then(r => r.json()).then(d => setModels(d.models ?? [])).catch(() => { });
    }, []);

    const runTest = async () => {
        setRunning(true);
        try {
            const res = await fetch("/api/llm-test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt,
                    model: model || undefined,
                    maxTokens: maxTokens || undefined,
                    useSDK,
                    thinking_level: thinkingLevel || undefined,
                }),
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
      <div className="space-y-6">
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">模型</label>
                      <select
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="w-full appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] text-foreground focus:border-primary/50 outline-none cursor-pointer"
                      >
                          <option value="">默认</option>
                          {models.map((m) => (
                              <option key={m.id} value={m.id}>{m.displayName}</option>
                          ))}
                      </select>
                  </div>
                  <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">Max tokens (0 = 无限)</label>
                      <input
                          type="number"
                          value={maxTokens}
                          onChange={(e) => setMaxTokens(parseInt(e.target.value) || 0)}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] text-foreground focus:border-primary/50 outline-none"
                      />
                  </div>
                  <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">thinking_level</label>
                      <select
                          value={thinkingLevel}
                          onChange={(e) =>
                              setThinkingLevel(e.target.value as "" | "minimal" | "low" | "medium" | "high")
                          }
                          className="w-full appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] text-foreground focus:border-primary/50 outline-none cursor-pointer"
                      >
                          <option value="">默认（不指定）</option>
                          <option value="minimal">minimal</option>
                          <option value="low">low</option>
                          <option value="medium">medium</option>
                          <option value="high">high</option>
                      </select>
                  </div>
              </div>

              <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">Prompt</label>
                  <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:border-primary/50 outline-none"
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
                  <button
                      onClick={() => setUseSDK((v) => !v)}
                        className={`rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${useSDK ? "border-primary/40 bg-primary/10 text-primary" : "border-white/10 text-muted-foreground/70 hover:text-foreground"}`}
                  >
                      {useSDK ? "✓ OpenAI SDK" : "Native fetch"}
                  </button>
                  <div className="h-4 w-px bg-white/10" />
                  {PRESETS.map((p) => (
                      <button
                          key={p.label}
                          onClick={() => { setPrompt(p.prompt); setMaxTokens(p.maxTokens); }}
                          className="rounded-lg border border-white/8 px-3 py-1.5 font-mono text-[10px] text-muted-foreground/70 hover:text-foreground hover:border-white/20 transition-colors"
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
                        {r.method && <span className="font-mono text-[9px] text-blue-400/70 border border-blue-400/20 px-1.5 py-0.5 rounded">{r.method}</span>}
                        <span className="font-mono text-[10px] text-muted-foreground">{(r.elapsed / 1000).toFixed(1)}s</span>
                              {r.model && <span className="font-mono text-[10px] text-muted-foreground/70">{r.model}</span>}
                    </div>
                          {r.usage && <span className="font-mono text-[10px] text-muted-foreground/60">{r.usage.prompt_tokens}→{r.usage.completion_tokens} tokens</span>}
                </div>
                <div className="px-4 py-3 space-y-2">
                          {r.config && (
                              <p className="font-mono text-[10px] text-muted-foreground/60">
                                  {r.config.baseURL} · {r.config.model}
                                  {r.config.thinking_level ? ` · thinking_level=${r.config.thinking_level}` : ""}
                              </p>
                          )}
                    {r.content && (
                        <pre className="font-mono text-[10px] text-foreground/70 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto scrollbar-hidden">
                            {r.content}
                        </pre>
                    )}
                    {(r.error || r.code) && (
                        <div className="space-y-1">
                            {r.error && <p className="font-mono text-[10px] text-red-400 break-words">{typeof r.error === "string" ? r.error : JSON.stringify(r.error)}</p>}
                                  {r.code && <p className="font-mono text-[10px] text-red-400/80">code: {r.code}</p>}
                        </div>
                    )}
                </div>
            </div>
        ))}
          </div>
      </div>
    );
}

/* ═══════════════════════════════════════════════════
   Main Page with Tabs
   ═══════════════════════════════════════════════════ */
export default function LLMTestPage() {
    const [tab, setTab] = useState<Tab>("test");

    return (
        <main className="relative min-h-screen bg-background ">

            <div className="relative z-1 mx-auto max-w-4xl px-6 py-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="defi-button-outline px-3 py-2 text-[11px] font-medium">
                            <ArrowLeft className="h-3.5 w-3.5" />
                        </Link>
                        <div>
                            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">Diagnostics</div>
                            <h1 className="text-lg font-semibold text-foreground">LLM 控制台</h1>
                        </div>
                    </div>

                    {/* Tab switcher */}
                    <div className="flex items-center rounded-xl border border-white/8 overflow-hidden">
                        <button
                            onClick={() => setTab("test")}
                            className={`flex items-center gap-1.5 px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${tab === "test" ? "bg-primary/10 text-primary" : "text-muted-foreground/70 hover:text-foreground"}`}
                        >
                            <Play className="h-3 w-3" />
                            测试
                        </button>
                        <button
                            onClick={() => setTab("models")}
                            className={`flex items-center gap-1.5 px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${tab === "models" ? "bg-primary/10 text-primary" : "text-muted-foreground/70 hover:text-foreground"}`}
                        >
                            <Settings className="h-3 w-3" />
                            模型管理
                        </button>
                    </div>
                </div>

                {tab === "test" ? <LLMTestPanel /> : <ModelManagement />}
            </div>
      </main>
  );
}
