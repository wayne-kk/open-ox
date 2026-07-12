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
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option.days}
          type="button"
          onClick={() => onChange(option.days)}
          className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
            days === option.days
              ? "border-primary/35 bg-primary/15 text-primary"
              : "border-white/15 bg-white/5 text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
