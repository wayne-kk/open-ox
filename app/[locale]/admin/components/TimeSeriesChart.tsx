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
  data: TimeSeriesPoint[];
  series: Array<{ key: string; label: string; color: string }>;
  valueSuffix?: string;
};

export function TimeSeriesChart({ title, data, series, valueSuffix = "" }: TimeSeriesChartProps) {
  const chartConfig = series.reduce<ChartConfig>((acc, item) => {
    acc[item.key] = { label: item.label, color: item.color };
    return acc;
  }, {});

  const chartData = data.map((point) => ({
    date: point.date.slice(5),
    ...point.values,
  }));

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h3 className="mb-4 text-sm font-medium text-foreground">{title}</h3>
      <ChartContainer config={chartConfig} className="aspect-[2.4/1] min-h-[220px] w-full">
        <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tickLine={false} axisLine={false} width={40} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
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
    </div>
  );
}
