"use client";

import type { ReactNode } from "react";
import type { VibeDirection } from "@/lib/studio/vibeDirections";
import { cn } from "@/lib/utils";

type VibeLayoutShellProps = {
  vibe: VibeDirection;
  title: string;
  selected?: boolean;
  className?: string;
};

function ShellChrome({
  vibe,
  title,
  children,
}: {
  vibe: VibeDirection;
  title: string;
  children: ReactNode;
}) {
  const t = vibe.tokens;
  return (
    <div
      className="overflow-hidden rounded-xl border"
      style={{
        background: t.background,
        color: t.foreground,
        borderColor: t.border,
        fontFamily: t.fontBody,
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-2"
        style={{ borderBottom: `1px solid ${t.border}` }}
      >
        <span className="truncate text-[10px] font-semibold tracking-tight" style={{ fontFamily: t.fontDisplay }}>
          {title}
        </span>
        <div className="flex gap-2 text-[9px]" style={{ color: t.muted }}>
          <span>产品</span>
          <span>方案</span>
        </div>
        <span
          className="shrink-0 px-2 py-0.5 text-[9px] font-medium"
          style={{
            background: t.accent,
            color: t.accentForeground,
            borderRadius: t.radius,
          }}
        >
          CTA
        </span>
      </div>
      {children}
      <div className="flex gap-1.5 px-3 py-2" style={{ borderTop: `1px solid ${t.border}` }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-6 flex-1 rounded"
            style={{
              background: t.muted,
              opacity: 0.22 + i * 0.08,
              borderRadius: t.radius,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function HeroCentered({ vibe, title }: { vibe: VibeDirection; title: string }) {
  const t = vibe.tokens;
  return (
    <ShellChrome vibe={vibe} title={title}>
      <div className="space-y-2 px-4 py-5 text-center">
        <div className="text-[13px] font-semibold leading-snug tracking-tight" style={{ fontFamily: t.fontDisplay }}>
          {title}
        </div>
        <p className="text-[10px] leading-relaxed" style={{ color: t.muted }}>
          {vibe.tagline}
        </p>
        <div
          className="mx-auto inline-flex px-3 py-1 text-[10px] font-medium"
          style={{
            background: t.accent,
            color: t.accentForeground,
            borderRadius: t.radius,
          }}
        >
          了解更多
        </div>
      </div>
    </ShellChrome>
  );
}

function HeroSplit({ vibe, title }: { vibe: VibeDirection; title: string }) {
  const t = vibe.tokens;
  return (
    <ShellChrome vibe={vibe} title={title}>
      <div className="grid grid-cols-2 gap-2 px-3 py-4">
        <div className="space-y-2 text-left">
          <div className="text-[12px] font-semibold leading-snug" style={{ fontFamily: t.fontDisplay }}>
            {title}
          </div>
          <p className="text-[9px] leading-relaxed" style={{ color: t.muted }}>
            {vibe.tagline}
          </p>
          <div
            className="inline-flex px-2.5 py-1 text-[9px] font-medium"
            style={{
              background: t.accent,
              color: t.accentForeground,
              borderRadius: t.radius,
            }}
          >
            开始
          </div>
        </div>
        <div
          className="min-h-16 rounded"
          style={{
            background: `linear-gradient(145deg, ${t.border}, ${t.muted}55)`,
            borderRadius: t.radius,
            border: `1px solid ${t.border}`,
          }}
        />
      </div>
    </ShellChrome>
  );
}

function HeroEditorial({ vibe, title }: { vibe: VibeDirection; title: string }) {
  const t = vibe.tokens;
  return (
    <ShellChrome vibe={vibe} title={title}>
      <div className="space-y-3 px-4 py-5">
        <p className="text-[9px] uppercase tracking-[0.16em]" style={{ color: t.muted }}>
          {vibe.moods[0] ?? "Editorial"}
        </p>
        <div
          className="max-w-[90%] text-left text-[14px] font-semibold leading-tight tracking-tight"
          style={{ fontFamily: t.fontDisplay }}
        >
          {title}
        </div>
        <p className="max-w-[85%] text-left text-[10px] leading-relaxed" style={{ color: t.muted }}>
          {vibe.tagline}
        </p>
        <div className="flex items-center gap-2 pt-1">
          <div className="h-px flex-1" style={{ background: t.border }} />
          <span
            className="text-[9px] font-medium"
            style={{ color: t.accent }}
          >
            阅读更多
          </span>
        </div>
      </div>
    </ShellChrome>
  );
}

export function VibeLayoutShell({ vibe, title, selected, className }: VibeLayoutShellProps) {
  const body =
    vibe.layoutVariantId === "hero_split" ? (
      <HeroSplit vibe={vibe} title={title} />
    ) : vibe.layoutVariantId === "hero_editorial" ? (
      <HeroEditorial vibe={vibe} title={title} />
    ) : (
      <HeroCentered vibe={vibe} title={title} />
    );

  return (
    <div
      className={cn(
        "transition-shadow",
        selected ? "ring-2 ring-primary/70 rounded-xl" : "opacity-90",
        className
      )}
    >
      {body}
    </div>
  );
}
