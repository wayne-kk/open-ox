"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CircleCheckBig, Play, Send, Wand2, RefreshCw } from "lucide-react";
import { ChatBubble } from "./ui/ChatBubble";
import { LogSection } from "./ui/LogSection";
import { TermLine } from "./ui/TermLine";
import { StepRow } from "./StepRow";
import { BlueprintOverview } from "./BlueprintOverview";
import { MemoryDebugPanel } from "./MemoryDebugPanel";
import { StudioMessageMarkdown } from "./StudioMessageMarkdown";
import { SlashMenu } from "@/app/components/ui/SlashMenu";
import { useSlashMenu } from "@/app/hooks/useSlashMenu";
import {
  isRecoverableGenerationError,
  stripRecoverablePrefixForDisplay,
} from "@/lib/generationRecovery";
import type { BuildStudioState, ModifyRecord, ModifyDiff } from "../hooks/useBuildStudio";

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

function GeneratedFilesList({ files }: { files: string[] }) {
    const [copiedPath, setCopiedPath] = useState<string | null>(null);

    const copyPath = async (relPath: string) => {
        try {
            await navigator.clipboard.writeText(relPath);
            setCopiedPath(relPath);
            setTimeout(() => setCopiedPath(null), 1_200);
        } catch {
            // Ignore clipboard failures.
        }
    };

    if (!files.length) {
        return null;
    }

    return (
        <div className="rounded-xl border border-white/8 bg-black/20 overflow-hidden">
            <div className="max-h-[min(40vh,280px)] overflow-y-auto scrollbar-unified divide-y divide-white/[0.06]">
                {files.map((file) => (
                    <div
                        key={file}
                        className="flex items-center gap-2 px-3 py-2 text-[11px] hover:bg-white/[0.03]"
                    >
                        <span className="shrink-0 text-primary/45 font-mono text-[10px]">›</span>
                        <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground/90" title={file}>
                            {file}
                        </span>
                        <button
                            type="button"
                            onClick={() => void copyPath(file)}
                            className="shrink-0 rounded-md border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80 transition-colors hover:border-white/18 hover:text-foreground"
                        >
                            {copiedPath === file ? "已复制" : "路径"}
                        </button>
                    </div>
                ))}
            </div>
            <p className="border-t border-white/8 bg-black/15 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground/85">
                已生成 <span className="text-foreground/90">{files.length}</span> 个文件。
                不在此处展开源码；请在右侧边栏打开「代码」面板浏览与编辑。
            </p>
        </div>
    );
}

