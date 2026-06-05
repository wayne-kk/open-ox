"use client";

import { useEffect, useState, useRef } from "react";

const LINES = [
    { text: '> open-ox create "咖啡品牌官网"', delay: 0, color: "text-muted-foreground" },
    { text: "  ✓ analyze_requirement", delay: 600, color: "text-primary" },
    { text: "    home: 一站式产品故事 + 购买入口", delay: 900, color: "text-muted-foreground/70" },
    { text: "    style: 温暖 · 极简 · 品牌感", delay: 1100, color: "text-muted-foreground/70" },
    { text: "  ✓ plan_project", delay: 1600, color: "text-primary" },
    { text: "    pageGoal · narrativeArc · hierarchy", delay: 1900, color: "text-muted-foreground/70" },
    { text: "  ✓ generate_design_system", delay: 2400, color: "text-accent-tertiary" },
    { text: "    palette: warm brown · cream · dark roast", delay: 2700, color: "text-muted-foreground/70" },
    { text: "  ✓ architect_scaffold_agent  [chrome=top-nav+footer]", delay: 3000, color: "text-primary" },
    { text: "  ✓ chrome_optimize_agent  [links reconciled]", delay: 4500, color: "text-primary" },
    { text: "    app/layout.tsx          ✓", delay: 3150, color: "text-green-400/80" },
    { text: "    components/chrome/Nav   ✓", delay: 3250, color: "text-green-400/80" },
    { text: "  ⟳ page_implement_agent  [home]", delay: 3400, color: "text-primary" },
    { text: "    read app/layout.tsx     ✓", delay: 3600, color: "text-green-400/80" },
    { text: "    write app/page.tsx      ✓", delay: 3850, color: "text-green-400/80" },
    { text: "    components/HeroSection  ✓", delay: 4050, color: "text-green-400/80" },
    { text: "    components/ProductGrid  ✓", delay: 4250, color: "text-green-400/80" },
    { text: "  ✓ install_dependencies", delay: 4600, color: "text-primary" },
    { text: "    + framer-motion  + lucide-react", delay: 4900, color: "text-muted-foreground/70" },
    { text: "  ✓ run_build  [passed]", delay: 5400, color: "text-green-400" },
    { text: "", delay: 5700, color: "" },
    { text: "  ● ready  → 预览已就绪", delay: 5900, color: "text-accent-tertiary" },
];

export function HeroTerminal() {
    const [visibleCount, setVisibleCount] = useState(0);
    const [cursor, setCursor] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = [];
        LINES.forEach((line, i) => {
            timers.push(setTimeout(() => setVisibleCount(i + 1), line.delay));
        });
        return () => timers.forEach(clearTimeout);
    }, []);

    // Restart animation every 8s
    useEffect(() => {
        const interval = setInterval(() => {
            setVisibleCount(0);
            const timers: ReturnType<typeof setTimeout>[] = [];
            LINES.forEach((line, i) => {
                timers.push(setTimeout(() => setVisibleCount(i + 1), line.delay));
            });
            return () => timers.forEach(clearTimeout);
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    // Blinking cursor
    useEffect(() => {
        const interval = setInterval(() => setCursor((c) => !c), 530);
        return () => clearInterval(interval);
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [visibleCount]);

    return (
        <div className="relative">
            {/* Glow behind terminal */}
            <div className="absolute -inset-4 rounded-2xl bg-primary/5 blur-2xl" />

            <div className="relative rounded-xl border border-white/10 bg-[#06080b]/95 shadow-[0_0_40px_-10px_rgb(247_147_26/20%)] overflow-hidden">
                {/* Title bar */}
                <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                    <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">
                        open-ox · studio
                    </span>
                </div>

                {/* Terminal body */}
                <div
                    ref={containerRef}
                    className="h-[340px] overflow-y-auto p-5 font-mono text-[12px] leading-6 scrollbar-hidden"
                >
                    {LINES.slice(0, visibleCount).map((line, i) => (
                        <div
                            key={i}
                            className={`${line.color} atlas-node-in`}
                            style={{ animationDelay: "0ms" }}
                        >
                            {line.text || "\u00A0"}
                        </div>
                    ))}
                    {visibleCount < LINES.length && (
                        <span className="text-primary">{cursor ? "█" : " "}</span>
                    )}
                    {visibleCount >= LINES.length && (
                        <span className="text-primary">{cursor ? "█" : " "}</span>
                    )}
                </div>
            </div>
        </div>
    );
}
