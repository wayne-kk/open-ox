const DAY_MS = 86_400_000;

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateRange(params: {
  from?: string | null;
  to?: string | null;
  defaultDays?: number;
}): { from: Date; to: Date; days: number } {
  const defaultDays = params.defaultDays ?? 30;
  const today = startOfUtcDay(new Date());
  const to = params.to ? startOfUtcDay(new Date(`${params.to}T00:00:00.000Z`)) : today;
  const from = params.from
    ? startOfUtcDay(new Date(`${params.from}T00:00:00.000Z`))
    : new Date(to.getTime() - (defaultDays - 1) * DAY_MS);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    const fallbackFrom = new Date(today.getTime() - (defaultDays - 1) * DAY_MS);
    return { from: fallbackFrom, to: today, days: defaultDays };
  }

  const days = Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;
  return { from, to, days: Math.max(1, days) };
}

export function listDateKeys(from: Date, to: Date): string[] {
  const keys: string[] = [];
  for (let cursor = startOfUtcDay(from); cursor <= to; cursor = new Date(cursor.getTime() + DAY_MS)) {
    keys.push(formatDateKey(cursor));
  }
  return keys;
}

export function emptySeries(keys: string[], seriesKeys: string[]): Record<string, Record<string, number>> {
  return Object.fromEntries(
    keys.map((date) => [date, Object.fromEntries(seriesKeys.map((key) => [key, 0]))])
  );
}

export function incrementSeries(
  series: Record<string, Record<string, number>>,
  dateKey: string,
  metricKey: string,
  amount = 1
): void {
  if (!series[dateKey]) return;
  series[dateKey][metricKey] = (series[dateKey][metricKey] ?? 0) + amount;
}

export function seriesToPoints(
  series: Record<string, Record<string, number>>,
  keys: string[]
): Array<{ date: string; values: Record<string, number> }> {
  return keys.map((date) => ({ date, values: { ...series[date] } }));
}

export function computeKpiSnapshot(valuesByDate: Map<string, number>, todayKey: string): {
  today: number;
  yesterday: number;
  avg7d: number;
} {
  const today = valuesByDate.get(todayKey) ?? 0;
  const yesterdayDate = new Date(`${todayKey}T00:00:00.000Z`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterdayKey = formatDateKey(yesterdayDate);
  const yesterday = valuesByDate.get(yesterdayKey) ?? 0;

  let sum = 0;
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(`${todayKey}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - i);
    sum += valuesByDate.get(formatDateKey(d)) ?? 0;
  }

  return { today, yesterday, avg7d: Math.round((sum / 7) * 10) / 10 };
}
