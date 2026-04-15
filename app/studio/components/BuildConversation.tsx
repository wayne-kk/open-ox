"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AlertTriangle, CircleCheckBig, Play, Send, Wand2, RefreshCw } from "lucide-react";
import { ChatBubble } from "./ui/ChatBubble";
import { LogSection } from "./ui/LogSection";
import { TermLine } from "./ui/TermLine";
import { StepRow } from "./StepRow";
import { BlueprintOverview } from "./BlueprintOverview";
import { MemoryDebugPanel } from "./MemoryDebugPanel";
import { SlashMenu } from "@/app/components/ui/SlashMenu";
import { useSlashMenu } from "@/app/hooks/useSlashMenu";
import type { BuildStudioState, ModifyRecord, ModifyDiff } from "../hooks/useBuildStudio";
import { inferMonacoLanguage } from "../lib/inferMonacoLanguage";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

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

function GeneratedFilesPreview({
    projectId,
    files,
}: {
    projectId: string | null;
    files: string[];
}) {
    const [selectedFile, setSelectedFile] = useState<string | null>(files[0] ?? null);
    const [content, setContent] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const editorRef = useRef<{ getAction: (id: string) => { run: () => Promise<void> } | null } | null>(null);

    useEffect(() => {
        if (!files.length) {
            setSelectedFile(null);
            return;
        }
        if (!selectedFile || !files.includes(selectedFile)) {
            setSelectedFile(files[0]);
        }
    }, [files, selectedFile]);

    useEffect(() => {
        if (!projectId || !selectedFile) {
            setContent("");
            setError(null);
            return;
        }

        const controller = new AbortController();
        const loadFile = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(
                    `/api/projects/${projectId}/files?path=${encodeURIComponent(selectedFile)}`,
                    { signal: controller.signal }
                );
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(data.error ?? `HTTP ${res.status}`);
                }
                setContent(typeof data.content === "string" ? data.content : "");
            } catch (err) {
                if ((err as Error).name === "AbortError") return;
                setContent("");
                setError(err instanceof Error ? err.message : "Failed to load file");
            } finally {
                setLoading(false);
            }
        };
        void loadFile();

        return () => controller.abort();
    }, [projectId, selectedFile]);

    const handleCopy = async () => {
        if (!content) return;
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Ignore clipboard failures (permission denied, insecure context).
        }
    };

    return (
        <div className="rounded-xl border border-white/8 bg-black/20">
            <div className="grid max-h-[360px] min-h-[260px] grid-cols-[minmax(180px,34%)_1fr]">
                <div className="border-r border-white/8 overflow-y-auto scrollbar-unified">
                    {files.map((file) => (
                        <button
                            key={file}
                            type="button"
                            onClick={() => setSelectedFile(file)}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[11px] transition-colors ${selectedFile === file
                                ? "bg-primary/12 text-primary"
                                : "text-muted-foreground/80 hover:bg-white/5 hover:text-foreground"
                                }`}
                        >
                            <span className="text-[10px] opacity-60">›</span>
                            <span className="truncate">{file}</span>
                        </button>
                    ))}
                </div>

                <div className="min-w-0">
                    <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
                        <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                            {selectedFile ?? "No file selected"}
                        </span>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => void editorRef.current?.getAction("actions.find")?.run()}
                                disabled={!content}
                                className="rounded border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70 transition-colors hover:border-white/20 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Search
                            </button>
                            <button
                                type="button"
                                onClick={handleCopy}
                                disabled={!content}
                                className="rounded border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70 transition-colors hover:border-white/20 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {copied ? "Copied" : "Copy"}
                            </button>
                        </div>
                    </div>
                    <div className="h-[320px] overflow-hidden bg-[#080a0d]">
                        {loading ? (
                            <div className="p-3 font-mono text-[11px] text-muted-foreground/70">Loading file...</div>
                        ) : error ? (
                            <div className="p-3 font-mono text-[11px] text-red-300/80">{error}</div>
                        ) : (
                            <MonacoEditor
                                height="100%"
                                language={inferMonacoLanguage(selectedFile)}
                                value={content || "// Empty file"}
                                theme="vs-dark"
                                onMount={(editor) => {
                                    editorRef.current = editor as unknown as { getAction: (id: string) => { run: () => Promise<void> } | null };
                                }}
                                options={{
                                    readOnly: true,
                                    minimap: { enabled: false },
                                    fontSize: 12,
                                    lineNumbers: "on",
                                    glyphMargin: false,
                                    folding: true,
                                    scrollBeyondLastLine: false,
                                    renderLineHighlight: "line",
                                    wordWrap: "off",
                                    automaticLayout: true,
                                    find: {
                                        addExtraSpaceOnTop: false,
                                    },
                                }}
                            />
                        )}
                    </div>
                </div>
            </div>
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

function ModifyBubble({ record }: { record: ModifyRecord }) {
    return (
        <ChatBubble role="user">
            <div className="text-[11px] font-medium text-foreground">You</div>
            {record.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={record.image}
                    alt="attached"
                    className="mt-2 max-h-64 rounded-lg border border-white/10 object-cover"
                />
            )}
            <pre className="mt-2 whitespace-pre-wrap font-body text-[14px] leading-7 text-foreground">
                {record.instruction}
            </pre>
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
    return (
        <ChatBubble role="assistant">
            <div className="text-[11px] font-medium text-foreground">修改助手</div>
            <div className="mt-3 space-y-3">
                {/* AI Analysis */}
                {record.plan && (
                    <LogSection title="Analysis">
                        <div className="space-y-1 text-[12px] leading-6 text-foreground/90">
                            <p>{record.plan.analysis}</p>
                        </div>
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

                {/* Agent execution trace — tool calls + flow logic */}
                {(record.toolCalls?.length > 0 || record.thinking?.length > 0) && (
                    <LogSection title="Agent Log">
                        <div className="space-y-1">
                            {/* Thinking entries (iter info, stop hooks, errors) */}
                            {record.thinking.map((t, i) => (
                                <div key={`t-${i}`} className="font-mono text-[10px] leading-4 text-foreground/60 whitespace-pre-wrap">
                                    {t.length > 400 ? t.slice(0, 400) + "…" : t}
                                </div>
                            ))}
                            {/* Tool calls */}
                            {record.toolCalls.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {record.toolCalls.map((tc, i) => (
                                        <div key={`tc-${i}`} className="flex items-start gap-2 font-mono text-[10px]">
                                            <span className={
                                                tc.tool === "edit_file" || tc.tool === "write_file" ? "text-amber-300" :
                                                    tc.tool === "run_build" ? "text-green-400" :
                                                        "text-primary/60"
                                            }>
                                                {tc.tool}
                                            </span>
                                            <span className="text-muted-foreground/70 truncate max-w-[280px]">
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
                            )}
                        </div>
                    </LogSection>
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
    lastRunInput,
    elapsed,
    flowStart,
    handleRun,
    handleClear,
    handleRetry,
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
    }, [response, loading, modifying, modifyToolCalls, modifyThinking, modifySteps, modifyDiffs, modifyError, modifyHistory]);

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

            <div ref={chatRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 scrollbar-hidden">
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
                                        <GeneratedFilesPreview projectId={projectId} files={response.generatedFiles} />
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

                    {/* In-progress modify — show user's input bubble first */}
                    {modifying && pendingModifyInstruction && (
                        <ChatBubble role="user">
                            <div className="text-[11px] font-medium text-foreground">You</div>
                            {pendingModifyImage && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={pendingModifyImage}
                                    alt="attached"
                                    className="mt-2 max-h-64 rounded-lg border border-white/10 object-cover"
                                />
                            )}
                            <pre className="mt-2 whitespace-pre-wrap font-body text-[14px] leading-7 text-foreground">
                                {pendingModifyInstruction}
                            </pre>
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

                                {/* Thinking */}
                                {modifyThinking.length > 0 && (
                                    <LogSection title="Agent Thinking">
                                        <div className="space-y-2 text-[11px] leading-5 text-foreground/80">
                                            {modifyThinking.map((t, i) => (
                                                <p key={i} className="whitespace-pre-wrap">{t.length > 500 ? t.slice(0, 500) + "…" : t}</p>
                                            ))}
                                        </div>
                                    </LogSection>
                                )}

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
                {projectId && !loading && response && !response.error ? (
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
                    /* Generate mode — auto-started from homepage, show prompt + status only */
                    <div className="rounded-[20px] border border-white/10 bg-black/25 p-4">
                        {input && (
                            <p className="font-body text-[13px] leading-relaxed text-muted-foreground line-clamp-3 mb-3">
                                {input}
                            </p>
                        )}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {loading ? (
                                    <>
                                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                        <span className="font-mono text-[11px] text-primary">Building · {formatMs(elapsed)}</span>
                                    </>
                                ) : (
                                    <span className="font-mono text-[11px] text-muted-foreground/60">Build complete</span>
                                )}
                            </div>
                            <Link href="/" className="font-mono text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors">
                                ← New build
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}
