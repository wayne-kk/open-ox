"use client";

type HorizontalBarChartProps = {
  title: string;
  items: Array<{ label: string; value: number; suffix?: string }>;
  maxValue?: number;
};

export function HorizontalBarChart({ title, items, maxValue }: HorizontalBarChartProps) {
  const max = maxValue ?? Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h3 className="mb-4 text-sm font-medium text-foreground">{title}</h3>
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无数据</p>
        ) : (
          items.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="tabular-nums">
                  {item.value}
                  {item.suffix ?? ""}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/5">
                <div
                  className="h-2 rounded-full bg-primary/70"
                  style={{ width: `${Math.max(4, Math.round((item.value / max) * 100))}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
