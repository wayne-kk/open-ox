"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface Step {
    id: string;
    label: string;
    detail: string;
    color: string;
}
interface Props {
    steps: Step[];
}

const STEP_MS = 1200;
const PAUSE_MS = 3000;
const ICONS = ["⟐", "◆", "▲", "✦", "⬢", "●"];

/*
 * Topology layout (desktop):
 *
 *        [0] ——→ [1] ——→ [2]
 *                          ↓
 *        [5] ←—— [4] ←—— [3]
 *
 * Two rows, second row reversed. Gives a pipeline "U" shape.
 */
const TOPO_POSITIONS = [
    // row 0: left to right
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    // row 1: right to left
    { row: 1, col: 2 },
    { row: 1, col: 1 },
    { row: 1, col: 0 },
];

// Edge pairs (from → to) for the SVG connectors
const EDGES: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
];

function Node({
    step, index, state, progress,
}: {
    step: Step; index: number;
    state: "pending" | "active" | "done";
    progress: number;
}) {
    return (
        <div className={`
      relative flex flex-col items-center gap-3 transition-all duration-500
      ${state === "pending" ? "opacity-30" : "opacity-100"}
      ${state === "active" ? "scale-[1.08]" : ""}
    `}>
            {/* Glow behind node */}
            {state === "active" && (
                <div className="absolute -inset-6 rounded-3xl bg-primary/10 blur-2xl pointer-events-none" />
            )}
            {state === "done" && (
                <div className="absolute -inset-4 rounded-3xl bg-green-500/8 blur-xl pointer-events-none" />
            )}

            {/* Circle */}
            <div className={`
        relative flex h-[72px] w-[72px] sm:h-[88px] sm:w-[88px] items-center justify-center
        rounded-2xl font-mono text-xl sm:text-2xl transition-all duration-500
        ${state === "done"
                    ? "bg-green-500/20 border-2 border-green-400/60 text-green-300 shadow-[0_0_24px_rgba(34,197,94,0.35)]"
                    : state === "active"
                        ? "bg-primary/15 border-2 border-primary/70 text-primary shadow-[0_0_32px_rgba(247,147,26,0.4)]"
                        : "bg-white/[0.04] border border-white/10 text-white/25"
                }
      `}>
                {state === "done" ? (
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 16 16">
                        <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                ) : (
                    <span className={state === "active" ? "animate-pulse" : ""}>{ICONS[index]}</span>
                )}

                {/* Ripple */}
                {state === "active" && (
                    <>
                        <span className="absolute inset-0 rounded-2xl border-2 border-primary/40 animate-[ripple_1.8s_ease-out_infinite]" />
                        <span className="absolute inset-0 rounded-2xl border border-primary/20 animate-[ripple_1.8s_ease-out_0.6s_infinite]" />
                    </>
                )}

                {/* Number badge */}
                <span className={`
          absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full
          text-[9px] font-bold font-mono border transition-all duration-500
          ${state === "done"
                        ? "bg-green-500 border-green-400 text-black"
                        : state === "active"
                            ? "bg-primary border-primary text-black"
                            : "bg-white/10 border-white/15 text-white/30"
                    }
        `}>
                    {index + 1}
                </span>
            </div>

            {/* Progress bar */}
            {state === "active" ? (
                <div className="h-1 w-14 sm:w-18 overflow-hidden rounded-full bg-white/10">
                    <div
                        className="h-full rounded-full transition-none"
                        style={{
                            width: `${progress}%`,
                            background: "linear-gradient(90deg, #f7931a, #fbbf24)",
                            boxShadow: "0 0 10px rgba(247,147,26,0.6)",
                        }}
                    />
                </div>
            ) : (
                <div className="h-1" />
            )}

            {/* Label */}
            <span className={`
        font-mono text-[10px] sm:text-[11px] font-bold tracking-wider leading-tight text-center
        transition-colors duration-500
        ${state === "done" ? "text-green-300" : state === "active" ? "text-white" : "text-white/30"}
      `}>
                {step.label}
            </span>

            {/* Detail */}
            <span className={`
        font-mono text-[8px] sm:text-[9px] tracking-wide leading-tight text-center
        max-w-[110px] sm:max-w-[130px] transition-colors duration-500
        ${state === "active" ? "text-white/60" : state === "done" ? "text-white/35" : "text-white/15"}
      `}>
                {step.detail}
            </span>
        </div>
    );
}

