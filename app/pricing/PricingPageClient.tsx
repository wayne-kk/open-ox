"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  topups: Array<{
    id: string;
    name: string;
    credits: number;
    priceUsd: number;
    available: boolean;
  }>;
};

type CreditsSnap = {
  enabled: boolean;
  balance: number | null;
  plan?: string;
  proTier?: string | null;
};

const FAQ: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "What is a credit?",
    a: (
      <>
        Credits measure AI build usage — generate and modify runs. Cost scales with how much work
        the model does (tokens), then converts to credits. Design Mode edits that write source
        locally without an LLM do not spend credits.
      </>
    ),
  },
  {
    q: "What is included in Free?",
    a: (
      <>
        Free includes 5 credits per day, capped at 30 per calendar month. Unused daily credits do
        not roll to the next day. Enough to try generate and a few modify turns.
      </>
    ),
  },
  {
    q: "How does Pro pricing work?",
    a: (
      <>
        Pro is priced by monthly credit capacity (100 / 200 / 400). You pick the pool size that
        matches how much you build. Credits are added to your balance each billing cycle and can be
        topped up anytime.
      </>
    ),
  },
  {
    q: "Do credits expire?",
    a: (
      <>
        Free daily grants expire at the end of each UTC day. Pro monthly credits stay on your
        balance while your subscription is active. Top-up credits are added immediately and remain
        until spent.
      </>
    ),
  },
  {
    q: "What happens if I cancel Pro?",
    a: (
      <>
        You keep any remaining balance. After cancel, your account returns to Free daily grants.
        Remaining Pro/top-up credits are not wiped by the next daily grant if your balance is
        already higher than the daily amount.
      </>
    ),
  },
  {
    q: "Can I buy more credits without upgrading?",
    a: (
      <>
        Yes. Top-up packs are one-time purchases available on Free and Pro. They add credits to the
        same balance used for generate and modify.
      </>
    ),
  },
];

