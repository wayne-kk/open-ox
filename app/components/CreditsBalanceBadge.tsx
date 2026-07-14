"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Coins, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Align with MIN_GENERATE_CREDITS — avoid importing billing env into the client bundle. */
const LOW_BALANCE_THRESHOLD = 8;

type CreditsResponse = {
  enabled: boolean;
  balance: number | null;
  plan?: string;
  proTier?: string | null;
};

function formatBalance(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Compact credit balance control for the workspace shell.
 * Hover: tip · Click: /pricing. Hidden when credits are disabled.
 */
export function CreditsBalanceBadge({
  className,
  collapsed = false,
}: {
  className?: string;
  collapsed?: boolean;
}) {
  const t = useTranslations("pricing");
  const [data, setData] = useState<CreditsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/credits");
        if (!res.ok) return;
        const json = (await res.json()) as CreditsResponse;
        if (!cancelled) setData(json);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const balance = data?.balance;
  const isPro = data?.plan === "pro";
  const low =
    typeof balance === "number" &&
    Number.isFinite(balance) &&
    balance < LOW_BALANCE_THRESHOLD;

  const tip = useMemo(() => {
    if (typeof balance !== "number") return t("badgeTip");
    if (low) return t("badgeTipLow");
    if (isPro) return t("badgeTipPro");
    return t("badgeTip");
  }, [balance, isPro, low, t]);

  if (!data?.enabled || balance == null) return null;

  const display = formatBalance(balance);

  return (
    <TooltipProvider delayDuration={280}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/pricing"
            aria-label={`${t("badgeAria", { balance: display })}${isPro ? " · Pro" : ""}`}
            className={cn(
              "group relative flex items-center overflow-hidden rounded-lg border transition",
              "border-border/50 bg-gradient-to-br from-background/90 to-muted/40",
              "hover:border-primary/35 hover:from-primary/[0.06] hover:to-muted/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              low && "border-amber-500/35 from-amber-500/[0.07] to-muted/40",
              collapsed ? "h-10 w-10 justify-center" : "w-full gap-2.5 px-2.5 py-2",
              className
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                low
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-primary/10 text-primary"
              )}
              aria-hidden
            >
              <Coins className="h-3.5 w-3.5" strokeWidth={2} />
            </span>

            {!collapsed ? (
              <>
                <span className="min-w-0 flex-1 text-left leading-tight">
                  <span className="flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        "text-[15px] font-semibold tabular-nums tracking-tight text-foreground",
                        low && "text-amber-700 dark:text-amber-300"
                      )}
                    >
                      {display}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {t("badgeUnit")}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground/80">
                    {isPro ? t("badgePlanPro") : t("badgePlanFree")}
                    {low ? ` · ${t("badgeLowHint")}` : ""}
                  </span>
                </span>
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden
                />
              </>
            ) : null}
          </Link>
        </TooltipTrigger>
        <TooltipContent side={collapsed ? "right" : "top"} sideOffset={8}>
          <p className="max-w-[200px] leading-snug">
            <span className="font-medium tabular-nums">
              {display} {t("badgeUnit")}
            </span>
            {isPro ? " · Pro" : ""}
            <span className="mt-0.5 block text-background/75">{tip}</span>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
