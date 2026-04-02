"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, CircleCheckBig, Play, Trash2, Send, Wand2, RefreshCw, ChevronDown } from "lucide-react";
import { ChatBubble } from "./ui/ChatBubble";
import { LogSection } from "./ui/LogSection";
import { TermLine } from "./ui/TermLine";
import { StepRow } from "./StepRow";
import { BlueprintOverview } from "./BlueprintOverview";
import type { BuildStudioState, ModifyRecord } from "../hooks/useBuildStudio";

function formatMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function buildFileTree(files: string[]): string {
    return files
        .map((file, index) => {
            const isLast = index === files.length - 1;
            return `  ${isLast ? "└──" : "├──"} ${file}`;
        })
        .join("\n");
}

function buildIndentedList(values: string[]): string {
    return values.map((value) => `  - ${value}`).join("\n");
}

function ModifyBubble({ record }: { record: ModifyRecord }) {
    return (
        <ChatBubble role="user">
            <div className="text-[11px] font-medium text-foreground">You</div>
            <pre className="mt-2 whitespace-pre-wrap font-body text-[14px] leading-7 text-foreground">
                {record.instruction}
            </pre>
        </ChatBubble>
    );
}

function ModifyResultBubble({ record }: { record: ModifyRecord }) {
    return (
        <ChatBubble role="assistant">
            <div className="text-[11px] font-medium text-foreground">修改助手</div>
            <div className="mt-3 space-y-3">
                {/* AI Analysis */}
                {record.plan && (
                    <LogSection title="Analysis">
                        <div className="space-y-1 text-[12px] leading-6 text-foreground/80">
                            <p>{record.plan.analysis}</p>
                        </div>
                        <div className="mt-2 space-y-1">
                            {record.plan.changes.map((c) => (
                                <div key={c.path} className="flex items-start gap-2 font-mono text-[10px]">
                                    <span className={c.action === "create" ? "text-green-400" : c.action === "delete" ? "text-red-400" : "text-amber-300"}>
                                        {c.action === "create" ? "NEW" : c.action === "delete" ? "DEL" : "MOD"}
                                    </span>
                                    <div>
                                        <span className="text-foreground/60">{c.path}</span>
                                        <p className="text-muted-foreground/40">{c.reasoning}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </LogSection>
                )}

                {/* Modified files with diffs */}
                {record.diffs.length > 0 && (
                    <LogSection title="Changed Files">
                        <div className="space-y-2">
                            {record.diffs.map((diff) => (
                                <div key={diff.file} className="rounded-lg border border-white/6 overflow-hidden">
                                    <div className="bg-white/3 px-3 py-1.5 flex items-center justify-between">
                                        <span className="font-mono text-[10px] text-foreground/60">{diff.file}</span>
                                        <span className="font-mono text-[9px]">
                                            <span className="text-green-400/70">+{diff.stats.additions}</span>{" "}
                                            <span className="text-red-400/70">-{diff.stats.deletions}</span>
                                        </span>
                                    </div>
                                    <div className="px-3 py-1.5">
                                        <p className="font-mono text-[9px] text-primary/50 italic">{diff.reasoning}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </LogSection>
                )}

                {record.error && (
                    <LogSection title="Error">
                        <TermLine color="text-red-400">error: {record.error}</TermLine>
                    </LogSection>
                )}

                {!record.error && (
                    <div className="px-1 text-[12px] text-muted-foreground">
                        修改完成。共更新 {record.diffs.length} 个文件。
                    </div>
                )}
            </div>
        </ChatBubble>
    );
}

export function BuildConversation({
    input,
    setInput,
    loading,
    clearing,
    response,
    lastRunInput,
    elapsed,
    flowStart,
    handleRun,
    handleClear,
    handleRetry,
    selectedModel,
    setSelectedModel,
    availableModels,
    projectId,
    setProjectId,
    modifyInstruction,
    setModifyInstruction,
    modifying,
    handleModify,
    modifyHistory,
    modifyToolCalls,
}: BuildStudioState) {
    const chatRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    }, [response, loading]);

    return (
        <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden lg:w-[540px] lg:max-h-full scrollbar-hidden">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-2">
                <div>
                    <div className="text-sm font-semibold text-foreground">Build conversation</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                        Describe what to build and watch the flow respond.
                    </div>
                </div>
                <span className="rounded-full border border-white/10 bg-white/4 px-3 py-1 text-[11px] text-muted-foreground">
                    Live
                </span>
            </div>

            <div ref={chatRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="space-y-5">
                    {!response && !loading ? (
                        <ChatBubble role="assistant">
                            <div className="text-sm font-medium text-foreground">你想构建什么？</div>
                            <p className="mt-2 text-sm leading-7 text-muted-foreground">
                                描述你想要的页面、应用或视觉系统，我会将它转化为一个完整的构建流程，并在这里实时推送每一步的执行详情。
                            </p>
                        </ChatBubble>
                    ) : null}

                    {lastRunInput ? (
                        <ChatBubble role="user">
                            <div className="text-[11px] font-medium text-foreground">You</div>
                            <pre className="mt-2 whitespace-pre-wrap font-body text-[14px] leading-7 text-foreground">
                                {lastRunInput}
                            </pre>
                        </ChatBubble>
                    ) : null}

                    {response || loading ? (
                        <ChatBubble role="assistant">
                            <div className="text-[11px] font-medium text-foreground">构建助手</div>
                            <div className="mt-3 space-y-3">
                                <LogSection title="Command">
                                    <TermLine prefix="$" color="text-white">
                                        run build_site{" "}
                                        <span className="text-muted-foreground">
                                            &quot;
                                            {(lastRunInput ?? input).length > 72
                                                ? `${(lastRunInput ?? input).slice(0, 72)}...`
                                                : lastRunInput ?? input}
                                            &quot;
                                        </span>
                                    </TermLine>
                                </LogSection>

                                <LogSection title="执行日志">
                                    <div className="space-y-0.5">
                                        {response?.buildSteps?.map((step, index) => (
                                            <StepRow key={`${step.step}-${index}`} step={step} flowStart={flowStart} />
                                        ))}
                                        {loading ? (
                                            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
                                                <TermLine color="text-primary">
                                                    <span className="animate-pulse">[network_live]</span>
                                                    <span className="ml-2 text-muted-foreground">
                                                        executing... {formatMs(elapsed)}
                                                    </span>
                                                </TermLine>
                                            </div>
                                        ) : null}
                                    </div>
                                </LogSection>

                                {response?.content ? (
                                    <LogSection title="Summary">
                                        <div className="space-y-1 text-[13px] leading-6 text-foreground">
                                            {response.content.split("\n").filter(Boolean).map((line, i) => (
                                                <p key={i}>{line}</p>
                                            ))}
                                        </div>
                                    </LogSection>
                                ) : null}

                                {response?.verificationStatus ? (
                                    <LogSection title="Verification">
                                        <TermLine
                                            color={response.verificationStatus === "passed" ? "text-emerald-300" : "text-amber-300"}
                                        >
                                            {response.verificationStatus === "passed" ? (
                                                <><CircleCheckBig className="mr-2 inline h-4 w-4" />verification_passed</>
                                            ) : (
                                                <><AlertTriangle className="mr-2 inline h-4 w-4" />verification_failed</>
                                            )}
                                        </TermLine>
                                    </LogSection>
                                ) : null}

                                {response?.installedDependencies && response.installedDependencies.length > 0 ? (
                                    <LogSection title="Installed Dependencies">
                                        <pre className="overflow-x-hidden whitespace-pre-wrap break-all text-[12px] leading-6 text-muted-foreground">
                                            {buildIndentedList(
                                                response.installedDependencies.map((item) => `${item.packageName} <- ${item.files.join(", ")}`)
                                            )}
                                        </pre>
                                    </LogSection>
                                ) : null}

                                {response?.dependencyInstallFailures && response.dependencyInstallFailures.length > 0 ? (
                                    <LogSection title="Dependency Install Failures">
                                        <pre className="overflow-x-hidden whitespace-pre-wrap break-all text-[12px] leading-6 text-red-200/85">
                                            {buildIndentedList(
                                                response.dependencyInstallFailures.map((item) => `${item.packageName}: ${item.error}`)
                                            )}
                                        </pre>
                                    </LogSection>
                                ) : null}

                                {response?.generatedFiles && response.generatedFiles.length > 0 ? (
                                    <LogSection title="Generated Files">
                                        <pre className="overflow-x-hidden break-all text-[12px] leading-6 text-muted-foreground">
                                            {buildFileTree(response.generatedFiles)}
                                        </pre>
                                    </LogSection>
                                ) : null}

                                {response?.blueprint ? (
                                    <LogSection title="Blueprint Overview">
                                        <BlueprintOverview blueprint={response.blueprint} />
                                    </LogSection>
                                ) : null}

                                {response?.unvalidatedFiles && response.unvalidatedFiles.length > 0 ? (
                                    <LogSection title="Unvalidated Files">
                                        <pre className="overflow-x-hidden break-all text-[12px] leading-6 text-amber-100/80">
                                            {buildFileTree(response.unvalidatedFiles)}
                                        </pre>
                                    </LogSection>
                                ) : null}

                                {response?.logDirectory ? (
                                    <LogSection title="Log Directory">
                                        <pre className="overflow-x-hidden whitespace-pre-wrap break-all text-[12px] leading-6 text-muted-foreground">
                                            {response.logDirectory}
                                        </pre>
                                    </LogSection>
                                ) : null}

                                {response?.error ? (
                                    <LogSection title="Error">
                                        <TermLine color="text-red-400">error: {response.error}</TermLine>
                                        {projectId && !loading && (
                                            <button
                                                type="button"
                                                onClick={handleRetry}
                                                className="mt-3 defi-button-outline flex items-center gap-2 px-4 py-2 text-[11px] font-medium"
                                            >
                                                <RefreshCw className="h-3.5 w-3.5" />
                                                重新生成
                                            </button>
                                        )}
                                    </LogSection>
                                ) : null}

                                {response && !loading ? (
                                    <div className="px-1 text-[12px] text-muted-foreground">
                                        {response.error
                                            ? "流程执行失败。"
                                            : response.verificationStatus === "failed"
                                                ? "流程完成，构建验证待处理。"
                                                : "流程执行完毕。"}
                                        {response.buildTotalDuration ? ` 总耗时 ${formatMs(response.buildTotalDuration)}。` : ""}
                                    </div>
                                ) : null}
                            </div>
                        </ChatBubble>
                    ) : null}

                    {/* Modify history — each modify run as a conversation pair */}
                    {modifyHistory.map((record, i) => (
                        <div key={i} className="space-y-5">
                            <ModifyBubble record={record} />
                            <ModifyResultBubble record={record} />
                        </div>
                    ))}

                    {/* In-progress modify */}
                    {modifying && (
                        <ChatBubble role="assistant">
                            <div className="text-[11px] font-medium text-foreground">修改助手</div>
                            <div className="mt-3 space-y-1.5">
                                {modifyToolCalls.map((tc, i) => (
                                    <div key={i} className="flex items-start gap-2 font-mono text-[10px]">
                                        <span className={
                                            tc.tool === "edit_file" || tc.tool === "write_file" ? "text-amber-300" :
                                                tc.tool === "run_build" ? "text-green-400" :
                                                    "text-primary/60"
                                        }>
                                            {tc.tool}
                                        </span>
                                        <span className="text-muted-foreground/50 truncate max-w-[300px]">
                                            {tc.tool === "read_file" || tc.tool === "edit_file" || tc.tool === "write_file"
                                                ? (tc.args.path as string ?? "")
                                                : tc.tool === "search_code"
                                                    ? (tc.args.pattern as string ?? "")
                                                    : tc.result.slice(0, 60)}
                                        </span>
                                    </div>
                                ))}
                                <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
                                    <TermLine color="text-primary">
                                        <span className="animate-pulse">[agent]</span>
                                        <span className="ml-2 text-muted-foreground">
                                            {modifyToolCalls.length} tool calls...
                                        </span>
                                    </TermLine>
                                </div>
                            </div>
                        </ChatBubble>
                    )}
                </div>
            </div>

            {/* Input area */}
            <div className="border-t border-white/8 px-4 py-4">
                {projectId && !loading ? (
                    /* Modify mode — project exists */
                    <div className="rounded-[24px] border border-white/10 bg-black/25 p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Wand2 className="h-3 w-3 text-primary/60" />
                                <span className="font-mono text-[9px] uppercase tracking-widest text-primary/60">Modify project</span>
                            </div>
                            <div className="relative">
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    disabled={modifying}
                                    className="appearance-none rounded-full border border-white/8 bg-white/5 pl-2.5 pr-6 py-1 font-mono text-[9px] text-muted-foreground/60 outline-none cursor-pointer hover:border-primary/30 transition-colors disabled:opacity-50"
                                >
                                    {availableModels.map((m) => (
                                        <option key={m.id} value={m.id}>{m.displayName}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-muted-foreground/30 pointer-events-none" />
                            </div>
                        </div>
                        <label className="sr-only" htmlFor="modify-input">修改指令</label>
                        <textarea
                            id="modify-input"
                            rows={1}
                            className="w-full resize-none border-0 bg-transparent px-1 py-1 font-body text-[14px] leading-7 text-foreground outline-none placeholder:text-white/30 max-h-[200px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                            value={modifyInstruction}
                            onChange={(e) => {
                                setModifyInstruction(e.target.value);
                                e.target.style.height = "auto";
                                e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
                            }}
                            onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !modifying) {
                                    e.preventDefault();
                                    void handleModify();
                                }
                            }}
                            placeholder="描述要修改的内容..."
                        />
                        <div className="mt-3 flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setProjectId(null);
                                    window.history.replaceState(null, "", "/build-studio");
                                }}
                                className="defi-button-outline flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium"
                            >
                                <Play className="h-3.5 w-3.5" />
                                New build
                            </button>
                            <div className="hidden text-xs text-muted-foreground sm:block">Cmd/Ctrl + Enter</div>
                            <button
                                type="button"
                                onClick={handleModify}
                                disabled={modifying || !modifyInstruction.trim()}
                                className="defi-button flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {modifying ? (
                                    <>
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        Modifying…
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4" />
                                        Apply
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Generate mode */
                    <div className="rounded-[20px] border border-white/10 bg-black/25 p-3">
                        {/* Top bar: model selector + shortcut hint */}
                        <div className="flex items-center justify-between mb-2 px-1">
                            <div className="relative">
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    disabled={loading}
                                    className="appearance-none rounded-full border border-white/8 bg-white/5 pl-2.5 pr-6 py-1 font-mono text-[9px] text-muted-foreground/60 outline-none cursor-pointer hover:border-primary/30 transition-colors disabled:opacity-50"
                                >
                                    {availableModels.map((m) => (
                                        <option key={m.id} value={m.id}>{m.displayName}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-muted-foreground/30 pointer-events-none" />
                            </div>
                            <span className="font-mono text-[9px] text-muted-foreground/25">⌘+Enter</span>
                        </div>

                        <label className="sr-only" htmlFor="build-studio-input">输入站点需求</label>
                        <textarea
                            id="build-studio-input"
                            rows={1}
                            className="w-full resize-none border-0 bg-transparent px-1 py-1 font-body text-[14px] leading-7 text-foreground outline-none placeholder:text-white/30 max-h-[200px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                e.target.style.height = "auto";
                                e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
                            }}
                            onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !loading) {
                                    e.preventDefault();
                                    void handleRun();
                                }
                            }}
                            placeholder="描述你想要生成的网站..."
                        />

                        {/* Bottom: Run button right-aligned */}
                        <div className="mt-2 flex items-center justify-end">
                            <button
                                type="button"
                                onClick={handleRun}
                                disabled={loading}
                                className="defi-button flex items-center justify-center gap-2 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        {formatMs(elapsed)}
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-3.5 w-3.5" />
                                        Run
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
