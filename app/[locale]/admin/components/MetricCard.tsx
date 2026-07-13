import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  title: string;
  value: string | number;
  hint?: string;
  delta?: string;
  className?: string;
};

export function MetricCard({ title, value, hint, delta, className }: MetricCardProps) {
  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
        {delta ? <p className="text-xs text-muted-foreground">{delta}</p> : null}
        {hint ? <p className="text-[11px] text-muted-foreground/80">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
