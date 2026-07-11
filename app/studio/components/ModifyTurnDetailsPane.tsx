"use client";

import { useState } from "react";
import { ArrowLeft, History, ListTree } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModifyRecord } from "@/app/studio/hooks/useBuildStudio";
import { DiffPatchLines } from "@/app/studio/components/DiffPatchView";
import { formatModifyDetailsSummary } from "@/app/studio/lib/modifyHistoryView";

interface ModifyTurnDetailsPaneProps {
  record: ModifyRecord;
  filePath: string;
  onFilePathChange: (path: string) => void;
  onBackToPreview: () => void;
  onOpenTimeline: () => void;
}

export function ModifyTurnDetailsPane({
  record,
  filePath,
  onFilePathChange,
  onBackToPreview,
  onOpenTimeline,
}: ModifyTurnDetailsPaneProps) {
  const [changesOpen, setChangesOpen] = useState(false);
  const diffs = record.diffs ?? [];
  const active = diffs.find((d) => d.file === filePath) ?? diffs[0] ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.22))]">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/8 px-3 py-2.5">
        <button
          type="button"
          onClick={onBackToPreview}
          className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/3 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground/80 transition-colors hover:border-white/18 hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          返回预览
        </button>
        <div className="flex-1 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/85">
          Details
        </div>
        <div className="relative flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenTimeline}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/3 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground/80 transition-colors hover:border-white/18 hover:text-foreground"
            title="打开左侧变更时间线"
          >
            <History className="h-3 w-3" />
            Timeline
          </button>
          <button
            type="button"
            onClick={() => setChangesOpen((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[10px] transition-colors",
              changesOpen
                ? "border-primary/35 bg-primary/10 text-primary"
                : "border-white/10 bg-white/3 text-muted-foreground/80 hover:border-white/18 hover:text-foreground"
            )}
            title="本步改动的文件"
          >
            <ListTree className="h-3 w-3" />
            Changes
            <span className="text-muted-foreground/50">{diffs.length}</span>
          </button>
          {changesOpen ? (
            <div className="absolute right-0 top-[calc(100%+6px)] z-20 w-[min(360px,70vw)] overflow-hidden rounded-xl border border-white/10 bg-[#0c0e12] shadow-xl">
              <div className="border-b border-white/8 px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
                本步文件
              </div>
              <div className="max-h-[240px] overflow-y-auto scrollbar-unified">
                {diffs.map((d) => (
                  <button
                    key={d.file}
                    type="button"
                    onClick={() => {
                      onFilePathChange(d.file);
                      setChangesOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[11px] transition-colors hover:bg-white/[0.04]",
                      (active?.file ?? filePath) === d.file
                        ? "bg-white/[0.06] text-foreground"
                        : "text-muted-foreground/85"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{d.file}</span>
                    <span className="shrink-0 text-green-400/70">+{d.stats.additions}</span>
                    <span className="shrink-0 text-red-400/70">-{d.stats.deletions}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-unified">
        {active ? (
          <div className="border-b border-white/8">
            <div className="flex items-center justify-between gap-3 border-b border-white/6 bg-black/25 px-4 py-2.5">
              <span className="truncate font-mono text-[12px] text-foreground/90">{active.file}</span>
              <div className="flex shrink-0 items-center gap-3 font-mono text-[10px]">
                <span className="text-green-400/80">+{active.stats.additions}</span>
                <span className="text-red-400/80">-{active.stats.deletions}</span>
              </div>
            </div>
            <DiffPatchLines patch={active.patch} />
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center font-mono text-[11px] text-muted-foreground/70">
            此回合没有可显示的 diff
          </div>
        )}

        <div className="border-t border-white/[0.06] px-4 py-4">
          <p className="text-[13px] leading-relaxed text-foreground/85">
            {formatModifyDetailsSummary(record)}
          </p>
        </div>
      </div>
    </div>
  );
}
