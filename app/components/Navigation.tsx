"use client";

import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuthUser } from "./AuthHeaderActions";
import { BrandMark } from "@/app/components/BrandMark";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Link, usePathname } from "@/i18n/navigation";

export function Navigation() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { user, ready } = useAuthUser();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const isMarketingHome = pathname === "/" || pathname === "/home";

  const navLinks = [
    { href: "/pricing", label: t("pricing") },
    { href: "/community", label: t("community") },
    { href: "/docs", label: t("docs") },
    { href: "/changelog", label: t("changelog") },
  ] as const;

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const brandHref = user ? "/home" : "/";

  return (
    <>
      <header
        className={`${isMarketingHome ? "fixed left-0 right-0 top-0" : "sticky top-0"} z-50 transition-[background-color,backdrop-filter,border-color] duration-300 ${
          scrolled || !isMarketingHome
            ? "border-b border-border/80 bg-background/85 backdrop-blur-2xl"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="container mx-auto flex items-center justify-between px-6 py-4 lg:px-8">
          <Link href={brandHref} className="group flex items-center gap-2.5">
            <BrandMark size={26} />
            <span className="font-heading text-[14px] font-semibold tracking-[-0.02em] text-foreground">
              OPEN-OX
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {navLinks.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-3.5 py-2 text-[13px] font-medium transition-colors after:absolute after:inset-x-3.5 after:bottom-0.5 after:h-px after:origin-left after:bg-primary after:transition-transform after:duration-300 after:ease-out after:content-[''] ${
                    active
                      ? "text-foreground after:scale-x-100"
                      : "text-muted-foreground after:scale-x-0 hover:text-foreground hover:after:scale-x-100"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle compact className="hidden sm:inline-flex" />
            <LocaleSwitcher compact className="hidden sm:inline-flex" />
            {!ready ? (
              <div className="hidden h-8 w-24 animate-pulse rounded-full bg-muted md:block" />
            ) : user ? (
              <Link
                href="/dashboard"
                className="defi-button hidden h-8 px-4 text-[12px] md:inline-flex"
              >
                {t("enterWorkspace")}
              </Link>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Link
                  href="/auth"
                  className="px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("signIn")}
                </Link>
                <Link href="/auth?mode=register" className="defi-button h-8 px-4 text-[12px]">
                  {t("signUp")}
                </Link>
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground md:hidden"
              aria-label={t("toggleMenu")}
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-background/95 backdrop-blur-xl" />
          <nav
            className="absolute left-0 right-0 top-[56px] space-y-1 border-b border-border bg-background px-6 py-5"
            onClick={(e) => e.stopPropagation()}
          >
            {navLinks.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-xl px-4 py-3 text-[15px] font-medium transition-colors ${
                    active ? "bg-muted text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <div className="flex items-center gap-2 px-2 pt-2">
              <ThemeToggle compact />
              <LocaleSwitcher compact />
            </div>
            {!ready ? (
              <div className="mt-2 h-12 animate-pulse rounded-xl bg-muted" />
            ) : user ? (
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="defi-button mt-4 w-full py-2.5 text-[13px]"
              >
                {t("enterWorkspace")}
              </Link>
            ) : (
              <div className="mt-4 space-y-2">
                <Link
                  href="/auth"
                  onClick={() => setOpen(false)}
                  className="defi-button-outline w-full py-2.5 text-[13px]"
                >
                  {t("signIn")}
                </Link>
                <Link
                  href="/auth?mode=register"
                  onClick={() => setOpen(false)}
                  className="defi-button w-full py-2.5 text-[13px]"
                >
                  {t("signUp")}
                </Link>
              </div>
            )}
          </nav>
        </div>
      ) : null}
    </>
  );
}