/* ════════════════════════════════════════════════════
   SVG topology connectors
   ════════════════════════════════════════════════════ */
function TopoEdges({ nodeRefs, edges, getState }: {
    nodeRefs: React.RefObject<(HTMLDivElement | null)[]>;
    edges: [number, number][];
    getState: (i: number) => "pending" | "active" | "done";
}) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [paths, setPaths] = useState<Array<{
        d: string; fromState: string; toState: string;
    }>>([]);

    const compute = useCallback(() => {
        const svg = svgRef.current;
        const nodes = nodeRefs.current;
        if (!svg || !nodes) return;
        const svgRect = svg.getBoundingClientRect();

        const result = edges.map(([from, to]) => {
            const a = nodes[from];
            const b = nodes[to];
            if (!a || !b) return { d: "", fromState: "pending", toState: "pending" };

            const ar = a.getBoundingClientRect();
            const br = b.getBoundingClientRect();
            const ax = ar.left + ar.width / 2 - svgRect.left;
            const ay = ar.top + ar.height * 0.35 - svgRect.top;
            const bx = br.left + br.width / 2 - svgRect.left;
            const by = br.top + br.height * 0.35 - svgRect.top;

            // Curved path
            const mx = (ax + bx) / 2;
            const my = (ay + by) / 2;
            const dx = bx - ax;
            const dy = by - ay;
            // Perpendicular offset for curve
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const curveAmount = from === 2 && to === 3 ? 0 : len * 0.15; // straight for the vertical drop
            const cx = mx + (-dy / len) * curveAmount;
            const cy = my + (dx / len) * curveAmount;

            return {
                d: `M ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`,
                fromState: getState(from),
                toState: getState(to),
            };
        });
        setPaths(result);
    }, [edges, getState, nodeRefs]);

    useEffect(() => {
        compute();
        window.addEventListener("resize", compute);
        return () => window.removeEventListener("resize", compute);
    }, [compute]);

    return (
        <svg ref={svgRef} className="absolute inset-0 z-0 pointer-events-none overflow-visible">
            <defs>
                <linearGradient id="edge-done" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(34,197,94,0.5)" />
                    <stop offset="100%" stopColor="rgba(34,197,94,0.5)" />
                </linearGradient>
                <linearGradient id="edge-active" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(34,197,94,0.5)" />
                    <stop offset="100%" stopColor="rgba(247,147,26,0.7)" />
                </linearGradient>
                <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            {paths.map((p, i) => {
                if (!p.d) return null;
                const bothDone = p.fromState === "done" && p.toState === "done";
                const isLive = p.fromState === "done" && (p.toState === "active" || p.toState === "done");
                const isPending = !isLive && !bothDone;

                return (
                    <g key={i}>
                        {/* Glow layer */}
                        {isLive && (
                            <path
                                d={p.d}
                                fill="none"
                                stroke={bothDone ? "rgba(34,197,94,0.2)" : "rgba(247,147,26,0.15)"}
                                strokeWidth="8"
                                filter="url(#glow)"
                                className="transition-all duration-700"
                            />
                        )}
                        {/* Main line */}
                        <path
                            d={p.d}
                            fill="none"
                            stroke={
                                bothDone
                                    ? "rgba(34,197,94,0.5)"
                                    : isLive
                                        ? "url(#edge-active)"
                                        : "rgba(255,255,255,0.06)"
                            }
                            strokeWidth={isLive ? 2.5 : 1}
                            strokeDasharray={isPending ? "4 6" : "none"}
                            className="transition-all duration-700"
                        />
                        {/* Animated dash for active edge */}
                        {isLive && !bothDone && (
                            <path
                                d={p.d}
                                fill="none"
                                stroke="rgba(247,147,26,0.8)"
                                strokeWidth="2"
                                strokeDasharray="6 14"
                                className="animate-[dashFlow_1.5s_linear_infinite]"
                            />
                        )}
                    </g>
                );
            })}
        </svg>
    );
}