function FaqItem({ q, a }: { q: string; a: React.ReactNode }) {
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
  const search = useSearchParams();
  const checkout = search.get("checkout");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [credits, setCredits] = useState<CreditsSnap | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTierId, setSelectedTierId] = useState<string>("pro_200");

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
    async (body: { kind: "subscription"; tierId: string } | { kind: "topup"; packId: string }) => {
      setError(null);
      setBusy(body.kind === "subscription" ? body.tierId : body.packId);
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
            Pricing
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground md:text-[17px]">
            Start for free. Upgrade to get the capacity that matches how much you build.
          </p>
          {credits?.plan === "pro" ? (
            <button
              type="button"
              onClick={() => void openPortal()}
              disabled={busy !== null}
              className="mt-4 text-[13px] text-brand-signal hover:underline disabled:opacity-50"
            >
              {busy === "portal" ? "Opening…" : "Manage subscription"}
            </button>
          ) : null}
        </div>

        {checkout === "success" ? (
          <p className="mx-auto mt-8 max-w-xl rounded-2xl border border-white/12 bg-white/4 px-4 py-3 text-center text-[13px] text-foreground/80">
            Payment received. Credits usually appear within a few seconds — refresh if the balance
            looks stale.
          </p>
        ) : null}
        {checkout === "cancel" ? (
          <p className="mx-auto mt-8 max-w-xl rounded-2xl border border-white/8 bg-white/2 px-4 py-3 text-center text-[13px] text-muted-foreground">
            Checkout canceled. No charge was made.
          </p>
        ) : null}
        {error ? (
          <p className="mx-auto mt-8 max-w-xl rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-center text-[13px] text-red-200">
            {error}
          </p>
        ) : null}

        <section className="mt-14 grid gap-5 lg:grid-cols-3">
          <article className="flex flex-col rounded-2xl border border-white/8 bg-card p-7">
            <h2 className="text-[15px] font-medium text-foreground">Free</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Try Open-OX</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-heading text-4xl font-semibold tracking-[-0.03em] text-foreground">
                $0
              </span>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">5 credits / day · 30 / month max</p>

            <ul className="mt-8 flex flex-1 flex-col gap-3">
              <Feature>Generate & modify with daily credits</Feature>
              <Feature>Design Mode local edits free</Feature>
              <Feature>Workspace projects & Studio</Feature>
              <Feature>Community publish & remix</Feature>
            </ul>

            <Link
              href="/dashboard"
              className="defi-button-outline mt-8 h-11 w-full text-[13px]"
            >
              Get started
            </Link>
          </article>

          <article className="relative flex flex-col rounded-2xl border border-white/20 bg-card p-7 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold text-primary-foreground">
              Popular
            </div>
            <h2 className="text-[15px] font-medium text-foreground">Pro</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">For builders who ship often</p>

            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-heading text-4xl font-semibold tracking-[-0.03em] text-foreground">
                ${selectedTier?.priceUsd ?? "—"}
              </span>
              <span className="text-[14px] text-muted-foreground">/ month</span>
            </div>

            <label className="mt-5 block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">Monthly credits</span>
              <div className="relative">
                <select
                  value={selectedTier?.id ?? ""}
                  onChange={(e) => setSelectedTierId(e.target.value)}
                  className="h-10 w-full appearance-none rounded-xl border border-white/12 bg-[#161618] px-3 pr-9 text-[13px] text-foreground outline-none focus:border-white/25"
                >
                  {(catalog?.pro ?? []).map((tier) => (
                    <option key={tier.id} value={tier.id} disabled={!tier.available}>
                      {tier.monthlyCredits} credits — ${tier.priceUsd}/mo
                      {!tier.available ? " (unavailable)" : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
            </label>

            <ul className="mt-8 flex flex-1 flex-col gap-3">
              <Feature>
                {selectedTier?.monthlyCredits ?? "—"} credits each billing cycle
              </Feature>
              <Feature>No daily wipe on your Pro pool</Feature>
              <Feature>Top-up packs anytime</Feature>
              <Feature>Everything in Free</Feature>
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
              {isCurrentPro ? "Current plan" : "Get Pro"}
            </button>
          </article>

          <article className="flex flex-col rounded-2xl border border-white/8 bg-card p-7">
            <h2 className="text-[15px] font-medium text-foreground">Enterprise</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Volume & governance</p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="font-heading text-4xl font-semibold tracking-[-0.03em] text-foreground">
                Custom
              </span>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">Invoicing · SSO · volume credits</p>

            <ul className="mt-8 flex flex-1 flex-col gap-3">
              <Feature>Custom credit volume</Feature>
              <Feature>Centralized billing</Feature>
              <Feature>Priority support</Feature>
              <Feature>Security & compliance review</Feature>
            </ul>

            <a
              href="mailto:hello@open-ox.dev?subject=Open-OX%20Enterprise"
              className="defi-button-outline mt-8 h-11 w-full text-[13px]"
            >
              Contact us
            </a>
          </article>
        </section>

        <section className="mt-20">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-[22px] font-medium tracking-[-0.02em] text-foreground">
              Need more credits?
            </h2>
            <p className="mt-2 text-[14px] text-muted-foreground">
              One-time top-ups. Available on Free and Pro — added to the same balance.
            </p>
          </div>
          <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
            {(catalog?.topups ?? []).map((pack) => (
              <div
                key={pack.id}
                className="flex flex-col items-center rounded-2xl border border-white/8 bg-card px-4 py-5 text-center"
              >
                <p className="text-[15px] font-medium text-foreground">{pack.credits} credits</p>
                <p className="mt-1 text-[13px] text-muted-foreground">${pack.priceUsd}</p>
                <button
                  type="button"
                  disabled={!pack.available || busy !== null}
                  onClick={() => startCheckout({ kind: "topup", packId: pack.id })}
                  className="mt-4 text-[13px] font-medium text-brand-signal hover:underline disabled:opacity-40"
                >
                  {busy === pack.id ? "…" : "Buy"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-24 max-w-2xl">
          <h2 className="text-center text-[22px] font-medium tracking-[-0.02em] text-foreground">
            Frequently asked questions
          </h2>
          <div className="mt-8">
            {FAQ.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </section>

        {!catalog?.stripeConfigured ? (
          <p className="mx-auto mt-12 max-w-xl text-center text-[12px] text-amber-200/60">
            Stripe is not configured in this environment. Checkout buttons stay disabled until price
            IDs are set.
          </p>
        ) : null}
      </main>
    </div>
  );
}
