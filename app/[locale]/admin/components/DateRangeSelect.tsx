"use client";

const OPTIONS = [
  { label: "7 天", days: 7 },
  { label: "30 天", days: 30 },
  { label: "90 天", days: 90 },
] as const;

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getDateRangeParams(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { from: formatDate(from), to: formatDate(to) };
}

type DateRangeSelectProps = {
  days: number;
  onChange: (days: number) => void;
};

export function DateRangeSelect({ days, onChange }: DateRangeSelectProps) {
  return (
    <div
      className="inline-flex rounded-md border border-border bg-muted/70 p-0.5"
      aria-label="时间范围"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.days}
          type="button"
          onClick={() => onChange(option.days)}
          className={`rounded-[4px] px-3 py-1.5 text-xs transition-colors ${
            days === option.days
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-pressed={days === option.days}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
