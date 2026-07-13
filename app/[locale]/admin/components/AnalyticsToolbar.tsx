"use client";

import { DateRangeSelect, getDateRangeParams } from "./DateRangeSelect";

type AnalyticsToolbarProps = {
  days: number;
  onDaysChange: (days: number) => void;
  excludeInternal: boolean;
  onExcludeInternalChange: (value: boolean) => void;
  exportType: "funnel" | "retention" | "engagement";
  anchor?: "registration" | "firstReady";
  onAnchorChange?: (anchor: "registration" | "firstReady") => void;
};

export function AnalyticsToolbar({
  days,
  onDaysChange,
  excludeInternal,
  onExcludeInternalChange,
  exportType,
  anchor,
  onAnchorChange,
}: AnalyticsToolbarProps) {
  async function handleExport() {
    const { from, to } = getDateRangeParams(days);
    const params = new URLSearchParams({
      type: exportType,
      from,
      to,
      excludeInternal: String(excludeInternal),
    });
    if (anchor) params.set("anchor", anchor);
    window.open(`/api/admin/analytics/export?${params.toString()}`, "_blank");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <DateRangeSelect days={days} onChange={onDaysChange} />
      <label className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-1.5 text-xs">
        <input
          type="checkbox"
          checked={excludeInternal}
          onChange={(e) => onExcludeInternalChange(e.target.checked)}
          className="accent-primary"
        />
        排除内部账号
      </label>
      {onAnchorChange ? (
        <select
          value={anchor ?? "registration"}
          onChange={(e) =>
            onAnchorChange(e.target.value === "firstReady" ? "firstReady" : "registration")
          }
          className="rounded-md border border-border bg-input px-3 py-1.5 text-xs outline-none"
        >
          <option value="registration">Cohort：注册周</option>
          <option value="firstReady">Cohort：首次 Ready 周</option>
        </select>
      ) : null}
      <button
        type="button"
        onClick={() => void handleExport()}
        className="rounded-md border border-primary/35 bg-primary/15 px-3 py-1.5 text-xs text-primary"
      >
        导出 CSV
      </button>
    </div>
  );
}
