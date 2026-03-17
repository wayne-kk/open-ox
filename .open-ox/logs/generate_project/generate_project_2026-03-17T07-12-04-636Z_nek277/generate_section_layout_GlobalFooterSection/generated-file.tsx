import React from "react";
import Link from "next/link";
import {
  Instagram,
  Twitter,
  Youtube,
  ArrowUpRight,
  Ghost,
  Skull,
  Zap,
  Github,
} from "lucide-react";

export default function GlobalFooterSection() {
  return (
    <footer className="relative w-full bg-[#050505] border-t-4 border-[#CCFF00] overflow-hidden">
      {/* Grain Overlay */}
      <div className="absolute inset-0 bg-grain opacity-20 pointer-events-none" />

      {/* Top Banner / Marquee Style Sign-off */}
      <div className="relative border-b border-[#333333] py-8 md:py-16 overflow-hidden">
        <div className="flex whitespace-nowrap animate-[marquee_20s_linear_infinite]">
          <span className="font-header text-6xl md:text-9xl text-[#CCFF00] uppercase tracking-tighter px-4">
            Stay Spooky — Acid Halloween — Stay Spooky — Acid Halloween — Stay
            Spooky — Acid Halloween —
          </span>
          <span className="font-header text-6xl md:text-9xl text-[#CCFF00] uppercase tracking-tighter px-4">
            Stay Spooky — Acid Halloween — Stay Spooky — Acid Halloween — Stay
            Spooky — Acid Halloween —
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-0">
        {/* Brand Column */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-[#CCFF00] flex items-center justify-center [clip-path:polygon(10%_0,100%_0,100%_90%,90%_100%,0_100%,0_10%)]">
                <Skull className="text-[#050505] w-7 h-7" />
              </div>
              <span className="font-header text-3xl text-[#F5F5F5] tracking-tighter">
                ACID<span className="text-[#FF007F]">HALLO</span>WEEN
              </span>
            </div>
            <p className="font-body text-[#A1A1AA] text-lg max-w-md leading-relaxed">
              The ultimate digital descent into the neon void. Join the
              collective for the 2024 flash experience. Limited access, infinite
              energy.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              href="https://instagram.com"
              className="group relative w-12 h-12 bg-[#1A1A1A] border border-[#333333] flex items-center justify-center transition-all duration-200 hover:border-[#CCFF00] hover:-translate-y-1 active:scale-95"
              aria-label="Instagram"
            >
              <Instagram className="w-5 h-5 text-[#F5F5F5] group-hover:text-[#CCFF00]" />
            </Link>
            <Link
              href="https://twitter.com"
              className="group relative w-12 h-12 bg-[#1A1A1A] border border-[#333333] flex items-center justify-center transition-all duration-200 hover:border-[#BF00FF] hover:-translate-y-1 active:scale-95"
              aria-label="Twitter"
            >
              <Twitter className="w-5 h-5 text-[#F5F5F5] group-hover:text-[#BF00FF]" />
            </Link>
            <Link
              href="https://youtube.com"
              className="group relative w-12 h-12 bg-[#1A1A1A] border border-[#333333] flex items-center justify-center transition-all duration-200 hover:border-[#FF007F] hover:-translate-y-1 active:scale-95"
              aria-label="Youtube"
            >
              <Youtube className="w-5 h-5 text-[#F5F5F5] group-hover:text-[#FF007F]" />
            </Link>
            <Link
              href="https://discord.com"
              className="group relative w-12 h-12 bg-[#1A1A1A] border border-[#333333] flex items-center justify-center transition-all duration-200 hover:border-[#CCFF00] hover:-translate-y-1 active:scale-95"
              aria-label="Discord"
            >
              <Zap className="w-5 h-5 text-[#F5F5F5] group-hover:text-[#CCFF00]" />
            </Link>
          </div>
        </div>

        {/* Navigation Grid */}
        <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-8">
          <div className="space-y-6">
            <h4 className="font-label text-xs tracking-[0.2em] text-[#A1A1AA] uppercase">
              Navigation
            </h4>
            <ul className="space-y-4">
              <li>
                <Link
                  href="/"
                  className="font-header text-xl text-[#F5F5F5] hover:text-[#CCFF00] flex items-center gap-2 transition-colors"
                >
                  HOME <ArrowUpRight className="w-4 h-4" />
                </Link>
              </li>
              <li>
                <Link
                  href="/success"
                  className="font-header text-xl text-[#F5F5F5] hover:text-[#BF00FF] flex items-center gap-2 transition-colors"
                >
                  ACCESS <ArrowUpRight className="w-4 h-4" />
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="font-header text-xl text-[#F5F5F5] hover:text-[#FF007F] flex items-center gap-2 transition-colors"
                >
                  TICKETS <ArrowUpRight className="w-4 h-4" />
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-6">
            <h4 className="font-label text-xs tracking-[0.2em] text-[#A1A1AA] uppercase">
              The Void
            </h4>
            <ul className="space-y-4">
              <li>
                <Link
                  href="#"
                  className="font-body text-[#F5F5F5] hover:text-[#CCFF00] transition-colors"
                >
                  Gallery
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="font-body text-[#F5F5F5] hover:text-[#CCFF00] transition-colors"
                >
                  Lineup
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="font-body text-[#F5F5F5] hover:text-[#CCFF00] transition-colors"
                >
                  Merchandise
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="font-body text-[#F5F5F5] hover:text-[#CCFF00] transition-colors"
                >
                  Safety Guide
                </Link>
              </li>
            </ul>
          </div>

          <div className="col-span-2 md:col-span-1 space-y-6">
            <h4 className="font-label text-xs tracking-[0.2em] text-[#A1A1AA] uppercase">
              Newsletter
            </h4>
            <div className="space-y-4">
              <p className="font-body text-sm text-[#A1A1AA]">
                Join the cult. Get updates before they vanish.
              </p>
              <div className="flex flex-col gap-2">
                <input
                  type="email"
                  placeholder="EMAIL@VOID.COM"
                  className="bg-[#111111] border border-[#333333] p-3 font-label text-sm text-[#F5F5F5] focus:outline-none focus:border-[#CCFF00] transition-colors"
                />
                <button className="w-full py-3 bg-[#CCFF00] text-[#050505] font-label font-bold text-sm uppercase hover:shadow-[6px_6px_0px_#BF00FF] transition-all duration-200 active:scale-95">
                  SUBSCRIBE
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-[#333333] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
            <span className="font-label text-xs text-[#A1A1AA]">
              © 2024 ACID HALLOWEEN PROJECT
            </span>
            <div className="flex gap-6">
              <Link
                href="#"
                className="font-label text-[10px] text-[#A1A1AA] hover:text-[#F5F5F5] uppercase tracking-widest"
              >
                Privacy Policy
              </Link>
              <Link
                href="#"
                className="font-label text-[10px] text-[#A1A1AA] hover:text-[#F5F5F5] uppercase tracking-widest"
              >
                Terms of Service
              </Link>
              <Link
                href="#"
                className="font-label text-[10px] text-[#A1A1AA] hover:text-[#F5F5F5] uppercase tracking-widest"
              >
                Cookie Settings
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2 font-label text-[10px] text-[#A1A1AA] uppercase tracking-widest">
            <span className="w-2 h-2 bg-[#CCFF00] rounded-full animate-pulse" />
            SYSTEM STATUS: OPERATIONAL
          </div>
        </div>
      </div>

      {/* Decorative Scanlines Overlay */}
      <div className="absolute inset-0 bg-scanlines opacity-[0.03] pointer-events-none" />

      {/* Brutalist Corner Element */}
      <div className="absolute bottom-0 right-0 w-32 h-32 overflow-hidden pointer-events-none hidden md:block">
        <div className="absolute bottom-0 right-0 w-[200%] h-[200%] border-t-[40px] border-l-[40px] border-[#1A1A1A] rotate-45 translate-x-1/2 translate-y-1/2 opacity-20" />
      </div>
    </footer>
  );
}
