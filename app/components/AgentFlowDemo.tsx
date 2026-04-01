"use client";

import { useEffect, useState } from "react";

interface Step {
    id: string;
    label: string;
    detail: string;
    color: string;
}

interface Props {
    steps: Step[];
}

const STEP_DURATION = 900; // ms per step
const PAUSE_AFTER_DONE = 2500; // ms before restart

export function AgentFlowDemo({ steps }: Props) {
    const [activeIndex, setActiveIndex] = useState(-1);
    const [doneSet, setDoneSet] = useState<Set<number>>(new Set());

    useEffect(() => {
        let cancelled = false;

        async function run() {
            // Reset
            setActiveIndex(-1);
            setDoneSet(new Set());
            await sleep(400);

            for (let i = 0; i < steps.length; i++) {
                if (cancelled) return;
                setActiveIndex(i);
                await sleep(STEP_DURATION);
                if (cancelled) return;
                setDoneSet((prev) => new Set([...prev, i]));
            }

            await sleep(PAUSE_AFTER_DONE);
            if (!cancelled) run();
        }

        run();
        return () => { cancelled = true; };
    }, [steps]);

    return (
        <div className="relative">
            {/* Connector line */}
            <div className="absolute left-[19px] top-6 bottom-6 w-px bg-linear-to-b from-primary/40 via-accent-tertiary/30 to-primary/10 sm:left-[23px]" />

            <div className="space-y-2">
                {steps.map((step, i) => {
                    const isDone = doneSet.has(i);
                    const isActive = activeIndex === i && !isDone;
                    const isPending = activeIndex < i;

                    return (
                        <div
                            key={step.id}
                            className={`relative flex items-start gap-4 rounded-xl px-4 py-3 transition-all duration-500 ${isActive
                                ? "bg-primary/8 border border-primary/25"
                                : isDone
                                    ? "bg-white/3 border border-white/6"
                                    : "border border-transparent"
                                }`}
                        >
                            {/* Step indicator */}
                            <div className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center sm:h-7 sm:w-7">
                                {isDone ? (
                                    <div className="flex h-full w-full items-center justify-center rounded-full bg-green-500/20 border border-green-500/40">
                                        <svg className="h-3 w-3 text-green-400" fill="none" viewBox="0 0 12 12">
                                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                ) : isActive ? (
                                    <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/20 border border-primary/50 animate-pulse-glow">
                                        <div className="h-2 w-2 rounded-full bg-primary" />
                                    </div>
                                ) : (
                                    <div className={`flex h-full w-full items-center justify-center rounded-full border ${isPending ? "border-white/10 bg-white/3" : "border-white/20 bg-white/5"
                                        }`}>
                                        <div className={`h-1.5 w-1.5 rounded-full ${isPending ? "bg-white/20" : "bg-white/40"}`} />
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className={`font-mono text-[12px] font-medium transition-colors duration-300 ${isDone ? "text-white/70" : isActive ? step.color : "text-white/30"
                                        }`}>
                                        {step.label}
                                    </span>
                                    {isActive && (
                                        <span className="flex gap-0.5">
                                            {[0, 1, 2].map((dot) => (
                                                <span
                                                    key={dot}
                                                    className="h-1 w-1 rounded-full bg-primary animate-bounce"
                                                    style={{ animationDelay: `${dot * 150}ms` }}
                                                />
                                            ))}
                                        </span>
                                    )}
                                    {isDone && (
                                        <span className="font-mono text-[10px] text-green-400/60 tracking-wider">done</span>
                                    )}
                                </div>
                                <p className={`mt-0.5 font-mono text-[10px] tracking-wide transition-colors duration-300 ${isActive ? "text-muted-foreground" : "text-muted-foreground/40"
                                    }`}>
                                    {step.detail}
                                </p>
                            </div>

                            {/* Active progress bar */}
                            {isActive && (
                                <div className="absolute bottom-0 left-0 right-0 h-px overflow-hidden rounded-b-xl">
                                    <div
                                        className="h-full bg-linear-to-r from-primary/60 to-accent-tertiary/60"
                                        style={{
                                            animation: `progress-fill ${STEP_DURATION}ms linear forwards`,
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <style>{`
        @keyframes progress-fill {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
        </div>
    );
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
