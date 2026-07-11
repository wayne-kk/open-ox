"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { useAuthUser } from "./AuthHeaderActions";
import { BrandMark } from "@/app/components/BrandMark";

const NAV_LINKS = [
  { href: "/pricing", label: "定价" },
  { href: "/community", label: "社区" },
  { href: "/docs", label: "文档" },
  { href: "/changelog", label: "更新日志" },
];

export function Navigation() {
  const pathname = usePathname();
  const { user, ready } = useAuthUser();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const isMarketingHome = pathname === "/" || pathname === "/home";

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
            ? "border-b border-white/8 bg-background/85 backdrop-blur-2xl"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="container mx-auto flex items-center justify-between px-6 py-4 lg:px-8">
          <Link href={brandHref} className="group flex items-center gap-2.5">
            <BrandMark size={28} />
            <span className="font-heading text-[13px] font-bold tracking-[0.18em] text-foreground">
              OPEN-OX
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-4 py-2 text-[13px] font-medium transition-colors ${
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                  {active ? (
                    <span className="absolute inset-x-4 bottom-0 h-px rounded-full bg-primary/70" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {!ready ? (
              <div className="hidden h-8 w-24 animate-pulse rounded-md bg-white/5 md:block" />
            ) : user ? (
              <Link
                href="/dashboard"
                className="defi-button hidden px-3 py-1.5 text-xs md:inline-flex"
              >
                进入工作台
              </Link>
            ) : (
              <div className="hidden items-center gap-2 md:flex">
                <Link
                  href="/auth"
                  className="px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  登录
                </Link>
                <Link href="/auth?mode=register" className="defi-button px-3 py-1.5 text-xs">
                  注册
                </Link>
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground md:hidden"
              aria-label="Toggle menu"
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
            className="absolute left-0 right-0 top-[56px] space-y-1 border-b border-white/8 bg-background px-6 py-5"
            onClick={(e) => e.stopPropagation()}
          >
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-lg px-4 py-3 text-[15px] font-medium transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            {!ready ? (
              <div className="mt-2 h-12 animate-pulse rounded-lg bg-white/5" />
            ) : user ? (
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="mt-4 flex w-full items-center justify-center rounded-lg border border-primary/40 bg-primary/10 py-2.5 text-[13px] font-medium text-primary transition hover:bg-primary/20"
              >
                进入工作台
              </Link>
            ) : (
              <div className="mt-4 space-y-2">
                <Link
                  href="/auth"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center justify-center rounded-lg border border-white/15 py-2.5 text-[13px] font-medium text-foreground transition hover:bg-white/5"
                >
                  登录
                </Link>
                <Link
                  href="/auth?mode=register"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center justify-center rounded-lg border border-primary/40 bg-primary/10 py-2.5 text-[13px] font-medium text-primary transition hover:bg-primary/20"
                >
                  注册
                </Link>
              </div>
            )}
          </nav>
        </div>
      ) : null}
    </>
  );
}
