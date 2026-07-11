"use client";

import { useEffect, useState, useRef } from "react";

const BLOCKS = [
  { id: "nav", label: "Navbar", h: "h-8", color: "from-white/8 to-white/2", delay: 400 },
  { id: "hero", label: "Hero Section", h: "h-28", color: "from-white/6 to-white/1", delay: 1000 },
  { id: "feat", label: "Features ×3", h: "h-16", color: "from-white/5 to-transparent", delay: 1800 },
  { id: "cta", label: "Call to Action", h: "h-12", color: "from-primary/20 to-primary/5", delay: 2600 },
  { id: "footer", label: "Footer", h: "h-8", color: "from-white/4 to-transparent", delay: 3200 },
];

const CODE_LINES = [
  { text: "analyzing requirements...", color: "text-white/45", delay: 0 },
  { text: "→ pages: home, about, pricing", color: "text-white/65", delay: 300 },
  { text: "generating design system", color: "text-white/45", delay: 800 },
  { text: "→ palette: modern dark + accent", color: "text-white/65", delay: 1100 },
  { text: "building NavbarSection", color: "text-white/45", delay: 1500 },
  { text: "✓ NavbarSection ready", color: "text-emerald-400/80", delay: 1900 },
  { text: "building HeroSection", color: "text-white/45", delay: 2100 },
  { text: "✓ HeroSection ready", color: "text-emerald-400/80", delay: 2700 },
  { text: "building FeaturesSection ×3", color: "text-white/45", delay: 2900 },
  { text: "✓ all sections ready", color: "text-emerald-400/80", delay: 3400 },
  { text: "running next build...", color: "text-white/45", delay: 3600 },
  { text: "✓ build passed", color: "text-emerald-400", delay: 4200 },
];

export function HeroVisual() {
  const [visibleBlocks, setVisibleBlocks] = useState(0);
  const [visibleLines, setVisibleLines] = useState(0);
  const [cycle, setCycle] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

    timers.push(setTimeout(() => setCycle((c) => c + 1), 6000));
    return () => timers.forEach(clearTimeout);
  }, [cycle]);

  return (
    <div className="relative mx-auto w-full max-w-[1040px]">
      <div className="pointer-events-none absolute -inset-6 rounded-3xl bg-white/2 blur-2xl" />

      <div className="relative grid grid-cols-5 gap-3">
        <div className="col-span-3 overflow-hidden rounded-2xl border border-white/8 bg-[#0c0c0e] shadow-[0_24px_48px_-24px_rgba(0,0,0,0.8)]">
          <div className="flex items-center gap-1.5 border-b border-white/6 px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-white/20" />
            <div className="h-2 w-2 rounded-full bg-white/15" />
            <div className="h-2 w-2 rounded-full bg-white/10" />
            <div className="ml-2 flex-1 rounded-md bg-white/4 px-2 py-0.5">
              <span className="font-mono text-[8px] text-white/40">your-website.com</span>
            </div>
          </div>

          <div ref={containerRef} className="relative h-[360px] overflow-hidden">
            <div className="pointer-events-none absolute inset-0 flex flex-col gap-2 p-3">
              {BLOCKS.map((block) => (
                <div key={block.id} className={`${block.h} shrink-0`} />
              ))}
            </div>

            <div className="absolute inset-0 flex flex-col gap-2 p-3">
              {BLOCKS.map((block, i) => {
                const visible = i < visibleBlocks;
                const isLast = i === visibleBlocks - 1;
                return (
                  <div
                    key={block.id}
                    className={`${block.h} shrink-0 overflow-hidden rounded-lg border border-white/6 bg-gradient-to-r ${block.color} transition-opacity duration-300 ${
                      visible ? "opacity-100" : "opacity-0"
                    } animate-[blockIn_0.5s_ease-out_forwards]`}
                    style={{ animationPlayState: visible ? "running" : "paused" }}
                  >
                    <div className="relative h-full w-full overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-mono text-[8px] tracking-wider text-white/25">
                          {block.label}
                        </span>
                      </div>
                      {isLast ? (
                        <div className="absolute inset-0 animate-[shimmer_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/4 to-transparent" />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {visibleBlocks < BLOCKS.length ? (
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
                <div className="h-1 w-1 animate-bounce rounded-full bg-white/50" style={{ animationDelay: "0ms" }} />
                <div className="h-1 w-1 animate-bounce rounded-full bg-white/40" style={{ animationDelay: "150ms" }} />
                <div className="h-1 w-1 animate-bounce rounded-full bg-white/30" style={{ animationDelay: "300ms" }} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="col-span-2 overflow-hidden rounded-2xl border border-white/8 bg-[#0c0c0e] shadow-[0_24px_48px_-24px_rgba(0,0,0,0.8)]">
          <div className="flex items-center gap-1.5 border-b border-white/6 px-3 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-signal" />
            <span className="font-mono text-[8px] tracking-wider text-white/40">build log</span>
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
              {visibleLines < CODE_LINES.length ? (
                <span className="inline-block h-3 w-1.5 animate-[blink_1s_step-end_infinite] bg-white/40" />
              ) : null}
              {visibleLines >= CODE_LINES.length ? (
                <div className="mt-2 flex animate-[fadeSlide_0.4s_ease-out] items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="font-mono text-[9px] text-emerald-400">ready to preview</span>
                </div>
              ) : null}
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
