"use client";

import { useEffect, useState } from "react";
import {
  VIBE_DIRECTIONS,
  type VibeDirection,
  extractBriefTitle,
} from "@/lib/studio/vibeDirections";
import { cn } from "@/lib/utils";

type VibePickerPanelProps = {
  projectId?: string | null;
  briefMarkdown?: string;
  disabled?: boolean;
  /** Early clarify/options: select only. confirm_brief must not use this panel. */
  mode?: "select" | "generate";
  onConfirm: (vibe: VibeDirection) => void;
  onSkip?: () => void;
};

function VibeMiniSample({
  vibe,
  title,
  selected,
}: {
  vibe: VibeDirection;
  title: string;
  selected: boolean;
}) {
  const t = vibe.tokens;
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-shadow",
        selected ? "ring-2 ring-primary/70 border-primary/40" : "border-border"
      )}
      style={{ background: t.background, color: t.foreground }}
    >
      <div className="space-y-3 p-3" style={{ borderBottom: `1px solid ${t.border}` }}>
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-[9px] uppercase tracking-[0.14em]"
            style={{ color: t.muted, fontFamily: t.fontBody }}
          >
            Preview
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-medium"
            style={{
              background: t.accent,
              color: t.accentForeground,
              borderRadius: t.radius,
            }}
          >
            CTA
          </span>
        </div>
        <div
          className="text-[15px] leading-snug font-semibold tracking-tight"
          style={{ fontFamily: t.fontDisplay }}
        >
          {title}
        </div>
        <p className="text-[10px] leading-relaxed" style={{ color: t.muted, fontFamily: t.fontBody }}>
          {vibe.tagline}
        </p>
        <div
          className="inline-flex items-center px-2.5 py-1 text-[10px] font-medium"
          style={{
            background: t.accent,
            color: t.accentForeground,
            borderRadius: t.radius,
            fontFamily: t.fontBody,
          }}
        >
          了解更多
        </div>
      </div>
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: t.background }}>
        {[t.background, t.foreground, t.accent, t.muted].map((color) => (
          <span
            key={color}
            className="h-3 w-3 rounded-full border"
            style={{ background: color, borderColor: t.border }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}

function VibeCardSkeleton() {
  return (
    <div className="min-w-46 flex-1 animate-pulse md:min-w-0">
      <div className="h-40 rounded-xl border border-border bg-muted/40" />
      <div className="mt-2 space-y-2 px-0.5">
        <div className="h-3 w-20 rounded bg-muted/60" />
        <div className="h-3 w-28 rounded bg-muted/40" />
      </div>
    </div>
  );
}

export function VibePickerPanel({
  projectId,
  briefMarkdown,
  disabled = false,
  mode = "select",
  onConfirm,
  onSkip,
}: VibePickerPanelProps) {
  const [directions, setDirections] = useState<VibeDirection[]>(VIBE_DIRECTIONS);
  const [loadingDirections, setLoadingDirections] = useState(Boolean(projectId));
  const [selectedId, setSelectedId] = useState<string>(VIBE_DIRECTIONS[0]?.id ?? "cold-tech");
  const title = extractBriefTitle(briefMarkdown);
  const selected = directions.find((v) => v.id === selectedId) ?? directions[0];

  useEffect(() => {
    if (!projectId) {
      setDirections(VIBE_DIRECTIONS);
      setSelectedId(VIBE_DIRECTIONS[0]?.id ?? "cold-tech");
      setLoadingDirections(false);
      return;
    }

    const controller = new AbortController();
    setLoadingDirections(true);

    void (async () => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/vibe-directions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ briefMarkdown: briefMarkdown ?? "" }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`vibe-directions ${res.status}`);
        const json = (await res.json()) as {
          data?: { directions?: VibeDirection[] };
        };
        const next = json.data?.directions;
        if (!Array.isArray(next) || next.length < 3) throw new Error("invalid directions");
        if (controller.signal.aborted) return;
        setDirections(next);
        setSelectedId(next[0]!.id);
      } catch {
        if (controller.signal.aborted) return;
        setDirections(VIBE_DIRECTIONS);
        setSelectedId(VIBE_DIRECTIONS[0]?.id ?? "cold-tech");
      } finally {
        if (!controller.signal.aborted) setLoadingDirections(false);
      }
    })();

    return () => controller.abort();
  }, [projectId, briefMarkdown]);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card/40 p-3">
      <div className="space-y-1">
        <div className="text-[12px] font-medium text-foreground">选一个气质方向</div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          这是视觉方向样张，不是成品预览。先选定气质；受众 / 产品方向会在下一步再选，不用和这三张一起选。
          {loadingDirections ? " 正在按你的需求生成三套方向…" : null}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible">
        {loadingDirections
          ? [0, 1, 2].map((key) => <VibeCardSkeleton key={key} />)
          : directions.map((vibe) => {
              const isSelected = vibe.id === selectedId;
              return (
                <button
                  key={vibe.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedId(vibe.id)}
                  className={cn(
                    "min-w-46 flex-1 text-left transition-opacity disabled:opacity-50 md:min-w-0",
                    !isSelected && "opacity-80 hover:opacity-100"
                  )}
                >
                  <VibeMiniSample vibe={vibe} title={title} selected={isSelected} />
                  <div className="mt-2 space-y-1 px-0.5">
                    <div className="text-[12px] font-medium text-foreground">
                      {vibe.label}
                      {isSelected ? " · 已选" : ""}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {vibe.moods.map((mood) => (
                        <span
                          key={mood}
                          className="rounded-full border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {mood}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              );
            })}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={disabled || loadingDirections || !selected}
          onClick={() => selected && onConfirm(selected)}
          className="rounded-xl bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {mode === "generate" ? "用这个气质生成" : "选定这个气质"}
        </button>
        {onSkip ? (
          <button
            type="button"
            disabled={disabled || loadingDirections}
            onClick={onSkip}
            className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            跳过，用默认
          </button>
        ) : null}
      </div>
    </div>
  );
}
