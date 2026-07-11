"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type CreditsResponse = {
  enabled: boolean;
  balance: number | null;
  plan?: string;
  proTier?: string | null;
};

/**
 * Compact balance chip for the workspace shell. Hidden when credits are disabled
 * or the API is unavailable (migration not applied yet).
 */
export function CreditsBalanceBadge({ className }: { className?: string }) {
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

  if (!data?.enabled || data.balance == null) return null;

  return (
    <Link
      href="/pricing"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2 py-0.5 text-[12px] tabular-nums text-muted-foreground transition hover:border-primary/40 hover:text-primary",
        className
      )}
      title="View plans and top up"
    >
      <span>
        {data.balance} credits
        {data.plan === "pro" ? " · Pro" : ""}
      </span>
    </Link>
  );
}
