"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const ORDER = ["system", "light", "dark"] as const;

export function ThemeToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const t = useTranslations("theme");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <span
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/40",
          className
        )}
        aria-hidden
      />
    );
  }

  const current = (theme ?? "system") as (typeof ORDER)[number];
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  if (compact) {
    const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          className
        )}
        aria-label={`${t(current)} → ${t(next)}`}
        title={t(current)}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-border bg-muted/40 p-0.5",
        className
      )}
      role="group"
      aria-label={t(current)}
    >
      {ORDER.map((value) => {
        const ActiveIcon = value === "light" ? Sun : value === "dark" ? Moon : Monitor;
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors",
              active
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={active}
          >
            <ActiveIcon className="h-3.5 w-3.5" />
            {t(value)}
          </button>
        );
      })}
      <span className="sr-only">resolved: {resolvedTheme}</span>
    </div>
  );
}
