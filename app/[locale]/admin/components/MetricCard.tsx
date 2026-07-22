import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  title: string;
  value: string | number;
  hint?: string;
  delta?: string;
  deltaValue?: number;
  lowerIsBetter?: boolean;
  icon?: React.ReactNode;
  className?: string;
};

export function MetricCard({
  title,
  value,
  hint,
  delta,
  deltaValue,
  lowerIsBetter = false,
  icon,
  className,
}: MetricCardProps) {
  const improved =
    deltaValue == null || deltaValue === 0
      ? null
      : lowerIsBetter
        ? deltaValue < 0
        : deltaValue > 0;
  const DeltaIcon =
    deltaValue == null || deltaValue === 0
      ? Minus
      : deltaValue > 0
        ? ArrowUpRight
        : ArrowDownRight;

  return (
    <Card
      className={cn(
        "gap-3 rounded-lg bg-card py-4 ring-1 ring-foreground/8",
        className,
      )}
    >
      <CardHeader className="flex-row items-center justify-between pb-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon ? <span className="text-muted-foreground/70">{icon}</span> : null}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <div className="mt-2 flex min-h-4 items-center gap-1.5 text-[11px]">
          {delta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                improved === true && "text-emerald-600 dark:text-emerald-400",
                improved === false && "text-rose-600 dark:text-rose-400",
                improved == null && "text-muted-foreground",
              )}
            >
              <DeltaIcon className="h-3 w-3" />
              {delta}
            </span>
          ) : null}
          {hint ? (
            <span className="truncate text-muted-foreground/80">{hint}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
