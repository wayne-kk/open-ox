"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { GraphNode } from "@/lib/atlas/types";
import type { BuildStep } from "../types/build-studio";
import { parseStepsToTopology } from "@/lib/atlas/parseSteps";
import { PannableCanvas } from "./PannableCanvas";
import { StageColumn } from "./StageColumn";
import { EventStream } from "./EventStream";
import { DetailDrawer } from "./DetailDrawer";

function formatMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function EmptyState({ loading }: { loading: boolean }) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            {loading ? (
                <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
                        Initializing build pipeline…
                    </p>
                </>
            ) : (
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted-foreground/60">
                    No steps yet
                </p>
            )}
        </div>
    );
}

function SummaryBar({
    nodes,
    totalDuration,
    verificationStatus,
}: {
    nodes: GraphNode[];
    totalDuration?: number;
    verificationStatus?: "passed" | "failed";
}) {
    const ok = nodes.filter((n) => n.status === "ok").length;
    const err = nodes.filter((n) => n.status === "error").length;
    const total = nodes.length;

    return (
        <div className="flex items-center gap-4 border-b border-white/6 px-4 py-2 font-mono text-[10px] text-muted-foreground">
            <span className="text-foreground/80">{total} steps</span>
            {ok > 0 && <span className="text-emerald-400/80">✓ {ok}</span>}
            {err > 0 && <span className="text-red-400/80">✗ {err}</span>}
            {totalDuration != null && (
                <span className="ml-auto text-muted-foreground/70">{formatMs(totalDuration)}</span>
            )}
            {verificationStatus && (
                <span
                    className={
                        verificationStatus === "passed"
                            ? "text-emerald-400/80"
                            : "text-amber-400/80"
                    }
                >
                    build {verificationStatus}
                </span>
            )}
        </div>
    );
}

export function GenerationAtlas({
    steps,
    flowStart,
    loading,
    verificationStatus,
    totalDuration,
    showEventStream = false,
}: {
    steps: BuildStep[];
    flowStart: number;
    loading: boolean;
    verificationStatus?: "passed" | "failed";
    totalDuration?: number;
    showEventStream?: boolean;
}) {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Deselect when steps change significantly (new build)
    const prevStepCountRef = useRef(0);
    useEffect(() => {
        if (steps.length === 0) {
            setSelectedNodeId(null);
            prevStepCountRef.current = 0;
        }
        prevStepCountRef.current = steps.length;
    }, [steps.length]);

    // Memoize topology — reparse when steps change (new step or status update)
    const stepsFingerprint = steps.map((s) => `${s.step}:${s.status}`).join("|");
    const topology = useMemo(
        () => (steps.length > 0 ? parseStepsToTopology(steps, flowStart) : null),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [stepsFingerprint, flowStart]
    );

    if (!topology) {
        return <EmptyState loading={loading} />;
    }

    const activeIndex = loading ? topology.nodes.findLastIndex((n) => n.status === "active") : -1;

    const handleSelectNode = (id: string) => {
        setSelectedNodeId((prev) => (prev === id ? null : id));
    };

    const selectedNode = topology.nodes.find((n) => n.id === selectedNodeId) ?? null;

    return (
        <div className="relative flex h-full flex-col">
            <SummaryBar
                nodes={topology.nodes}
                totalDuration={totalDuration}
                verificationStatus={verificationStatus}
            />

            <div className="flex-1 min-h-0 overflow-hidden">
                {showEventStream ? (
                    <div className="h-full overflow-y-auto p-4 [scrollbar-width:none]">
                        <EventStream nodes={topology.nodes} flowStart={flowStart} />
                    </div>
                ) : (
                    <PannableCanvas>
                        <div className="flex gap-3 px-4 py-4 items-start">
                            {topology.stages.map((stage) => (
                                <StageColumn
                                    key={stage.id}
                                    stage={stage}
                                    activeIndex={activeIndex}
                                    selectedNodeId={selectedNodeId}
                                    onSelectNode={handleSelectNode}
                                />
                            ))}
                        </div>
                    </PannableCanvas>
                )}
            </div>

            <DetailDrawer
                node={selectedNode}
                onClose={() => setSelectedNodeId(null)}
            />
        </div>
    );
}
