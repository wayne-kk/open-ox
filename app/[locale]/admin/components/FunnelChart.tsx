"use client";

import type { ActivationFunnelResponse } from "@/lib/admin/analytics/funnel";

type FunnelChartProps = {
  steps: ActivationFunnelResponse["steps"];
};

export function FunnelChart({ steps }: FunnelChartProps) {
  const max = Math.max(...steps.map((step) => step.count), 1);

  return (
    <div className="space-y-3">
      {steps.map((step) => {
        const width = Math.max(8, Math.round((step.count / max) * 100));
        return (
          <div key={step.id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{step.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {step.count}
                {step.conversionFromPrevious != null ? (
                  <span className="ml-2 text-xs">← {step.conversionFromPrevious}%</span>
                ) : null}
                <span className="ml-2 text-xs text-primary">{step.conversionFromFirst}% 总转化</span>
              </span>
            </div>
            <div className="h-3 rounded-full bg-muted">
              <div
                className="h-3 rounded-full bg-primary/70 transition-all"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
