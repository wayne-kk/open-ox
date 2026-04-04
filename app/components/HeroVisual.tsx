"use client";

import { useEffect, useState, useRef } from "react";

/*
 * Simulates a browser window where a website is being "assembled" by AI.
 * Blocks appear one by one with typing/building animations.
 */

const BLOCKS = [
    { id: "nav", label: "Navbar", h: "h-8", color: "from-primary/20 to-primary/5", delay: 400 },
    { id: "hero", label: "Hero Section", h: "h-28", color: "from-primary/15 to-accent-tertiary/10", delay: 1000 },
    { id: "feat", label: "Features ×3", h: "h-16", color: "from-accent-tertiary/15 to-accent-tertiary/5", delay: 1800 },
    { id: "cta", label: "Call to Action", h: "h-12", color: "from-green-500/15 to-green-500/5", delay: 2600 },
    { id: "footer", label: "Footer", h: "h-8", color: "from-white/10 to-white/3", delay: 3200 },
];

const CODE_LINES = [
    { text: "analyzing requirements...", color: "text-primary/60", delay: 0 },
    { text: "→ pages: home, about, pricing", color: "text-white/40", delay: 300 },
    { text: "generating design system", color: "text-accent-tertiary/60", delay: 800 },
    { text: "→ palette: modern dark + accent", color: "text-white/40", delay: 1100 },
    { text: "building NavbarSection", color: "text-primary/60", delay: 1500 },
    { text: "✓ NavbarSection ready", color: "text-green-400/60", delay: 1900 },
    { text: "building HeroSection", color: "text-primary/60", delay: 2100 },
    { text: "✓ HeroSection ready", color: "text-green-400/60", delay: 2700 },
    { text: "building FeaturesSection ×3", color: "text-primary/60", delay: 2900 },
    { text: "✓ all sections ready", color: "text-green-400/60", delay: 3400 },
    { text: "running next build...", color: "text-accent-tertiary/60", delay: 3600 },
    { text: "✓ build passed", color: "text-green-400/80", delay: 4200 },
];

export function HeroVisual() {
    const [visibleBlocks, setVisibleBlocks] = useState(0);
    const [visibleLines, setVisibleLines] = useState(0);
    const [cycle, setCycle] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    // Animation loop
    useEffect(() => {
        setVisibleBlocks(0);
        setVisibleLines(0);
        const timers: ReturnType<typeof setTimeout>[] = [];

        BLOCKS.forEach((b, i) => {
            timers.push(setTimeout(() => setVisibleBlocks(i + 1), b.delay));
        });
        CODE_LINES.forEach((l, i) => {
            timers.push(setTimeout(() => setVisibleLines(i + 1), l.delay));
        });

        // Restart
        timers.push(setTimeout(() => setCycle((c) => c + 1), 6000));
        return () => timers.forEach(clearTimeout);
    }, [cycle]);

    return (
        <div className="relative w-full max-w-[1040px] mx-auto">
            {/* Glow behind */}
            <div className="absolute -inset-8 rounded-3xl bg-primary/8 blur-3xl pointer-events-none" />
            <div className="absolute -inset-4 rounded-3xl bg-accent-tertiary/5 blur-2xl pointer-events-none" />

            <div className="relative grid grid-cols-5 gap-3">
                {/* ── Left: Browser mockup ── */}
                <div className="col-span-3 rounded-xl border border-white/10 bg-[#0a0c10] overflow-hidden shadow-[0_0_60px_-15px_rgba(247,147,26,0.2)]">
                    {/* Browser chrome */}
                    <div className="flex items-center gap-1.5 border-b border-white/8 px-3 py-2">
                        <div className="h-2 w-2 rounded-full bg-red-500/60" />
                        <div className="h-2 w-2 rounded-full bg-yellow-500/60" />
                        <div className="h-2 w-2 rounded-full bg-green-500/60" />
                        <div className="ml-2 flex-1 rounded-md bg-white/5 px-2 py-0.5">
                            <span className="font-mono text-[8px] text-white/25">your-website.com</span>
                        </div>
                    </div>

                    {/* Page being built — fixed height so animation never shifts layout */}
                    <div ref={containerRef} className="relative h-[360px] overflow-hidden">
                        {/* Static layout skeleton (always occupies space) */}
                        <div className="absolute inset-0 p-3 flex flex-col gap-2 pointer-events-none">
                            {BLOCKS.map((block) => (
                                <div key={block.id} className={`${block.h} shrink-0`} />
                            ))}
                        </div>

                        {/* Animated blocks rendered on top */}
                        <div className="absolute inset-0 p-3 flex flex-col gap-2">
                            {BLOCKS.map((block, i) => {
                                const visible = i < visibleBlocks;
                                const isLast = i === visibleBlocks - 1;
                                return (
                                    <div
                                        key={block.id}
                                        className={`${block.h} shrink-0 rounded-lg border border-white/[0.06] overflow-hidden transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"
                                            } bg-gradient-to-r ${block.color} animate-[blockIn_0.5s_ease-out_forwards]`}
                                        style={{ animationPlayState: visible ? "running" : "paused" }}
                                    >
                                        <div className="relative h-full w-full overflow-hidden">
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="font-mono text-[8px] text-white/20 tracking-wider">{block.label}</span>
                                            </div>
                                            {isLast && (
                                                <div className="absolute inset-0 animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Loading dots — absolutely positioned, no layout impact */}
                        {visibleBlocks < BLOCKS.length && (
                            <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                                <div className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                                <div className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                                <div className="h-1 w-1 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right: AI log panel ── */}
                <div className="col-span-2 rounded-xl border border-white/10 bg-[#0a0c10] overflow-hidden shadow-[0_0_40px_-15px_rgba(247,147,26,0.15)]">
                    <div className="flex items-center gap-1.5 border-b border-white/8 px-3 py-2">
                        <span className="h-2 w-2 rounded-full bg-primary/60 animate-pulse" />
                        <span className="font-mono text-[8px] text-white/30 tracking-wider">AI ENGINE</span>
                    </div>
                    <div className="relative h-[320px] overflow-hidden p-2.5">
                        <div className="space-y-1">
                            {CODE_LINES.slice(0, visibleLines).map((line, i) => (
                                <div
                                    key={i}
                                    className={`font-mono text-[9px] leading-relaxed ${line.color} animate-[fadeSlide_0.3s_ease-out]`}
                                >
                                    {line.text}
                                </div>
                            ))}
                            {visibleLines < CODE_LINES.length && (
                                <span className="inline-block w-1.5 h-3 bg-primary/60 animate-[blink_1s_step-end_infinite]" />
                            )}
                            {visibleLines >= CODE_LINES.length && (
                                <div className="mt-2 flex items-center gap-1.5 animate-[fadeSlide_0.4s_ease-out]">
                                    <span className="relative flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                                    </span>
                                    <span className="font-mono text-[9px] text-green-400/80">ready to preview</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes blockIn {
          from { opacity: 0; transform: translateY(8px) scaleY(0.9); }
          to { opacity: 1; transform: translateY(0) scaleY(1); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateX(-6px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
        </div>
    );
}
