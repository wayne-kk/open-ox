"use client";

import { useEffect, useState } from "react";
import { VibeLayoutShell } from "@/app/[locale]/studio/components/vibe/VibeLayoutShell";
import { SiteOutlineEditor } from "@/app/[locale]/studio/components/SiteOutlineEditor";
import {
  VIBE_DIRECTIONS,
  extractBriefTitle,
  type VibeDirection,
} from "@/lib/studio/vibeDirections";
import {
  createEmptySiteOutline,
  parseSiteOutline,
  type SiteOutline,
} from "@/lib/studio/siteOutline";
import { cn } from "@/lib/utils";

export type DirectionLockConfirmPayload = {
  vibe: VibeDirection;
  outline: SiteOutline;
};

type DirectionLockPanelProps = {
  projectId?: string | null;
  briefMarkdown?: string;
  initialOutline?: SiteOutline | null;
  disabled?: boolean;
  onConfirm: (payload: DirectionLockConfirmPayload) => void;
  onBackToBrief?: () => void;
  onRegenerateOutline?: () => void;
};

export function DirectionLockPanel({
  projectId,
  briefMarkdown,
  initialOutline,
  disabled = false,
  onConfirm,
  onBackToBrief,
  onRegenerateOutline,
}: DirectionLockPanelProps) {
  const [directions, setDirections] = useState<VibeDirection[]>(VIBE_DIRECTIONS);
  const [loadingDirections, setLoadingDirections] = useState(Boolean(projectId));
  const [selectedId, setSelectedId] = useState<string>(VIBE_DIRECTIONS[0]?.id ?? "cold-tech");
  const [outline, setOutline] = useState<SiteOutline>(
    () => initialOutline ?? createEmptySiteOutline()
  );
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);

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
        const json = (await res.json()) as { data?: { directions?: VibeDirection[] } };
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

  async function refreshLayoutPreview() {
    if (!projectId || !selected || disabled) return;
    setLayoutLoading(true);
    setLayoutError(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/vibe-layout-preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vibe: selected,
            briefTitle: title,
            briefExcerpt: (briefMarkdown ?? "").slice(0, 800),
          }),
        }
      );
      if (!res.ok) throw new Error(`layout preview ${res.status}`);
      const json = (await res.json()) as {
        data?: { html?: string; layoutVariantId?: string };
      };
      const html = json.data?.html;
      if (typeof html !== "string" || !html.trim()) throw new Error("empty html");
      setDirections((prev) =>
        prev.map((d) =>
          d.id === selected.id
            ? {
                ...d,
                previewHtml: html,
                layoutVariantId:
                  (json.data?.layoutVariantId as VibeDirection["layoutVariantId"]) ??
                  d.layoutVariantId,
              }
            : d
        )
      );
    } catch (err) {
      setLayoutError(err instanceof Error ? err.message : "布局预览失败，仍可确认");
    } finally {
      setLayoutLoading(false);
    }
  }

  const canConfirm = Boolean(selected) && outline.modules.length > 0 && !loadingDirections;

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-3">
      <div className="space-y-1">
        <div className="text-[12px] font-medium text-foreground">确认气质与结构</div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          选定视觉方向并确认首页模块后，再开始完整生成。
          {loadingDirections ? " 正在生成三套气质方向…" : null}
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-medium text-foreground">气质方向</div>
        <p className="text-[10px] text-muted-foreground">视觉方向样张，不是成品。</p>
        <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible">
          {loadingDirections
            ? [0, 1, 2].map((key) => (
                <div
                  key={key}
                  className="min-h-36 min-w-46 flex-1 animate-pulse rounded-xl border border-border bg-muted/40 md:min-w-0"
                />
              ))
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
                    {isSelected && vibe.previewHtml ? (
                      <div
                        className={cn(
                          "overflow-hidden rounded-xl border",
                          isSelected ? "ring-2 ring-primary/70" : ""
                        )}
                      >
                        <iframe
                          title={`layout-${vibe.id}`}
                          sandbox="allow-scripts"
                          srcDoc={vibe.previewHtml}
                          className="h-40 w-full bg-white"
                        />
                      </div>
                    ) : (
                      <VibeLayoutShell vibe={vibe} title={title} selected={isSelected} />
                    )}
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || loadingDirections || layoutLoading || !selected}
            onClick={() => void refreshLayoutPreview()}
            className="rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {layoutLoading ? "生成布局中…" : "换一批布局"}
          </button>
          {layoutError ? (
            <span className="text-[10px] text-amber-600/90">{layoutError}</span>
          ) : null}
        </div>
      </div>

      <SiteOutlineEditor
        outline={outline}
        onChange={setOutline}
        disabled={disabled || loadingDirections}
      />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={disabled || !canConfirm || !selected}
          onClick={() => {
            if (!selected) return;
            const parsed = parseSiteOutline(outline) ?? outline;
            if (parsed.modules.length === 0) return;
            onConfirm({ vibe: selected, outline: parsed });
          }}
          className="rounded-xl bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          确认气质与结构并生成
        </button>
        {onRegenerateOutline ? (
          <button
            type="button"
            disabled={disabled || loadingDirections}
            onClick={onRegenerateOutline}
            className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            AI 重提结构
          </button>
        ) : null}
        {onBackToBrief ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onBackToBrief}
            className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            返回改 Brief
          </button>
        ) : null}
      </div>
    </div>
  );
}
