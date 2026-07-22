"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { TimeSeriesPoint } from "@/lib/admin/analytics/types";

type TimeSeriesChartProps = {
  title: string;
  description?: string;
  data: TimeSeriesPoint[];
  series: Array<{ key: string; label: string; color: string }>;
  valueSuffix?: string;
};

export function TimeSeriesChart({
  title,
  description,
  data,
  series,
  valueSuffix = "",
}: TimeSeriesChartProps) {
  const chartConfig = series.reduce<ChartConfig>((acc, item) => {
    acc[item.key] = { label: item.label, color: item.color };
    return acc;
  }, {});

  const chartData: Array<Record<string, string | number>> = data.map(
    (point) => ({
      date: point.date.slice(5),
      ...point.values,
    }),
  );
  const latest = chartData.at(-1);

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {latest ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {series.map((item) => (
              <span
                key={item.key}
                className="inline-flex items-center gap-1.5 tabular-nums"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label} {latest[item.key] ?? 0}
                {valueSuffix}
              </span>
            ))}
          </div>
        ) : null}
      </header>
      <ChartContainer
        config={chartConfig}
        className="h-[220px] min-h-0 w-full sm:aspect-[2.4/1] sm:h-auto sm:min-h-[220px]"
      >
        <LineChart
          data={chartData}
          margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis tickLine={false} axisLine={false} width={40} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => (
                  <span>
                    {value}
                    {valueSuffix}
                  </span>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          {series.map((item) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              stroke={`var(--color-${item.key})`}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </section>
  );
}
