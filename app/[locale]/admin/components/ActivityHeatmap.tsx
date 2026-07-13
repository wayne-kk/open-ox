"use client";

const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

type ActivityHeatmapProps = {
  title: string;
  cells: Array<{ day: number; hour: number; users: number }>;
};

export function ActivityHeatmap({ title, cells }: ActivityHeatmapProps) {
  const max = Math.max(...cells.map((cell) => cell.users), 1);
  const grid = new Map<string, number>();
  for (const cell of cells) {
    grid.set(`${cell.day}:${cell.hour}`, cell.users);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-4 text-sm font-medium text-foreground">{title}</h3>
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="mb-2 grid grid-cols-[2rem_repeat(24,minmax(0,1fr))] gap-1 text-[10px] text-muted-foreground">
            <div />
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="text-center">
                {hour}
              </div>
            ))}
          </div>
          {Array.from({ length: 7 }, (_, day) => (
            <div key={day} className="mb-1 grid grid-cols-[2rem_repeat(24,minmax(0,1fr))] gap-1">
              <div className="flex items-center text-[10px] text-muted-foreground">{DAY_LABELS[day]}</div>
              {Array.from({ length: 24 }, (_, hour) => {
                const users = grid.get(`${day}:${hour}`) ?? 0;
                const intensity = users === 0 ? 0 : Math.max(0.12, users / max);
                return (
                  <div
                    key={`${day}-${hour}`}
                    title={`周${DAY_LABELS[day]} ${hour}:00 · ${users} 用户`}
                    className="aspect-square rounded-sm border border-border"
                    style={{ backgroundColor: `rgba(247, 147, 26, ${intensity})` }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
