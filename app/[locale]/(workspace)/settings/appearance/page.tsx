"use client";

import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function AppearanceSettingsPage() {
  const t = useTranslations("settings");

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10 lg:px-8">
      <header className="mb-10">
        <h1 className="font-heading text-2xl font-semibold tracking-[-0.03em] text-foreground">
          {t("appearance")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("appearanceDescription")}</p>
      </header>

      <section className="space-y-8">
        <div className="space-y-3">
          <h2 className="text-[13px] font-medium text-foreground">{t("theme")}</h2>
          <ThemeToggle />
        </div>
        <div className="space-y-3">
          <h2 className="text-[13px] font-medium text-foreground">{t("language")}</h2>
          <LocaleSwitcher />
        </div>
      </section>
    </main>
  );
}
