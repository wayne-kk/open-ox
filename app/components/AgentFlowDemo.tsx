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

const STEP_MS = 1800;
const PAUSE_MS = 3000;

/*
 * Topology layout (desktop):
 *   [0] ——→ [1] ——→ [2]
 *                     ↓
 *   [5] ←── [4] ←── [3]
 *    ↑ (repair loop back to [4])
 */
const EDGES: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
];

/* ════════════════════════════════════════════════════
   Node component — with breathing glow, ripple, glass
   ════════════════════════════════════════════════════ */
function Node({
    step, index, state, progress, isParallel, hovered, onHover, onLeave,
}: {
        step: Step; index: number;
        state: "pending" | "active" | "done";
        progress: number;
        isParallel: boolean;
        hovered: boolean;
        onHover: () => void;
        onLeave: () => void;
}) {
    // Non-linear progress: fast start, pause at 80%, then snap to 100%
    const displayProgress = progress < 80
        ? progress * 1.0
        : progress < 95
            ? 80 + (progress - 80) * 0.3
            : 80 + (progress - 80) * 1.5;

    return (
        <div
            className={`
        relative flex flex-col items-center gap-3 transition-all duration-500 cursor-default
        ${state === "pending" ? "opacity-25 scale-95" : "opacity-100"}
        ${state === "active" ? "scale-[1.08] z-20" : ""}
        ${hovered && state !== "pending" ? "scale-[1.12] z-30" : ""}
      `}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
        >
            {/* Breathing glow — active node */}
            {state === "active" && (
                <div className="absolute -inset-8 rounded-3xl pointer-events-none animate-[breathe_2s_ease-in-out_infinite]"
                    style={{ background: "radial-gradient(circle, rgba(247,147,26,0.15) 0%, transparent 70%)" }}
                />
            )}
            {/* Done glow */}
            {state === "done" && (
                <div className="absolute -inset-5 rounded-3xl bg-green-500/8 blur-xl pointer-events-none" />
            )}

            {/* Main card — glass effect */}
            <div className={`
        relative flex h-[72px] w-[72px] sm:h-[88px] sm:w-[88px] items-center justify-center
        rounded-2xl font-mono text-xl sm:text-2xl transition-all duration-500
        backdrop-blur-sm
        ${state === "done"
                ? "bg-green-500/15 border-2 border-green-400/50 text-green-300 shadow-[0_0_24px_rgba(34,197,94,0.3)]"
                : state === "active"
                    ? "bg-primary/12 border-2 border-primary/60 text-primary shadow-[0_0_32px_rgba(247,147,26,0.35)]"
                    : "bg-white/[0.03] border border-white/8 text-white/20"
        }
      `}>
                {state === "done" ? (
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 16 16">
                        <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                ) : state === "active" ? (
                    <span className="animate-[breathe_2s_ease-in-out_infinite]">
                        {["⟐", "◆", "▲", "✦", "⬢", "●"][index]}
                    </span>
                    ) : (
                            <span>{["⟐", "◆", "▲", "✦", "⬢", "●"][index]}</span>
                )}

                {/* Active ripple rings */}
                {state === "active" && (
                    <>
                        <span className="absolute inset-0 rounded-2xl border-2 border-primary/30 animate-[ripple_2s_ease-out_infinite]" />
                        <span className="absolute inset-0 rounded-2xl border border-primary/15 animate-[ripple_2s_ease-out_0.7s_infinite]" />
                    </>
                )}

                {/* Done ripple burst — plays once */}
                {state === "done" && (
                    <span className="absolute inset-0 rounded-2xl border-2 border-green-400/40 animate-[rippleBurst_0.8s_ease-out_forwards]" />
                )}

                {/* Number badge */}
                <span className={`
          absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full
          text-[9px] font-bold font-mono border transition-all duration-500
          ${state === "done"
                    ? "bg-green-500 border-green-400 text-black"
                    : state === "active"
                        ? "bg-primary border-primary text-black"
                        : "bg-white/8 border-white/12 text-white/25"
          }
        `}>
                    {index + 1}
                </span>
            </div>

            {/* Parallel split indicators for generate_sections */}
            {isParallel && state === "active" && (
                <div className="flex items-center gap-1 -mt-1">
                    {[0, 1, 2, 3].map((j) => (
                        <div
                            key={j}
                            className="h-1.5 w-4 rounded-full bg-accent-tertiary/40 overflow-hidden"
                        >
                            <div
                                className="h-full rounded-full bg-accent-tertiary animate-[parallelBar_1.2s_ease-in-out_infinite]"
                                style={{ animationDelay: `${j * 200}ms` }}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Progress bar — non-linear */}
            {state === "active" && !isParallel ? (
                <div className="h-1 w-14 sm:w-18 overflow-hidden rounded-full bg-white/8">
                    <div
                        className="h-full rounded-full transition-[width] duration-100"
                        style={{
                            width: `${Math.min(displayProgress, 100)}%`,
                            background: "linear-gradient(90deg, #f7931a, #fbbf24)",
                            boxShadow: "0 0 10px rgba(247,147,26,0.5)",
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
        ${state === "done" ? "text-green-300" : state === "active" ? "text-white" : "text-white/25"}
      `}>
                {step.label}
            </span>

            {/* Detail */}
            <span className={`
        font-mono text-[8px] sm:text-[9px] tracking-wide leading-tight text-center
        max-w-[110px] sm:max-w-[130px] transition-all duration-500
        ${state === "active" ? "text-white/55 translate-y-0" : state === "done" ? "text-white/30" : "text-white/10"}
      `}>
                {step.detail}
            </span>
        </div>
    );
}

/* ════════════════════════════════════════════════════
   SVG topology connectors with particle flow
   ════════════════════════════════════════════════════ */
function TopoEdges({ nodeRefs, edges, getState, repairActive }: {
    nodeRefs: React.RefObject<(HTMLDivElement | null)[]>;
    edges: [number, number][];
    getState: (i: number) => "pending" | "active" | "done";
    repairActive: boolean;
}) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [paths, setPaths] = useState<Array<{
        d: string; fromState: string; toState: string; id: string;
    }>>([]);
    const [repairPath, setRepairPath] = useState("");

    const compute = useCallback(() => {
        const svg = svgRef.current;
        const nodes = nodeRefs.current;
        if (!svg || !nodes) return;
        const svgRect = svg.getBoundingClientRect();

        const getCenter = (idx: number) => {
            const el = nodes[idx];
            if (!el) return { x: 0, y: 0 };
            const r = el.getBoundingClientRect();
            return {
                x: r.left + r.width / 2 - svgRect.left,
                y: r.top + r.height * 0.35 - svgRect.top,
            };
        };

        const result = edges.map(([from, to]) => {
          const a = getCenter(from);
          const b = getCenter(to);
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const curveAmount = from === 2 && to === 3 ? 0 : len * 0.15;
          const cx = mx + (-dy / len) * curveAmount;
          const cy = my + (dx / len) * curveAmount;

          return {
            d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`,
            fromState: getState(from),
            toState: getState(to),
            id: `edge-${from}-${to}`,
          };
      });
        setPaths(result);

        // Repair loop: curved path from node 5 back to node 4
        const n5 = getCenter(5);
        const n4 = getCenter(4);
        if (n5.x && n4.x) {
            const loopY = Math.max(n5.y, n4.y) + 60;
            setRepairPath(`M ${n5.x} ${n5.y + 20} C ${n5.x} ${loopY}, ${n4.x} ${loopY}, ${n4.x} ${n4.y + 20}`);
        }
    }, [edges, getState, nodeRefs]);

    useEffect(() => {
        compute();
        window.addEventListener("resize", compute);
        return () => window.removeEventListener("resize", compute);
    }, [compute]);

    return (
        <svg ref={svgRef} className="absolute inset-0 z-0 pointer-events-none overflow-visible">
            <defs>
                <linearGradient id="grad-active" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(34,197,94,0.5)" />
                    <stop offset="100%" stopColor="rgba(247,147,26,0.7)" />
                </linearGradient>
                <linearGradient id="grad-repair" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="rgba(251,146,60,0.6)" />
                    <stop offset="100%" stopColor="rgba(239,68,68,0.4)" />
                </linearGradient>
                <filter id="glow-edge">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="glow-particle">
                    <feGaussianBlur stdDeviation="2" />
                </filter>
            </defs>

            {paths.map((p, i) => {
                if (!p.d) return null;
                const bothDone = p.fromState === "done" && p.toState === "done";
                const isLive = p.fromState === "done" && (p.toState === "active" || p.toState === "done");

              return (
              <g key={p.id}>
                  {/* Glow layer */}
                  {isLive && (
                      <path d={p.d} fill="none"
                          stroke={bothDone ? "rgba(34,197,94,0.15)" : "rgba(247,147,26,0.12)"}
                          strokeWidth="10" filter="url(#glow-edge)" />
                  )}
                  {/* Base line */}
                  <path d={p.d} fill="none"
                      stroke={bothDone ? "rgba(34,197,94,0.45)" : isLive ? "url(#grad-active)" : "rgba(255,255,255,0.04)"}
                      strokeWidth={isLive ? 2 : 1}
                      strokeDasharray={!isLive ? "4 8" : "none"}
                      className="transition-all duration-700" />

                  {/* Particle flow — multiple dots traveling along the path */}
                  {isLive && !bothDone && (
                          <>
                              <circle r="2.5" fill="#f7931a" filter="url(#glow-particle)">
                                  <animateMotion dur="1.5s" repeatCount="indefinite" keyTimes="0;1" keySplines="0.4 0 0.2 1" calcMode="spline">
                                      <mpath href={`#path-${p.id}`} />
                                  </animateMotion>
                              </circle>
                              <circle r="1.5" fill="#fbbf24" opacity="0.7">
                                  <animateMotion dur="1.5s" repeatCount="indefinite" begin="0.5s" keyTimes="0;1" keySplines="0.4 0 0.2 1" calcMode="spline">
                                      <mpath href={`#path-${p.id}`} />
                                  </animateMotion>
                              </circle>
                              <circle r="1" fill="#fde68a" opacity="0.5">
                                  <animateMotion dur="1.5s" repeatCount="indefinite" begin="1s" keyTimes="0;1" keySplines="0.4 0 0.2 1" calcMode="spline">
                                      <mpath href={`#path-${p.id}`} />
                                  </animateMotion>
                              </circle>
                              {/* Hidden path for animateMotion reference */}
                              <path id={`path-${p.id}`} d={p.d} fill="none" stroke="none" />
                          </>
                      )}

                      {/* Done particles — slower, green */}
                      {bothDone && (
                          <>
                              <circle r="1.5" fill="#22c55e" opacity="0.4">
                                  <animateMotion dur="3s" repeatCount="indefinite">
                                      <mpath href={`#pathd-${p.id}`} />
                                  </animateMotion>
                              </circle>
                              <path id={`pathd-${p.id}`} d={p.d} fill="none" stroke="none" />
                          </>
                      )}
                  </g>
              );
          })}

            {/* Repair loop path */}
            {repairActive && repairPath && (
                <g>
                    <path d={repairPath} fill="none" stroke="url(#grad-repair)" strokeWidth="1.5"
                        strokeDasharray="6 6" className="animate-[dashFlow_1s_linear_infinite]" />
                    <path d={repairPath} fill="none" stroke="rgba(251,146,60,0.08)" strokeWidth="8" filter="url(#glow-edge)" />
                    <circle r="2" fill="#fb923c" filter="url(#glow-particle)">
                        <animateMotion dur="2s" repeatCount="indefinite">
                            <mpath href="#repair-mpath" />
                        </animateMotion>
                    </circle>
                    <path id="repair-mpath" d={repairPath} fill="none" stroke="none" />
                </g>
            )}
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
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [repairActive, setRepairActive] = useState(false);
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
        setActiveIndex(-1); setDoneSet(new Set()); setProgress(0); setRepairActive(false);
        await sleep(600);
        for (let i = 0; i < steps.length; i++) {
            if (cancelled) return;
            setActiveIndex(i); setProgress(0);

          // Repair step (index 5): show repair loop briefly
          if (i === 5) {
              setRepairActive(true);
              await sleep(600);
              if (cancelled) return;
          }

          const duration = i === 3 ? STEP_MS * 1.5 : STEP_MS; // generate_sections takes longer
          const t0 = performance.now();
          await new Promise<void>((res) => {
              (function tick() {
                  if (cancelled) { res(); return; }
                const p = Math.min((performance.now() - t0) / duration, 1);
                setProgress(p * 100);
                p < 1 ? requestAnimationFrame(tick) : res();
            })();
        });
          if (cancelled) return;
          setDoneSet((s) => new Set([...s, i]));
          if (i === 5) setRepairActive(false);
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
    const row1 = [steps[5], steps[4], steps[3]];

    return (
        <div className="relative w-full rounded-3xl border border-white/[0.06] bg-[#060809] overflow-hidden">
          {/* Dot grid */}
          <div
              className="absolute inset-0 opacity-[0.02] pointer-events-none"
              style={{
                  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)",
                  backgroundSize: "32px 32px",
              }}
          />

          {/* Hover dimming overlay */}
          {hoveredIndex !== null && (
              <div className="absolute inset-0 bg-black/20 z-10 pointer-events-none transition-opacity duration-300" />
          )}

          <div className="relative px-6 py-10 sm:px-10 sm:py-14">
              <TopoEdges nodeRefs={nodeRefs} edges={EDGES} getState={getState} repairActive={repairActive} />

              {/* Row 0 */}
              <div className="relative z-10 grid grid-cols-3 gap-4 sm:gap-8 mb-8 sm:mb-12">
                  {row0.map((step, i) => (
                      <div key={step.id} ref={(el) => { nodeRefs.current[i] = el; }}>
                  <Node
                      step={step} index={i} state={getState(i)}
                      progress={activeIndex === i ? progress : 0}
                      isParallel={false}
                      hovered={hoveredIndex === i}
                      onHover={() => setHoveredIndex(i)}
                      onLeave={() => setHoveredIndex(null)}
                  />
              </div>
          ))}
              </div>

              {/* Row 1 */}
              <div className="relative z-10 grid grid-cols-3 gap-4 sm:gap-8">
                  {row1.map((step) => {
                      const realIndex = steps.indexOf(step);
                      return (
                          <div key={step.id} ref={(el) => { nodeRefs.current[realIndex] = el; }}>
                      <Node
                          step={step} index={realIndex} state={getState(realIndex)}
                          progress={activeIndex === realIndex ? progress : 0}
                          isParallel={realIndex === 3}
                          hovered={hoveredIndex === realIndex}
                          onHover={() => setHoveredIndex(realIndex)}
                          onLeave={() => setHoveredIndex(null)}
                      />
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
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes rippleBurst {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes breathe {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dashFlow {
          to { stroke-dashoffset: -24; }
        }
        @keyframes parallelBar {
          0% { width: 0%; }
          50% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>
      </div>
  );
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
