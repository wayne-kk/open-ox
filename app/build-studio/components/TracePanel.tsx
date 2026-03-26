"use client";

import { useState } from "react";
import type { StepTrace } from "../types/build-studio";

function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${active
                ? "border-b border-primary text-primary"
                : "text-muted-foreground/50 hover:text-muted-foreground"
                }`}
        >
            {children}
        </button>
    );
}

function JsonBlock({ value }: { value: unknown }) {
    return (
        <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-black/30 p-3 font-mono text-[11px] leading-5 text-[#c7d0dc]">
            {JSON.stringify(value, null, 2)}
        </pre>
    );
}

function ValidationChecks({
    result,
}: {
    result: NonNullable<StepTrace["validationResult"]>;
}) {
    return (
        <div className="space-y-1.5">
            {result.checks.map((check) => (
                <div
                    key={check.name}
                    className={`flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] ${check.passed ? "bg-emerald-400/8 text-emerald-300/80" : "bg-red-400/8 text-red-300/80"
                        }`}
                >
                    <span className="shrink-0 font-mono">{check.passed ? "✓" : "✗"}</span>
                    <div>
                        <span className="font-mono tracking-wide">{check.name}</span>
                        {check.detail && (
                            <div className="mt-0.5 text-[10px] opacity-70">{check.detail}</div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function LlmCallTab({ llmCall }: { llmCall: NonNullable<StepTrace["llmCall"]> }) {
    const [activeSection, setActiveSection] = useState<"system" | "user" | "response">("user");

    return (
        <div className="space-y-2">
            {/* Token stats */}
            {(llmCall.inputTokens != null || llmCall.outputTokens != null) && (
                <div className="flex gap-3 font-mono text-[10px] text-muted-foreground">
                    {llmCall.model && <span className="text-accent-tertiary/80">{llmCall.model}</span>}
                    {llmCall.inputTokens != null && <span>in: {llmCall.inputTokens.toLocaleString()} tok</span>}
                    {llmCall.outputTokens != null && <span>out: {llmCall.outputTokens.toLocaleString()} tok</span>}
                </div>
            )}

            {/* Section tabs */}
            <div className="flex gap-1 border-b border-white/6">
                {llmCall.userMessage && (
                    <TabButton active={activeSection === "user"} onClick={() => setActiveSection("user")}>
                        User
                    </TabButton>
                )}
                {llmCall.systemPrompt && (
                    <TabButton active={activeSection === "system"} onClick={() => setActiveSection("system")}>
                        System
                    </TabButton>
                )}
                {llmCall.rawResponse && (
                    <TabButton active={activeSection === "response"} onClick={() => setActiveSection("response")}>
                        Response
                    </TabButton>
                )}
            </div>

            <div className="max-h-[360px] overflow-y-auto [scrollbar-width:none]">
                {activeSection === "system" && llmCall.systemPrompt && (
                    <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-muted-foreground">
                        {llmCall.systemPrompt}
                    </pre>
                )}
                {activeSection === "user" && llmCall.userMessage && (
                    <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-muted-foreground">
                        {llmCall.userMessage}
                    </pre>
                )}
                {activeSection === "response" && llmCall.rawResponse && (
                    <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-[#c7d0dc]">
                        {llmCall.rawResponse}
                    </pre>
                )}
            </div>
        </div>
    );
}

type TraceTab = "input" | "output" | "llm" | "validation";

export function TracePanel({ trace }: { trace: StepTrace }) {
    const tabs: Array<{ id: TraceTab; label: string; available: boolean }> = [
        { id: "input", label: "Input", available: trace.input != null },
        { id: "output", label: "Output", available: trace.output != null },
        { id: "llm", label: "LLM Call", available: trace.llmCall != null },
        { id: "validation", label: "Validation", available: trace.validationResult != null },
    ].filter((t) => t.available);

    const [activeTab, setActiveTab] = useState<TraceTab>(tabs[0]?.id ?? "input");

    if (tabs.length === 0) return null;

    return (
        <div className="mt-2 rounded-xl border border-white/8 bg-black/25">
            {/* Tab bar */}
            <div className="flex gap-1 border-b border-white/6 px-2">
                {tabs.map((tab) => (
                    <TabButton
                        key={tab.id}
                        active={activeTab === tab.id}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                        {tab.id === "validation" && trace.validationResult && (
                            <span className={`ml-1 ${trace.validationResult.passed ? "text-emerald-400" : "text-red-400"}`}>
                                {trace.validationResult.passed ? "✓" : "✗"}
                            </span>
                        )}
                    </TabButton>
                ))}
            </div>

            <div className="p-3">
                {activeTab === "input" && trace.input && <JsonBlock value={trace.input} />}
                {activeTab === "output" && trace.output && <JsonBlock value={trace.output} />}
                {activeTab === "llm" && trace.llmCall && <LlmCallTab llmCall={trace.llmCall} />}
                {activeTab === "validation" && trace.validationResult && (
                    <ValidationChecks result={trace.validationResult} />
                )}
            </div>
        </div>
    );
}