function DiffBlock({ diff }: { diff: ModifyDiff }) {
    const [open, setOpen] = useState(false);
    const lines = diff.patch.split("\n");

    return (
        <div className="rounded-lg border border-white/8 overflow-hidden text-[11px] font-mono">
            {/* Header row */}
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between bg-white/3 px-3 py-2 hover:bg-white/5 transition-colors text-left"
            >
                <span className="text-foreground/80 truncate max-w-[60%]">{diff.file}</span>
                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-green-400/80">+{diff.stats.additions}</span>
                    <span className="text-red-400/80">-{diff.stats.deletions}</span>
                    <span className={`text-muted-foreground/50 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
                </div>
            </button>

            {/* Diff lines */}
            {open && (
                <div className="overflow-x-auto bg-[#080a0d]">
                    {lines.map((line, i) => {
                        const isAdd = line.startsWith("+") && !line.startsWith("+++");
                        const isDel = line.startsWith("-") && !line.startsWith("---");
                        const isHunk = line.startsWith("@@");
                        const isMeta = line.startsWith("---") || line.startsWith("+++");
                        return (
                            <div
                                key={i}
                                className={`px-3 py-px whitespace-pre leading-5 ${isAdd ? "bg-green-500/10 text-green-300/90" :
                                    isDel ? "bg-red-500/10 text-red-300/80" :
                                        isHunk ? "text-blue-400/60 bg-blue-500/5" :
                                            isMeta ? "text-muted-foreground/40" :
                                                "text-muted-foreground/60"
                                    }`}
                            >
                                {line || " "}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function normalizeMessageDedupe(s: string): string {
    return s.trim().replace(/\s+/g, " ");
}

/** Drop thinking entries that duplicate the primary assistant summary (same SSE mapped to plan + thinking). */
function filterThinkingDedupe(thinking: string[], primary: string): string[] {
    const p = normalizeMessageDedupe(primary);
    if (!p) return thinking;
    return thinking.filter((t) => normalizeMessageDedupe(t) !== p);
}

/** 模型逐步推理内容：默认折叠，避免与主摘要重复占屏。 */
function CollapsedThinkingBlock({ thinking }: { thinking: string[] }) {
    if (thinking.length === 0) return null;
    return (
        <details className="group rounded-xl border border-white/8 bg-black/25 overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 font-mono text-[10px] text-muted-foreground/90 select-none hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
                <span className="inline-block text-primary/50 transition-transform duration-200 group-open:rotate-90">▶</span>
                <span className="uppercase tracking-wider">思考过程</span>
                <span className="text-muted-foreground/45">({thinking.length})</span>
            </summary>
            <div className="max-h-[min(50vh,360px)] space-y-2 overflow-y-auto border-t border-white/6 px-3 py-2">
                {thinking.map((t, i) => (
                    <div
                        key={`think-${i}`}
                        className="break-words font-mono text-[10px] leading-4 whitespace-pre-wrap text-foreground/65"
                    >
                        {t.length > 12_000 ? `${t.slice(0, 12_000)}…` : t}
                    </div>
                ))}
            </div>
        </details>
    );
}

function ModifyBubble({ record }: { record: ModifyRecord }) {
    return (
        <ChatBubble role="user">
            <div className="space-y-3">
                {record.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={record.image}
                        alt="attached"
                        className="max-h-64 rounded-lg border border-white/10 object-cover"
                    />
                )}
                <pre className="whitespace-pre-wrap font-body text-[14px] leading-7 text-foreground">
                    {record.instruction}
                </pre>
            </div>
        </ChatBubble>
    );
}

function ModifyResultBubble({ record }: { record: ModifyRecord }) {
    if (record.isSystemMessage) {
        return (
            <ChatBubble role="assistant">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70 font-mono">
                    <span className="text-amber-300/60">⌘</span>
                    <span>对话上下文已清空。下次修改将从零开始，不携带历史记忆。</span>
                </div>
            </ChatBubble>
        );
    }

    const analysisPrimary = (record.plan?.analysis ?? "").trim();
    const dedupedThinking = filterThinkingDedupe(record.thinking ?? [], analysisPrimary);
    const toolCalls = record.toolCalls ?? [];
    const hasTrace = dedupedThinking.length > 0 || toolCalls.length > 0;

    return (
        <ChatBubble role="assistant">
            <div className="text-[11px] font-medium text-foreground">修改助手</div>
            <div className="mt-3 space-y-3">
                {record.plan && (
                    <LogSection title="Analysis">
                        <StudioMessageMarkdown content={record.plan.analysis} />
                        <div className="mt-2 space-y-1">
                            {record.plan.changes.map((c) => (
                                <div key={c.path} className="flex items-start gap-2 font-mono text-[10px]">
                                    <span className={c.action === "create" ? "text-green-400" : c.action === "delete" ? "text-red-400" : "text-amber-300"}>
                                        {c.action === "create" ? "NEW" : c.action === "delete" ? "DEL" : "MOD"}
                                    </span>
                                    <div>
                                        <span className="text-foreground/80">{c.path}</span>
                                        <p className="text-muted-foreground/60">{c.reasoning}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </LogSection>
                )}

                {hasTrace && (
                    <div className="space-y-2">
                        <CollapsedThinkingBlock thinking={dedupedThinking} />
                        {toolCalls.length > 0 && (
                            <LogSection title="Tool calls">
                                <div className="space-y-1">
                                    {toolCalls.map((tc, i) => (
                                        <div key={`tc-${i}`} className="flex items-start gap-2 font-mono text-[10px]">
                                            <span className={
                                                tc.tool === "edit_file" || tc.tool === "write_file" ? "text-amber-300" :
                                                    tc.tool === "run_build" ? "text-green-400" :
                                                        "text-primary/60"
                                            }>
                                                {tc.tool}
                                            </span>
                                            <span className="max-w-[280px] truncate text-muted-foreground/70">
                                                {tc.tool === "read_file" || tc.tool === "edit_file" || tc.tool === "write_file"
                                                    ? (tc.args.path as string ?? "")
                                                    : tc.tool === "search_code"
                                                        ? (tc.args.pattern as string ?? "")
                                                        : tc.tool === "list_dir"
                                                            ? (tc.args.path as string ?? "")
                                                            : tc.result.slice(0, 80)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </LogSection>
                        )}
                    </div>
                )}

                {/* Modified files with diffs */}
                {record.diffs.length > 0 && (
                    <LogSection title="Changed Files">
                        <div className="space-y-2">
                            {record.diffs.map((diff) => (
                                <DiffBlock key={diff.file} diff={diff} />
                            ))}
                        </div>
                    </LogSection>
                )}

                {record.error && (
                    <LogSection title="Error">
                        <TermLine color="text-red-400">error: {record.error}</TermLine>
                    </LogSection>
                )}

                {!record.error && record.diffs.length > 0 && (
                    <div className="px-1 text-[12px] text-muted-foreground">
                        修改完成。共更新 {record.diffs.length} 个文件。
                    </div>
                )}

                {!record.error && record.diffs.length === 0 && !record.plan?.analysis && (
                    <div className="px-1 text-[12px] text-amber-300/70">
                        修改助手未能完成修改，也没有提供分析。请重试或换一种方式描述。
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
    mergedBrief,
    conversationMessages,
    lastRunInput,
    elapsed,
    flowStart,
    handleRun,
    handleClear,
    handleRetry,
    generationSeemsStuck,
    recoveryUnlocking,
    handleUnlockInterruptedGeneration,
    handleContinueFromCheckpoint,
    projectId,
    setProjectId,
    modifyInstruction,
    setModifyInstruction,
    modifyImage,
    setModifyImage,
    modifying,
    handleModify,
    clearModifyHistory,
    modifyHistory,
    modifyToolCalls,
    modifyThinking,
    modifySteps,
    modifyDiffs,
    modifyPlan,
    modifyError,
    pendingModifyInstruction,
    pendingModifyImage,
}: BuildStudioState) {
    const chatRef = useRef<HTMLDivElement>(null);
    const [slashHint, setSlashHint] = useState<string | null>(null);
    const [memoryOpen, setMemoryOpen] = useState(false);

    const slashCommands = [
        {
            id: "clear",
            label: "/clear",
            description: "清空对话历史（仅 session 层）",
            action: () => { clearModifyHistory(); setModifyInstruction(""); },
        },
        {
            id: "memory",
            label: "/memory",
            description: "打开/关闭 Memory Debug 面板",
            action: () => { setMemoryOpen((v) => !v); setModifyInstruction(""); },
        },
        {
            id: "help",
            label: "/help",
            description: "显示可用命令",
            action: () => {
                setSlashHint(slashCommands.map((c) => `/${c.id} — ${c.description}`).join("\n"));
                setModifyInstruction("");
                setTimeout(() => setSlashHint(null), 5000);
            },
        },
    ];

    const slashMenu = useSlashMenu({
        commands: slashCommands,
        value: modifyInstruction,
        setValue: setModifyInstruction,
    });
    const hasGeneratedProject = Boolean(
        response?.verificationStatus ||
        (response?.generatedFiles?.length ?? 0) > 0 ||
        (response?.blueprint && (response?.buildSteps?.length ?? 0) > 0)
    );
    const pipelineSteps = response?.buildSteps?.filter((step) => step.step !== "intent_agent") ?? [];
    const hasBuildActivity = Boolean(
        pipelineSteps.length > 0 ||
        response?.generatedFiles?.length ||
        response?.blueprint ||
        response?.verificationStatus ||
        response?.logDirectory ||
        response?.buildTotalDuration ||
        response?.error
    );
    const latestAssistantMessageId = [...conversationMessages].reverse().find((message) => message.role === "assistant")?.id;
    const showThinkingBubble =
        loading &&
        !hasBuildActivity &&
        conversationMessages[conversationMessages.length - 1]?.role !== "assistant";

    // Auto-scroll only when the user is already near the bottom.
    // If they scrolled up to read earlier content, don't yank them back.
    const isNearBottomRef = useRef(true);
    useEffect(() => {
        const el = chatRef.current;
        if (!el) return;
        const handleScroll = () => {
            const threshold = 80; // px from bottom
            isNearBottomRef.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
        };
        el.addEventListener("scroll", handleScroll, { passive: true });
        return () => el.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        if (isNearBottomRef.current && chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    }, [response, conversationMessages, loading, modifying, modifyToolCalls, modifyThinking, modifySteps, modifyDiffs, modifyError, modifyHistory]);

    return (
        <aside className="flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden lg:w-[540px] lg:max-h-full scrollbar-hidden">
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

            <div ref={chatRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 scrollbar-hidden">
                <div className="space-y-5">
                    {!response && !loading && conversationMessages.length === 0 ? (
                        <ChatBubble role="assistant">
                            <div className="text-sm font-medium text-foreground">你想构建什么？</div>
                            <p className="mt-2 text-sm leading-7 text-muted-foreground">
                                描述你想要的页面、应用或视觉系统，我会将它转化为一个完整的构建流程，并在这里实时推送每一步的执行详情。
                            </p>
                        </ChatBubble>
                    ) : null}

                    {generationSeemsStuck && projectId ? (
                        <ChatBubble role="assistant">
                            <div className="text-[11px] font-medium text-foreground">构建助手</div>
                            <div className="mt-2 space-y-3 text-[13px] leading-6 text-foreground">
                                <p className="flex items-start gap-2 text-amber-200/90">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>
                                        长时间没有看到新的构建进度（可能 SSE 断开或后台已停止）。
                                        如果确认没有其它标签页在生成此项目，可标记为中断，然后选择继续或重新开始。
                                    </span>
                                </p>
                                <button
                                    type="button"
                                    disabled={recoveryUnlocking}
                                    onClick={() => void handleUnlockInterruptedGeneration()}
                                    className="defi-button-outline flex items-center gap-2 px-4 py-2 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <RefreshCw
                                        className={`h-3.5 w-3.5 ${recoveryUnlocking ? "animate-spin" : ""}`}
                                    />
                                    {recoveryUnlocking ? "处理中…" : "标记为中断"}
                                </button>
                            </div>
                        </ChatBubble>
                    ) : null}

                    {conversationMessages.map((message) => (
                        <ChatBubble key={message.id} role={message.role}>
                            {message.role === "assistant" ? (
                                <div className="text-[11px] font-medium text-foreground">意图助手</div>
                            ) : null}
                            <div className={message.role === "assistant" ? "mt-2 space-y-3" : "space-y-3"}>
                                <div className="text-[13px] leading-7 text-foreground">
                                    {message.role === "user" ? (
                                        <pre className="whitespace-pre-wrap font-body">{message.content}</pre>
                                    ) : (
                                        <StudioMessageMarkdown content={message.content} />
                                    )}
                                </div>

                                {/* Brief draft — always visible so the confirmed structure stays in the conversation */}
                                {message.role === "assistant" && message.intentPayload?.briefDraftMarkdown ? (
                                    <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-muted-foreground">
                                        <StudioMessageMarkdown content={message.intentPayload.briefDraftMarkdown} />
                                    </div>
                                ) : null}

                                {/* Interactive options — only on the latest assistant message (clicking old buttons is meaningless) */}
                                {message.role === "assistant" && message.intentPayload && message.id === latestAssistantMessageId ? (
                                    <>
                                        {((message.intentPayload.options ?? []).length > 0 || (message.intentPayload.suggestedReplies ?? []).length > 0) ? (
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {(message.intentPayload.options ?? []).map((option) => (
                                                    <button
                                                        key={option.id}
                                                        type="button"
                                                        onClick={() => void handleRun(`${option.label}${option.hint ? `：${option.hint}` : ""}`)}
                                                        disabled={loading}
                                                        className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-left text-[12px] text-foreground transition-colors hover:border-primary/45 disabled:opacity-50"
                                                        title={option.hint}
                                                    >
                                                        <span className="block font-medium">{option.label}</span>
                                                        {option.hint ? <span className="mt-0.5 block text-[11px] text-muted-foreground">{option.hint}</span> : null}
                                                    </button>
                                                ))}
                                                {(message.intentPayload.suggestedReplies ?? []).map((reply) => (
                                                    <button
                                                        key={reply}
                                                        type="button"
                                                        onClick={() => void handleRun(reply)}
                                                        disabled={loading}
                                                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-white/20 hover:text-foreground disabled:opacity-50"
                                                    >
                                                        {reply}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : null}
                                    </>
                                ) : null}
                            </div>
                        </ChatBubble>
                    ))}

                    {showThinkingBubble ? (
                        <ChatBubble role="assistant">
                            <div className="text-[11px] font-medium text-foreground">意图助手</div>
                            <div className="mt-2 space-y-3">
                                <div className="text-[13px] leading-7 text-foreground">
                                    <p className="text-muted-foreground">正在理解你的需求...</p>
                                </div>
                            </div>
                        </ChatBubble>
                    ) : null}

                    {hasBuildActivity ? (
                        <ChatBubble role="assistant">
                            <div className="text-[11px] font-medium text-foreground">构建助手</div>
                            <div className="mt-3 space-y-3">
                                <LogSection title="Command">
                                    <TermLine prefix="$" color="text-white">
                                        run build_site{" "}
                                        <span className="text-muted-foreground">
                                            &quot;
                                            {(mergedBrief ?? lastRunInput ?? input).length > 72
                                                ? `${(mergedBrief ?? lastRunInput ?? input).slice(0, 72)}...`
                                                : mergedBrief ?? lastRunInput ?? input}
                                            &quot;
                                        </span>
                                    </TermLine>
                                </LogSection>

                                <LogSection title="执行日志">
                                    <div className="space-y-0.5">
                                        {pipelineSteps.map((step, index) => (
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
                                        <StudioMessageMarkdown content={response.content} />
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
                                        <GeneratedFilesList files={response.generatedFiles} />
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
                                        <TermLine color="text-red-400">
                                            error:{" "}
                                            {isRecoverableGenerationError(response.error)
                                                ? stripRecoverablePrefixForDisplay(response.error)
                                                : response.error}
                                        </TermLine>
                                        {projectId && !loading ? (
                                            isRecoverableGenerationError(response.error) ? (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        disabled={recoveryUnlocking}
                                                        onClick={() => void handleContinueFromCheckpoint()}
                                                        className="defi-button flex items-center gap-2 px-4 py-2 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <Play className="h-3.5 w-3.5" />
                                                        继续生成
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={recoveryUnlocking}
                                                        onClick={() => void handleRetry()}
                                                        className="defi-button-outline flex items-center gap-2 px-4 py-2 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
                                                    >
                                                        <RefreshCw className="h-3.5 w-3.5" />
                                                        重新生成
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={recoveryUnlocking}
                                                    onClick={() => void handleRetry()}
                                                    className="mt-3 defi-button-outline flex items-center gap-2 px-4 py-2 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <RefreshCw className="h-3.5 w-3.5" />
                                                    重新生成
                                                </button>
                                            )
                                        ) : null}
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

                    {/* In-progress modify — show user's input bubble first */}
                    {modifying && pendingModifyInstruction && (
                        <ChatBubble role="user">
                            <div className="space-y-3">
                                {pendingModifyImage && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={pendingModifyImage}
                                        alt="attached"
                                        className="max-h-64 rounded-lg border border-white/10 object-cover"
                                    />
                                )}
                                <pre className="whitespace-pre-wrap font-body text-[14px] leading-7 text-foreground">
                                    {pendingModifyInstruction}
                                </pre>
                            </div>
                        </ChatBubble>
                    )}

                    {/* In-progress modify — assistant response */}
                    {modifying && (
                        <ChatBubble role="assistant">
                            <div className="text-[11px] font-medium text-foreground">修改助手</div>
                            <div className="mt-3 space-y-3">
                                {/* Steps */}
                                {modifySteps.length > 0 && (
                                    <LogSection title="Steps">
                                        <div className="space-y-1">
                                            {modifySteps.map((step) => (
                                                <div key={step.name} className="flex items-center gap-2 font-mono text-[10px]">
                                                    <span className={
                                                        step.status === "done" ? "text-emerald-400" :
                                                            step.status === "error" ? "text-red-400" :
                                                                "text-primary animate-pulse"
                                                    }>
                                                        {step.status === "done" ? "✓" : step.status === "error" ? "✗" : "●"}
                                                    </span>
                                                    <span className="text-foreground/85">{step.name}</span>
                                                    {step.message && <span className="text-muted-foreground/60 truncate max-w-[200px]">{step.message}</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </LogSection>
                                )}

                                {/* Thinking — collapsed by default */}
                                <CollapsedThinkingBlock
                                    thinking={filterThinkingDedupe(
                                        modifyThinking,
                                        (modifyPlan?.analysis ?? "").trim()
                                    )}
                                />

                                {/* Tool calls */}
                                {modifyToolCalls.length > 0 && (
                                    <LogSection title="Tool Calls">
                                        <div className="space-y-1.5">
                                            {modifyToolCalls.map((tc, i) => (
                                                <div key={i} className="flex items-start gap-2 font-mono text-[10px]">
                                                    <span className={
                                                        tc.tool === "edit_file" || tc.tool === "write_file" ? "text-amber-300" :
                                                            tc.tool === "run_build" ? "text-green-400" :
                                                                "text-primary/60"
                                                    }>
                                                        {tc.tool}
                                                    </span>
                                                    <span className="text-muted-foreground/70 truncate max-w-[300px]">
                                                        {tc.tool === "read_file" || tc.tool === "edit_file" || tc.tool === "write_file"
                                                            ? (tc.args.path as string ?? "")
                                                            : tc.tool === "search_code"
                                                                ? (tc.args.pattern as string ?? "")
                                                                : tc.result.slice(0, 60)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </LogSection>
                                )}

                                {/* Diffs (streamed during execution) */}
                                {modifyDiffs.length > 0 && (
                                    <LogSection title="Changes">
                                        <div className="space-y-1.5">
                                            {modifyDiffs.map((diff) => (
                                                <div key={diff.file} className="flex items-center gap-2 font-mono text-[10px]">
                                                    <span className="text-amber-300">MOD</span>
                                                    <span className="text-foreground/80">{diff.file}</span>
                                                    <span className="text-green-400/70">+{diff.stats.additions}</span>
                                                    <span className="text-red-400/70">-{diff.stats.deletions}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </LogSection>
                                )}

                                {/* Error */}
                                {modifyError && (
                                    <LogSection title="Error">
                                        <TermLine color="text-red-400">error: {modifyError}</TermLine>
                                    </LogSection>
                                )}

                                <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
                                    <TermLine color="text-primary">
                                        <span className="animate-pulse">[agent]</span>
                                        <span className="ml-2 text-muted-foreground">
                                            {modifyToolCalls.length} tool calls · {modifyThinking.length} thoughts
                                        </span>
                                    </TermLine>
                                </div>
                            </div>
                        </ChatBubble>
                    )}
                </div>
            </div>

            {/* Memory debug panel */}
            {projectId && <MemoryDebugPanel projectId={projectId} sessionHistory={modifyHistory} externalOpen={memoryOpen} onToggle={setMemoryOpen} />}

            {/* Input area */}
            <div className="border-t border-white/8 px-4 py-4">
                {projectId && !loading && hasGeneratedProject && response && !response.error ? (
                    /* Modify mode — project ready */
                    <div className="rounded-[24px] border border-white/10 bg-black/25 p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Wand2 className="h-3 w-3 text-primary/60" />
                                <span className="font-mono text-[9px] uppercase tracking-widest text-primary/60">Modify project</span>
                            </div>
                        </div>
                        <label className="sr-only" htmlFor="modify-input">修改指令</label>
                        {/* Image preview */}
                        {modifyImage && (
                            <div className="mb-2 flex items-center gap-2">
                                <div className="relative">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={modifyImage} alt="attached" className="h-16 w-24 rounded-lg object-cover border border-white/10" />
                                    <button
                                        type="button"
                                        onClick={() => setModifyImage(null)}
                                        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-background border border-white/20 text-muted-foreground hover:text-foreground text-[10px]"
                                    >
                                        ×
                                    </button>
                                </div>
                                <span className="font-mono text-[10px] text-muted-foreground/60">Image attached</span>
                            </div>
                        )}
                        <textarea
                            id="modify-input"
                            rows={1}
                            disabled={modifying}
                            className="w-full resize-none border-0 bg-transparent px-1 py-1 font-body text-[14px] leading-7 text-foreground outline-none placeholder:text-white/50 max-h-[200px] overflow-y-auto scrollbar-hidden disabled:opacity-40 disabled:cursor-not-allowed"
                            value={modifyInstruction}
                            onChange={(e) => {
                                setModifyInstruction(e.target.value);
                                slashMenu.updateCursorPos(e.target.selectionStart ?? 0);
                                setSlashHint(null);
                                e.target.style.height = "auto";
                                e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
                            }}
                            onPaste={(e) => {
                                const items = Array.from(e.clipboardData.items);
                                const imageItem = items.find((item) => item.type.startsWith("image/"));
                                if (imageItem) {
                                    e.preventDefault();
                                    const file = imageItem.getAsFile();
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = () => { if (typeof reader.result === "string") setModifyImage(reader.result); };
                                    reader.readAsDataURL(file);
                                }
                            }}
                            onSelect={(e) => {
                                slashMenu.updateCursorPos((e.target as HTMLTextAreaElement).selectionStart ?? 0);
                            }}
                            onKeyDown={(e) => {
                                if (slashMenu.handleKeyDown(e)) return;
                                if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !modifying) {
                                    e.preventDefault();
                                    // Check if it's an exact slash command
                                    const exact = slashCommands.find((c) => modifyInstruction.trim() === `/${c.id}`);
                                    if (exact?.action) { exact.action(); return; }
                                    void handleModify();
                                }
                            }}
                            placeholder={modifying ? "修改进行中..." : "描述要修改的内容... (粘贴图片 / 输入 / 查看命令)"}
                        />
                        {/* Slash command autocomplete — floating overlay */}
                        <div className="relative">
                            {slashMenu.isOpen && slashMenu.matches.length > 0 && !modifying && (
                                <div className="absolute bottom-0 left-0 right-0 z-50">
                                    <SlashMenu
                                matches={slashMenu.matches}
                                activeIndex={slashMenu.activeIndex}
                                onSelect={slashMenu.selectCommand}
                                onHover={slashMenu.setActiveIndex}
                                    />
                                </div>
                            )}
                        </div>
                        {/* Slash hint (from /help) */}
                        {slashHint && (
                            <pre className="px-2 py-1.5 text-[10px] leading-5 text-muted-foreground/70 font-mono whitespace-pre-wrap">{slashHint}</pre>
                        )}
                        <div className="mt-3 flex items-center justify-between gap-3">
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
                    /* Intent / generate mode */
                    <div className="rounded-[20px] border border-white/10 bg-black/25 p-4">
                        <textarea
                            rows={2}
                            disabled={loading}
                            className="w-full resize-none border-0 bg-transparent px-1 py-1 font-body text-[14px] leading-7 text-foreground outline-none placeholder:text-white/50 max-h-[180px] overflow-y-auto scrollbar-hidden disabled:opacity-50"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !loading && input.trim()) {
                                    e.preventDefault();
                                    void handleRun();
                                }
                            }}
                            placeholder={loading ? "Agent 正在处理..." : "继续补充你的需求，或回复上面的选项..."}
                        />
                        <div className="mt-3 flex items-center justify-between">
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                    <span className="font-mono text-[11px] text-primary">Agent working · {formatMs(elapsed)}</span>
                                </div>
                            ) : (
                                <Link href="/" className="font-mono text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors">
                                    ← New build
                                </Link>
                            )}
                            <button
                                type="button"
                                onClick={() => void handleRun()}
                                disabled={loading || !input.trim()}
                                className="defi-button flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Send className="h-4 w-4" />
                                Send
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