/* ════════════════════════════════════════════════════
   Main export
   ════════════════════════════════════════════════════ */
export function AgentFlowDemo({ steps }: Props) {
    const [activeIndex, setActiveIndex] = useState(-1);
    const [doneSet, setDoneSet] = useState<Set<number>>(new Set());
    const [progress, setProgress] = useState(0);
    const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);

    const getState = useCallback(
        (i: number): "pending" | "active" | "done" => {
            if (doneSet.has(i)) return "done";
            if (activeIndex === i) return "active";
            return "pending";
        },
        [activeIndex, doneSet]
    );

    useEffect(() => {
        let cancelled = false;
        async function run() {
          setActiveIndex(-1); setDoneSet(new Set()); setProgress(0);
          await sleep(600);
          for (let i = 0; i < steps.length; i++) {
              if (cancelled) return;
            setActiveIndex(i); setProgress(0);
            const t0 = performance.now();
            await new Promise<void>((res) => {
                (function tick() {
                    if (cancelled) { res(); return; }
                    const p = Math.min((performance.now() - t0) / STEP_MS, 1);
                    setProgress(p * 100);
                    p < 1 ? requestAnimationFrame(tick) : res();
                })();
            });
            if (cancelled) return;
            setDoneSet((s) => new Set([...s, i]));
        }
          setActiveIndex(steps.length);
          await sleep(PAUSE_MS);
          if (!cancelled) run();
      }
        run();
        return () => { cancelled = true; };
    }, [steps]);

    const allDone = activeIndex >= steps.length;
    const row0 = steps.slice(0, 3);
    const row1 = [steps[5], steps[4], steps[3]]; // reversed display order

    return (
        <div className="relative w-full rounded-3xl border border-white/[0.06] bg-[#060809] overflow-hidden">
            {/* Subtle grid */}
            <div
                className="absolute inset-0 opacity-[0.025] pointer-events-none"
                style={{
                    backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
                    backgroundSize: "32px 32px",
                }}
            />

            <div className="relative px-6 py-10 sm:px-10 sm:py-14">
                {/* SVG edges */}
                <TopoEdges nodeRefs={nodeRefs} edges={EDGES} getState={getState} />

                {/* Row 0: steps 0,1,2 left→right */}
                <div className="relative z-10 grid grid-cols-3 gap-4 sm:gap-8 mb-8 sm:mb-12">
                    {row0.map((step, i) => (
                        <div key={step.id} ref={(el) => { nodeRefs.current[i] = el; }}>
                            <Node step={step} index={i} state={getState(i)} progress={activeIndex === i ? progress : 0} />
                        </div>
                  ))}
                </div>

                {/* Row 1: steps 5,4,3 (display reversed so 3 is on right) */}
                <div className="relative z-10 grid grid-cols-3 gap-4 sm:gap-8">
                    {row1.map((step) => {
                        const realIndex = steps.indexOf(step);
                        return (
                            <div key={step.id} ref={(el) => { nodeRefs.current[realIndex] = el; }}>
                                <Node step={step} index={realIndex} state={getState(realIndex)} progress={activeIndex === realIndex ? progress : 0} />
                            </div>
                      );
                  })}
                </div>

                {/* Completion */}
                {allDone && (
                    <div className="relative z-10 mt-10 flex items-center justify-center gap-4 animate-[fadeIn_0.6s_ease-out]">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-500/40 to-transparent" />
                        <div className="flex items-center gap-2.5">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                            </span>
                            <span className="font-mono text-xs text-green-400 tracking-[0.25em] uppercase font-bold">
                                网站已就绪
                            </span>
                        </div>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-green-500/40 to-transparent" />
                    </div>
                )}
            </div>

            <style>{`
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(2); opacity: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dashFlow {
          to { stroke-dashoffset: -40; }
        }
      `}</style>
        </div>
    );
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
