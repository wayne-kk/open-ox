"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, CircleCheckBig, Play, Trash2 } from "lucide-react";
import { ChatBubble } from "./ui/ChatBubble";
import { LogSection } from "./ui/LogSection";
import { TermLine } from "./ui/TermLine";
import { StepRow } from "./StepRow";
import { BlueprintOverview } from "./BlueprintOverview";
import type { BuildStudioState } from "../hooks/useBuildStudio";

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
                </div>
            </div>

            {/* Input area */}
            <div className="border-t border-white/8 px-4 py-4">
                <div className="rounded-[24px] border border-white/10 bg-black/25 p-3">
                    <label className="sr-only" htmlFor="build-studio-input">输入站点需求</label>
                    <textarea
                        id="build-studio-input"
                        rows={2}
                        className="w-full resize-none border-0 bg-transparent px-1 py-1 font-body text-[14px] leading-7 text-foreground outline-none placeholder:text-white/30"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !loading) {
                                e.preventDefault();
                                void handleRun();
                            }
                        }}
                        placeholder="Describe the page, app, or design system you want to generate..."
                    />
                    <div className="mt-3 flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={handleClear}
                            disabled={loading || clearing}
                            className="defi-button-outline flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {clearing ? (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                            Clear
                        </button>
                        <div className="hidden text-xs text-muted-foreground sm:block">Cmd/Ctrl + Enter to run</div>
                        <button
                            type="button"
                            onClick={handleRun}
                            disabled={loading}
                            className="defi-button flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    Running {formatMs(elapsed)}
                                </>
                            ) : (
                                <>
                                    <Play className="h-4 w-4" />
                                    Run
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}
