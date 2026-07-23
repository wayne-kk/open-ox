"use client";

import { useState, useEffect, useCallback } from "react";
import { Bot, CircleDollarSign, Cpu, Database, Loader2, Pencil, Play, Plus, RotateCcw, Search, Settings, ShieldCheck, Trash2, Zap } from "lucide-react";
import { HamsterLoader } from "@/components/ui/hamster-loader";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    tokenPrice: { inputPerMTok: number; outputPerMTok: number } | null;
    isBuiltIn: boolean;
    hasCustomOverride: boolean;
    isDefault: boolean;
}

type ModelDraft = {
    id: string;
    displayName: string;
    contextWindow: number;
    supportsThinking: boolean;
    inputPerMTok: number;
    outputPerMTok: number;
};

const EMPTY_MODEL_DRAFT: ModelDraft = {
    id: "",
    displayName: "",
    contextWindow: 128_000,
    supportsThinking: false,
    inputPerMTok: 0.5,
    outputPerMTok: 3,
};

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
    /** Per-step `thinking_level` for chat/completions (page_implement_agent when set for Gemini) */
    const [stepThinkingLevels, setStepThinkingLevels] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const [editingModel, setEditingModel] = useState<ModelInfo | null>(null);
    const [modelDialogOpen, setModelDialogOpen] = useState(false);
    const [modelDraft, setModelDraft] = useState<ModelDraft>(EMPTY_MODEL_DRAFT);
    const [savingModel, setSavingModel] = useState(false);
    const [deletingModel, setDeletingModel] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<ModelInfo | null>(null);
    const [modelError, setModelError] = useState<string | null>(null);
    const [modelQuery, setModelQuery] = useState("");
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

    const openCreateModel = () => {
        setEditingModel(null);
        setModelDraft(EMPTY_MODEL_DRAFT);
        setModelError(null);
        setModelDialogOpen(true);
    };

    const openEditModel = (model: ModelInfo) => {
        setEditingModel(model);
        setModelError(null);
        setModelDraft({
            id: model.id,
            displayName: model.displayName,
            contextWindow: model.contextWindow,
            supportsThinking: model.supportsThinking,
            inputPerMTok: model.tokenPrice?.inputPerMTok ?? 0.5,
            outputPerMTok: model.tokenPrice?.outputPerMTok ?? 3,
        });
        setModelDialogOpen(true);
    };

    const handleSaveModel = async () => {
        if (!modelDraft.id.trim() || !modelDraft.displayName.trim()) return;
        setModelError(null);
        setSavingModel(true);
        try {
            const res = await fetch("/api/models", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: modelDraft.id.trim(),
                    displayName: modelDraft.displayName.trim(),
                    contextWindow: modelDraft.contextWindow,
                    supportsThinking: modelDraft.supportsThinking,
                    tokenPrice: {
                        inputPerMTok: modelDraft.inputPerMTok,
                        outputPerMTok: modelDraft.outputPerMTok,
                    },
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: "添加模型失败" }));
                setModelError(data.error ?? "保存模型失败");
                return;
            }
            setModelDialogOpen(false);
            await fetchModels();
        } catch (error) {
            setModelError(error instanceof Error ? error.message : "网络连接失败");
        } finally {
            setSavingModel(false);
        }
    };

    const handleDelete = async () => {
        if (!pendingDelete) return;
        const id = pendingDelete.id;
        setDeletingModel(id);
        try {
            const res = await fetch("/api/models", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({ error: "删除模型失败" }));
                setModelError(data.error ?? "删除模型失败");
                return;
            }
            setPendingDelete(null);
            await fetchModels();
        } catch (error) {
            setModelError(error instanceof Error ? error.message : "网络连接失败");
        } finally {
            setDeletingModel(null);
        }
    };

    const visibleModels = models.filter((model) => {
        const query = modelQuery.trim().toLowerCase();
        return !query || model.id.toLowerCase().includes(query) || model.displayName.toLowerCase().includes(query);
    });

    const handleStepModelChange = async (stepName: string, modelId: string) => {
        setSavingStep(stepName);
        setStepModels((prev) => ({ ...prev, [stepName]: modelId }));
        const canUseThinkingLevel = stepName === "page_implement_agent" && !!modelId && isGeminiModelId(modelId);
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
        <div className="space-y-10">
            <section aria-labelledby="model-catalog-title">
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                            <Database className="size-4" />
                            <span className="text-xs font-medium">模型目录</span>
                        </div>
                        <h2 id="model-catalog-title" className="text-xl font-semibold text-foreground">可用模型</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{models.length} 个模型，可按模型单独维护参数与计费。</p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                        <label className="relative min-w-64 flex-1 lg:flex-none">
                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input value={modelQuery} onChange={(event) => setModelQuery(event.target.value)} placeholder="搜索名称或模型 ID" className="h-9 pl-9" />
                            <span className="sr-only">搜索模型</span>
                        </label>
                        <Button onClick={openCreateModel} size="lg" className="w-full sm:w-auto">
                            <Plus data-icon="inline-start" />新增模型
                        </Button>
                    </div>
                </div>

                {modelError && <div role="alert" className="mb-4 flex items-start justify-between gap-4 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"><span>{modelError}</span><button onClick={() => setModelError(null)} className="shrink-0 font-medium underline underline-offset-4">关闭</button></div>}

                <div className="overflow-hidden rounded-lg border border-border bg-card/40">
                    <div className="hidden grid-cols-[minmax(220px,1.5fr)_110px_160px_120px_88px] gap-4 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid">
                        <span>模型</span><span>上下文</span><span>单价 / 1M tokens</span><span>能力</span><span className="text-right">操作</span>
                    </div>
                    {visibleModels.map((model) => {
                        const canDelete = !model.isBuiltIn || model.hasCustomOverride;
                        return (
                            <div key={model.id} className="grid gap-3 border-b border-border/70 px-4 py-4 last:border-b-0 hover:bg-muted/20 md:grid-cols-[minmax(220px,1.5fr)_110px_160px_120px_88px] md:items-center md:gap-4">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="truncate text-sm font-medium text-foreground">{model.displayName}</span>
                                        {model.isDefault && <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">默认</span>}
                                        {model.isBuiltIn && <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">系统</span>}
                                    </div>
                                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title={model.id}>{model.id}</p>
                                </div>
                                <div className="text-sm text-foreground md:text-xs">
                                    <span className="mr-2 text-xs text-muted-foreground md:hidden">上下文</span>{(model.contextWindow / 1000).toFixed(0)}K
                                </div>
                                <div className="font-mono text-xs text-foreground">
                                    <span className="mr-2 font-sans text-xs text-muted-foreground md:hidden">输入 / 输出</span>
                                    ${model.tokenPrice?.inputPerMTok ?? "-"} / ${model.tokenPrice?.outputPerMTok ?? "-"}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {model.supportsThinking ? <><Bot className="size-3.5 text-violet-400" /><span>Thinking</span></> : <span>Standard</span>}
                                </div>
                                <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon-sm" onClick={() => openEditModel(model)} title={`编辑 ${model.displayName}`}>
                                        <Pencil /><span className="sr-only">编辑</span>
                                    </Button>
                                    {canDelete ? (
                                        <Button variant="ghost" size="icon-sm" onClick={() => setPendingDelete(model)} disabled={deletingModel === model.id} className="text-muted-foreground hover:text-destructive" title={model.hasCustomOverride ? "恢复系统配置" : "删除模型"}>
                                            {deletingModel === model.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                                            <span className="sr-only">{model.hasCustomOverride ? "恢复系统配置" : "删除"}</span>
                                        </Button>
                                    ) : (
                                        <span className="flex size-7 items-center justify-center text-muted-foreground/60" title="系统兜底不可删除"><ShieldCheck className="size-4" /></span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {visibleModels.length === 0 && <div className="flex flex-col items-center justify-center px-6 py-12 text-center"><Search className="mb-3 size-5 text-muted-foreground" /><p className="text-sm font-medium text-foreground">没有匹配的模型</p><p className="mt-1 text-xs text-muted-foreground">换一个名称或模型 ID 试试。</p></div>}
                </div>
            </section>

            <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
                <DialogContent className="overflow-hidden p-0 sm:max-w-2xl sm:gap-0">
                    <DialogHeader className="border-b border-border px-6 py-5">
                        <div className="flex items-center gap-3">
                            <span className="flex size-9 items-center justify-center rounded-lg border border-border bg-muted/50"><Cpu className="size-4 text-foreground" /></span>
                            <div>
                                <DialogTitle className="text-lg">{editingModel ? "编辑模型" : "新增模型"}</DialogTitle>
                                <DialogDescription className="mt-1 font-mono text-xs">{modelDraft.id || "new-model"}</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="grid max-h-[70vh] overflow-y-auto md:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="space-y-6 px-6 py-5">
                            {modelError && <div role="alert" className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">{modelError}</div>}

                            <fieldset className="grid gap-4 sm:grid-cols-2">
                                <legend className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"><Database className="size-4 text-muted-foreground" />基本信息</legend>
                                <label className="grid gap-2 sm:col-span-2"><span className="text-xs font-medium text-muted-foreground">模型 ID</span><Input value={modelDraft.id} disabled={!!editingModel} onChange={(event) => setModelDraft((draft) => ({ ...draft, id: event.target.value }))} placeholder="gemini-3.5-flash" className="h-9 font-mono" /></label>
                                <label className="grid gap-2 sm:col-span-2"><span className="text-xs font-medium text-muted-foreground">显示名称</span><Input value={modelDraft.displayName} onChange={(event) => setModelDraft((draft) => ({ ...draft, displayName: event.target.value }))} placeholder="Gemini 3.5 Flash" className="h-9" /></label>
                                <label className="grid gap-2"><span className="text-xs font-medium text-muted-foreground">上下文窗口</span><div className="relative"><Input type="number" min={1} value={modelDraft.contextWindow} onChange={(event) => setModelDraft((draft) => ({ ...draft, contextWindow: Number(event.target.value) }))} className="h-9 pr-16" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">tokens</span></div></label>
                                <div className="grid gap-2"><span className="text-xs font-medium text-muted-foreground">Thinking</span><button type="button" aria-pressed={modelDraft.supportsThinking} onClick={() => setModelDraft((draft) => ({ ...draft, supportsThinking: !draft.supportsThinking }))} className="flex h-9 items-center justify-between rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"><span className={modelDraft.supportsThinking ? "text-foreground" : "text-muted-foreground"}>{modelDraft.supportsThinking ? "已启用" : "未启用"}</span><span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${modelDraft.supportsThinking ? "bg-primary" : "bg-muted"}`}><span className={`block size-4 rounded-full bg-white shadow-sm transition-transform ${modelDraft.supportsThinking ? "translate-x-4" : ""}`} /></span></button></div>
                            </fieldset>

                            <fieldset className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                                <legend className="flex items-center gap-2 bg-background pr-2 text-sm font-semibold text-foreground"><CircleDollarSign className="size-4 text-muted-foreground" />Token 单价</legend>
                                <label className="grid gap-2"><span className="text-xs font-medium text-muted-foreground">输入</span><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span><Input type="number" min={0} step="0.01" value={modelDraft.inputPerMTok} onChange={(event) => setModelDraft((draft) => ({ ...draft, inputPerMTok: Number(event.target.value) }))} className="h-9 pl-7 pr-14" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/ 1M</span></div></label>
                                <label className="grid gap-2"><span className="text-xs font-medium text-muted-foreground">输出</span><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span><Input type="number" min={0} step="0.01" value={modelDraft.outputPerMTok} onChange={(event) => setModelDraft((draft) => ({ ...draft, outputPerMTok: Number(event.target.value) }))} className="h-9 pl-7 pr-14" /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">/ 1M</span></div></label>
                            </fieldset>
                        </div>

                        <aside className="border-t border-border bg-muted/20 px-5 py-5 md:border-l md:border-t-0">
                            <p className="text-xs font-medium text-muted-foreground">配置预览</p>
                            <div className="mt-4 space-y-4">
                                <div><p className="truncate text-sm font-semibold text-foreground">{modelDraft.displayName || "未命名模型"}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{modelDraft.id || "model-id"}</p></div>
                                <dl className="space-y-3 border-t border-border pt-4 text-xs"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">上下文</dt><dd className="font-medium text-foreground">{Math.round(modelDraft.contextWindow / 1000)}K</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">输入 / 输出</dt><dd className="font-mono text-foreground">${modelDraft.inputPerMTok} / ${modelDraft.outputPerMTok}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Thinking</dt><dd className="font-medium text-foreground">{modelDraft.supportsThinking ? "On" : "Off"}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">来源</dt><dd className="font-medium text-foreground">{editingModel?.isBuiltIn ? "系统覆盖" : "自定义"}</dd></div></dl>
                            </div>
                        </aside>
                    </div>

                    <DialogFooter className="m-0 rounded-none border-t border-border bg-background px-6 py-4">
                        <Button variant="ghost" onClick={() => setModelDialogOpen(false)}>取消</Button>
                        <Button onClick={handleSaveModel} disabled={savingModel || !modelDraft.id.trim() || !modelDraft.displayName.trim() || modelDraft.contextWindow <= 0}>
                            {savingModel && <Loader2 data-icon="inline-start" className="animate-spin" />}保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
                <AlertDialogContent className="max-w-md p-0">
                    <AlertDialogHeader className="px-5 pt-5">
                        <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">{pendingDelete?.hasCustomOverride ? <RotateCcw className="size-4" /> : <Trash2 className="size-4" />}</span>
                        <AlertDialogTitle>{pendingDelete?.hasCustomOverride ? "恢复系统配置？" : "删除模型？"}</AlertDialogTitle>
                        <AlertDialogDescription className="leading-relaxed">{pendingDelete?.hasCustomOverride ? `${pendingDelete.displayName} 的自定义覆盖将被移除。` : `${pendingDelete?.displayName ?? "该模型"} 及其步骤绑定将被删除。`}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="mx-5 rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">{pendingDelete?.id}</div>
                    <AlertDialogFooter className="mt-5 border-t border-border bg-muted/20 px-5 py-4">
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction variant={pendingDelete?.hasCustomOverride ? "default" : "destructive"} onClick={() => void handleDelete()}>{pendingDelete?.hasCustomOverride ? "恢复" : "删除"}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Step model assignment */}
            <section aria-labelledby="step-model-title">
                <div className="mb-4">
                    <div className="mb-1 flex items-center gap-2 text-muted-foreground"><Zap className="size-4" /><span className="text-xs font-medium">运行时路由</span></div>
                    <h2 id="step-model-title" className="text-xl font-semibold text-foreground">步骤模型配置</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">未单独配置的步骤使用系统默认模型。Gemini 模型可按步骤设置 thinking level。</p>
                </div>
                <div className="overflow-hidden rounded-lg border border-border bg-card/40">
                    {steps.map((step) => (
                        (() => {
                            const selectedModelId = stepModels[step.id] ?? "";
                            const showThinkingLevel =
                                !!selectedModelId && isGeminiModelId(selectedModelId);
                            return (
                        <div key={step.id} className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 last:border-b-0 hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                <Zap className="h-3.5 w-3.5 text-primary/40" />
                                <div>
                                    <span className="text-sm font-medium text-foreground">{step.label}</span>
                                    <span className="ml-2 font-mono text-xs text-muted-foreground">{step.id}</span>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={stepModels[step.id] ?? ""}
                                    onChange={(e) => handleStepModelChange(step.id, e.target.value)}
                                    className="h-8 min-w-44 appearance-none rounded-lg border border-input bg-background px-3 pr-8 text-xs text-foreground outline-none transition-colors hover:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                >
                                    <option value="">系统默认</option>
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
                                        className="h-8 appearance-none rounded-lg border border-input bg-background px-3 pr-8 text-xs text-foreground outline-none transition-colors hover:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40"
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
            </section>
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
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">模型</label>
                      <select
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="w-full appearance-none rounded-lg border border-border bg-muted px-3 py-2 font-mono text-[11px] text-foreground focus:border-primary/50 outline-none cursor-pointer"
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
                          className="w-full rounded-lg border border-border bg-muted px-3 py-2 font-mono text-[11px] text-foreground focus:border-primary/50 outline-none"
                      />
                  </div>
                  <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block mb-1.5">thinking_level</label>
                      <select
                          value={thinkingLevel}
                          onChange={(e) =>
                              setThinkingLevel(e.target.value as "" | "minimal" | "low" | "medium" | "high")
                          }
                          className="w-full appearance-none rounded-lg border border-border bg-muted px-3 py-2 font-mono text-[11px] text-foreground focus:border-primary/50 outline-none cursor-pointer"
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
                      className="w-full resize-none rounded-lg border border-border bg-muted px-3 py-2 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:border-primary/50 outline-none"
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
                        className={`rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${useSDK ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground/70 hover:text-foreground"}`}
                  >
                      {useSDK ? "✓ OpenAI SDK" : "Native fetch"}
                  </button>
                  <div className="h-4 w-px bg-white/10" />
                  {PRESETS.map((p) => (
                      <button
                          key={p.label}
                          onClick={() => { setPrompt(p.prompt); setMaxTokens(p.maxTokens); }}
                          className="rounded-lg border border-border px-3 py-1.5 font-mono text-[10px] text-muted-foreground/70 hover:text-foreground hover:border-white/20 transition-colors"
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
    const [tab, setTab] = useState<Tab>("models");

    return (
        <div className="relative bg-background">
            <div className="relative z-1 mx-auto max-w-6xl py-2">
                <div className="mb-10 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <div>
                            <div className="mb-1 text-xs font-medium text-muted-foreground">AI 基础设施</div>
                            <h1 className="text-2xl font-semibold text-foreground">模型控制台</h1>
                        </div>
                    </div>

                    {/* Tab switcher */}
                    <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-muted/20 p-1">
                        <button
                            onClick={() => setTab("test")}
                            className={`flex h-8 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors ${tab === "test" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            <Play className="h-3 w-3" />
                            测试
                        </button>
                        <button
                            onClick={() => setTab("models")}
                            className={`flex h-8 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors ${tab === "models" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            <Settings className="h-3 w-3" />
                            模型管理
                        </button>
                    </div>
                </div>

                {tab === "test" ? <LLMTestPanel /> : <ModelManagement />}
            </div>
      </div>
  );
}
