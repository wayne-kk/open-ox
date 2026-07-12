"use client";

import { cn } from "@/lib/utils";

interface ModifyDetailsPreviewToggleProps {
  detailsActive: boolean;
  /** True when the Preview slot is already showing live current site. */
  previewActive: boolean;
  onDetails: () => void;
  onPreview: () => void;
  className?: string;
}

/** Per-turn Details | Preview controls (Details occupies the Preview slot). */
export function ModifyDetailsPreviewToggle({
  detailsActive,
  previewActive,
  onDetails,
  onPreview,
  className,
}: ModifyDetailsPreviewToggleProps) {
  return (
    <div
      className={cn(
        "inline-flex w-full rounded-lg bg-white/4 p-0.5 ring-1 ring-inset ring-white/6",
        className
      )}
      role="group"
      aria-label="变更视图"
    >
      <button
        type="button"
        onClick={onDetails}
        className={cn(
          "flex-1 rounded-md px-3 py-1.5 text-[11px] font-medium tracking-wide transition-colors",
          detailsActive
            ? "bg-white/10 text-foreground shadow-sm"
            : "text-muted-foreground/80 hover:text-foreground/90"
        )}
      >
        详情
      </button>
      <button
        type="button"
        onClick={onPreview}
        disabled={previewActive}
        title={previewActive ? "已在当前预览" : "显示当前站点预览（非历史版本）"}
        className={cn(
          "flex-1 rounded-md px-3 py-1.5 text-[11px] font-medium tracking-wide transition-colors",
          previewActive
            ? "cursor-default text-muted-foreground/35"
            : "text-muted-foreground/80 hover:text-foreground/90"
        )}
      >
        预览
      </button>
    </div>
  );
}
