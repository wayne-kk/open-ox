"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  getUserAccountSubtitle,
  getUserDisplayName,
  useAuthUser,
  UserAvatarButton,
  UserMenuDropdown,
} from "./AuthHeaderActions";

const NAV_LINKS = [
  { href: "/projects", label: "项目" },
  { href: "/trajectories", label: "Trajectories" },
  { href: "/docs", label: "文档" },
  { href: "/llm-test", label: "LLM 测试" },
  { href: "/test-image", label: "图片测试" },
  { href: "/changelog", label: "更新日志" },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready } = useAuthUser();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const isHome = pathname === "/";

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const signOutMobile = async () => {
    setOpen(false);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/");
  };

  return (
    <>
      <header
        className={`${isHome ? "fixed left-0 right-0 top-0" : "sticky top-0"} z-50 transition-[background-color,backdrop-filter,border-color] duration-300 ${scrolled || !isHome
          ? "border-b border-white/8 bg-background/85 backdrop-blur-2xl"
          : "border-b border-transparent bg-transparent"
          }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-md border border-primary/50 bg-primary/10 transition-colors group-hover:bg-primary/20">
              <span className="font-mono text-[10px] font-bold text-primary">OX</span>
            </div>
            <span className="font-mono text-[13px] font-bold tracking-[0.18em] text-foreground">OPEN-OX</span>
          </Link>

          {/* Desktop nav — center */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-4 py-2 text-[13px] font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {label}
                  {active && (
                    <span className="absolute inset-x-4 bottom-0 h-px rounded-full bg-primary/70" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {!ready ? (
              <div className="hidden h-8 w-24 animate-pulse rounded-md bg-white/5 md:block" />
            ) : user ? (
              <div className="hidden md:block">
                <UserMenuDropdown user={user} afterSignOut="home" />
              </div>
            ) : (
              <Link
                href="/auth"
                className="hidden rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 md:inline-flex"
              >
                登录
              </Link>
            )}
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground md:hidden"
              aria-label="Toggle menu"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-background/95 backdrop-blur-xl" />
          <nav
            className="absolute left-0 right-0 top-[56px] border-b border-white/8 bg-background px-6 py-5 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-lg px-4 py-3 text-[15px] font-medium transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    }`}
                >
                  {label}
                </Link>
              );
            })}
            {!ready ? (
              <div className="mt-2 h-12 animate-pulse rounded-lg bg-white/5" />
            ) : user ? (
              <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.05] via-transparent to-primary/[0.04] p-4">
                <div className="flex items-start gap-3">
                  <UserAvatarButton user={user} className="h-10 w-10 shrink-0 ring-2 ring-primary/25" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold leading-snug text-foreground">
                      {getUserDisplayName(user)}
                    </p>
                    {(() => {
                      const sub = getUserAccountSubtitle(user);
                      return sub ? (
                        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                          {sub}
                        </p>
                      ) : null;
                    })()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void signOutMobile()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.08] py-2.5 text-[13px] font-medium text-red-300/95 transition hover:bg-red-500/[0.14]"
                >
                  <LogOut className="h-4 w-4" />
                  退出登录
                </button>
              </div>
            ) : (
              <Link
                href="/auth"
                onClick={() => setOpen(false)}
                className="mt-2 block rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-[15px] font-medium text-primary transition-colors hover:bg-primary/20"
              >
                登录
              </Link>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
