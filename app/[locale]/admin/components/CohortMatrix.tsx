"use client";

import type { RetentionCohortRow } from "@/lib/admin/analytics/retention";

const DAY_LABELS: Record<number, string> = {
  1: "D1",
  7: "D7",
  14: "D14",
  30: "D30",
};

function cellColor(value: number): string {
  if (value >= 40) return "bg-emerald-500/35 text-emerald-100";
  if (value >= 20) return "bg-emerald-500/20 text-emerald-100/90";
  if (value >= 10) return "bg-primary/20 text-primary";
  if (value > 0) return "bg-white/10 text-foreground/80";
  return "bg-white/[0.03] text-muted-foreground";
}

type CohortMatrixProps = {
  cohorts: RetentionCohortRow[];
};

export function CohortMatrix({ cohorts }: CohortMatrixProps) {
  const days = [1, 7, 14, 30] as const;

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Cohort 周</th>
            <th className="px-3 py-2">人数</th>
            {days.map((day) => (
              <th key={day} className="px-3 py-2 text-center">
                {DAY_LABELS[day]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                所选时间范围内无 cohort 数据
              </td>
            </tr>
          ) : (
            cohorts.map((cohort) => (
              <tr key={cohort.cohortWeek} className="border-t border-white/10">
                <td className="px-3 py-2 font-mono text-xs">{cohort.cohortWeek}</td>
                <td className="px-3 py-2 tabular-nums">{cohort.cohortSize}</td>
                {days.map((day) => (
                  <td key={day} className="px-2 py-2">
                    <div
                      className={`rounded-md px-2 py-1 text-center text-xs tabular-nums ${cellColor(cohort.retention[day])}`}
                    >
                      {cohort.retention[day]}%
                    </div>
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
