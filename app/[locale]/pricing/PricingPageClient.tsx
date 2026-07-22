"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

type Catalog = {
  creditsEnabled: boolean;
  stripeConfigured: boolean;
  pro: Array<{
    id: string;
    name: string;
    monthlyCredits: number;
    priceUsd: number;
    highlight: boolean;
    available: boolean;
  }>;
};

type CreditsSnap = {
  enabled: boolean;
  balance: number | null;
  plan?: string;
  proTier?: string | null;
};

const ENTERPRISE_EMAIL = "782884630@qq.com";

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.08]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-[15px] font-medium text-foreground/90">{q}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <div className="pb-5 pr-8 text-[14px] leading-relaxed text-muted-foreground">{a}</div>
      ) : null}
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[13px] leading-snug text-muted-foreground">
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-signal" strokeWidth={2.5} />
      <span>{children}</span>
    </li>
  );
}

export function PricingPageClient() {
  const t = useTranslations("pricing");
  const search = useSearchParams();
  const checkout = search.get("checkout");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [credits, setCredits] = useState<CreditsSnap | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTierId, setSelectedTierId] = useState<string>("pro_200");

  const faq = useMemo(
    () =>
      [
        { q: t("faq1q"), a: t("faq1a") },
        { q: t("faq2q"), a: t("faq2a") },
        { q: t("faq3q"), a: t("faq3a") },
        { q: t("faq4q"), a: t("faq4a") },
        { q: t("faq5q"), a: t("faq5a") },
      ] as const,
    [t]
  );

  useEffect(() => {
    void (async () => {
      const [catRes, credRes] = await Promise.all([
        fetch("/api/billing/catalog"),
        fetch("/api/credits"),
      ]);
      if (catRes.ok) {
        const cat = (await catRes.json()) as Catalog;
        setCatalog(cat);
        const preferred =
          cat.pro.find((p) => p.highlight)?.id ||
          cat.pro.find((p) => p.available)?.id ||
          cat.pro[0]?.id;
        if (preferred) setSelectedTierId(preferred);
      }
      if (credRes.ok) setCredits((await credRes.json()) as CreditsSnap);
    })();
  }, [checkout]);

  const selectedTier = useMemo(
    () => catalog?.pro.find((p) => p.id === selectedTierId) ?? catalog?.pro[0],
    [catalog, selectedTierId]
  );

  const startCheckout = useCallback(
    async (body: { kind: "subscription"; tierId: string }) => {
      setError(null);
      setBusy(body.tierId);
      try {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !json.url) {
          setError(json.error ?? "Checkout failed");
          return;
        }
        window.location.href = json.url;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Checkout failed");
      } finally {
        setBusy(null);
      }
    },
    []
  );

  const openPortal = useCallback(async () => {
    setError(null);
    setBusy("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? "Could not open billing portal");
        return;
      }
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal failed");
    } finally {
      setBusy(null);
    }
  }, []);

  const isCurrentPro =
    credits?.plan === "pro" && credits.proTier === selectedTier?.id;

  return (
    <div className="relative min-h-dvh bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(255,255,255,0.04),transparent)]"
      />

      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-28 pt-14 md:pt-16">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-heading text-4xl font-semibold tracking-[-0.035em] text-foreground md:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground md:text-[17px]">
            {t("subtitle")}
          </p>
          {credits?.plan === "pro" ? (
            <button
              type="button"
              onClick={() => void openPortal()}
              disabled={busy !== null}
              className="mt-4 text-[13px] text-brand-signal hover:underline disabled:opacity-50"
            >
              {busy === "portal" ? t("opening") : t("manageSubscription")}
            </button>
          ) : null}
        </div>

        {checkout === "success" ? (
          <p className="mx-auto mt-8 max-w-xl rounded-2xl border border-border bg-muted/50 px-4 py-3 text-center text-[13px] text-foreground/80">
            {t("checkoutSuccess")}
          </p>
        ) : null}
        {checkout === "cancel" ? (
          <p className="mx-auto mt-8 max-w-xl rounded-2xl border border-border bg-muted/30 px-4 py-3 text-center text-[13px] text-muted-foreground">
            {t("checkoutCancel")}
          </p>
        ) : null}
        {error ? (
          <p className="mx-auto mt-8 max-w-xl rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-center text-[13px] text-destructive">
            {error}
          </p>
        ) : null}

        <section className="mt-14 grid gap-5 lg:grid-cols-3">
          <article className="flex flex-col rounded-2xl border border-white/8 bg-card p-7">
            <h2 className="text-[15px] font-medium text-foreground">{t("freeName")}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{t("freeTagline")}</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-heading text-4xl font-semibold tracking-[-0.03em] text-foreground">
                $0
              </span>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">{t("freeQuota")}</p>

            <ul className="mt-8 flex flex-1 flex-col gap-3">
              <Feature>{t("freeFeat1")}</Feature>
              <Feature>{t("freeFeat2")}</Feature>
              <Feature>{t("freeFeat3")}</Feature>
              <Feature>{t("freeFeat4")}</Feature>
            </ul>

            <Link
              href="/dashboard"
              className="defi-button-outline mt-8 h-11 w-full text-[13px]"
            >
              {t("getStarted")}
            </Link>
          </article>

          <article className="relative flex flex-col rounded-2xl border border-white/20 bg-card p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold text-primary-foreground">
              {t("popular")}
            </div>
            <h2 className="text-[15px] font-medium text-foreground">{t("proName")}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{t("proTagline")}</p>

            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-heading text-4xl font-semibold tracking-[-0.03em] text-foreground">
                ${selectedTier?.priceUsd ?? "—"}
              </span>
              <span className="text-[14px] text-muted-foreground">{t("perMonth")}</span>
            </div>

            <label className="mt-5 block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">
                {t("monthlyCredits")}
              </span>
              <div className="relative">
                <select
                  value={selectedTier?.id ?? ""}
                  onChange={(e) => setSelectedTierId(e.target.value)}
                  className="h-10 w-full appearance-none rounded-xl border border-border bg-input px-3 pr-9 text-[13px] text-foreground outline-none focus:border-ring"
                >
                  {(catalog?.pro ?? []).map((tier) => (
                    <option key={tier.id} value={tier.id} disabled={!tier.available}>
                      {t("creditsPerMo", {
                        credits: tier.monthlyCredits,
                        price: tier.priceUsd,
                      })}
                      {!tier.available ? t("unavailable") : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
            </label>

            <ul className="mt-8 flex flex-1 flex-col gap-3">
              <Feature>
                {t("proFeat1", { credits: selectedTier?.monthlyCredits ?? "—" })}
              </Feature>
              <Feature>{t("proFeat2")}</Feature>
              <Feature>{t("proFeat3")}</Feature>
            </ul>

            <button
              type="button"
              disabled={!selectedTier?.available || busy !== null || isCurrentPro}
              onClick={() =>
                selectedTier &&
                startCheckout({ kind: "subscription", tierId: selectedTier.id })
              }
              className={cn(
                "defi-button mt-8 h-11 w-full gap-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-45"
              )}
            >
              {busy === selectedTier?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {isCurrentPro ? t("currentPlan") : t("getPro")}
            </button>
          </article>

          <article className="flex flex-col rounded-2xl border border-white/8 bg-card p-7">
            <h2 className="text-[15px] font-medium text-foreground">{t("enterpriseName")}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{t("enterpriseTagline")}</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-heading text-4xl font-semibold tracking-[-0.03em] text-foreground">
                {t("custom")}
              </span>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">{t("enterpriseQuota")}</p>

            <ul className="mt-8 flex flex-1 flex-col gap-3">
              <Feature>{t("entFeat1")}</Feature>
              <Feature>{t("entFeat2")}</Feature>
              <Feature>{t("entFeat3")}</Feature>
              <Feature>{t("entFeat4")}</Feature>
            </ul>

            <details className="group mt-8">
              <summary className="defi-button-outline h-11 w-full cursor-pointer list-none gap-2 text-[13px] [&::-webkit-details-marker]:hidden">
                <Mail className="h-3.5 w-3.5" aria-hidden />
                {t("contactUs")}
              </summary>
              <div className="mt-3 rounded-lg border border-border bg-muted/25 px-4 py-3 text-center">
                <a
                  href={`mailto:${ENTERPRISE_EMAIL}?subject=Open-OX%20Enterprise`}
                  className="text-[13px] font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {ENTERPRISE_EMAIL}
                </a>
              </div>
            </details>
          </article>
        </section>

        <section className="mx-auto mt-24 max-w-2xl">
          <h2 className="text-center text-[22px] font-medium tracking-[-0.02em] text-foreground">
            {t("faqTitle")}
          </h2>
          <div className="mt-8">
            {faq.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </section>

        {!catalog?.stripeConfigured ? (
          <p className="mx-auto mt-12 max-w-xl text-center text-[12px] text-amber-200/60">
            {t("stripeMissing")}
          </p>
        ) : null}
      </main>
    </div>
  );
}
