"use client";

import type { AdminAlert } from "@/lib/admin/analytics/alerts";

const SEVERITY_STYLES: Record<AdminAlert["severity"], string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-200",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  info: "border-white/10 bg-white/[0.03] text-foreground/90",
};

type AlertListProps = {
  alerts: AdminAlert[];
  compact?: boolean;
};

export function AlertList({ alerts, compact = false }: AlertListProps) {
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`rounded-lg border px-3 py-2 ${SEVERITY_STYLES[alert.severity]}`}
        >
          <p className={`font-medium ${compact ? "text-xs" : "text-sm"}`}>{alert.title}</p>
          {!compact ? <p className="mt-1 text-xs opacity-90">{alert.message}</p> : null}
        </div>
      ))}
    </div>
  );
}
