"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("locale");
  const [pending, startTransition] = useTransition();

  function switchTo(next: AppLocale) {
    if (next === locale || pending) return;
    startTransition(() => {
      // next-intl updates the locale cookie on the client before navigating,
      // avoiding as-needed middleware redirect hops that flash the page.
      router.replace(pathname, { locale: next });
    });
  }

  if (compact) {
    const other = routing.locales.find((l) => l !== locale) ?? "en";
    return (
      <button
        type="button"
        onClick={() => switchTo(other)}
        disabled={pending}
        className={cn(
          "inline-flex h-8 items-center rounded-full px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60",
          className
        )}
        aria-label={t(other)}
      >
        {other === "en" ? "EN" : "中文"}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-border bg-muted/40 p-0.5",
        pending && "opacity-70",
        className
      )}
      role="group"
    >
      {routing.locales.map((value) => {
        const active = locale === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => switchTo(value)}
            disabled={pending}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3 text-[12px] font-medium transition-colors disabled:pointer-events-none",
              active
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={active}
          >
            {t(value)}
          </button>
        );
      })}
    </div>
  );
}
