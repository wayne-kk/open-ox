"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "/projects", label: "项目" },
  { href: "/docs", label: "文档" },
  { href: "/llm-test", label: "LLM 测试" },
  { href: "/changelog", label: "更新日志" },
];

export function Navigation() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
          ? "border-b border-white/8 bg-background/85 backdrop-blur-2xl"
          : "bg-transparent"
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
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-4 py-2 text-[13px] font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {label}
                  {active && (
                    <span className="absolute inset-x-4 bottom-0 h-px bg-primary/70 rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
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
          <nav className="absolute left-0 right-0 top-[56px] border-b border-white/8 bg-background px-6 py-5 space-y-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`block rounded-lg px-4 py-3 text-[15px] font-medium transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
