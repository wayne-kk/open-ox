"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Ticket, ChevronRight } from "lucide-react";

export default function GlobalNavSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Characters", href: "/characters" },
    { name: "Trailer", href: "#trailer" },
    { name: "Dossier", href: "/characters#dossier" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[50] transition-all duration-500 ${
        isScrolled
          ? "bg-[#050505]/90 backdrop-blur-xl border-b border-white/10 py-3"
          : "bg-transparent py-6"
      }`}
    >
      <nav className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        {/* Brand Mark */}
        <Link
          href="/"
          className="group relative flex items-center gap-2 transition-transform active:scale-95"
        >
          <div className="bg-[#ED1D24] px-2 py-1 transform -skew-x-12 border border-white/20 shadow-[var(--shadow-glow-red)]">
            <span className="font-display text-2xl md:text-3xl text-white uppercase tracking-tighter leading-none block skew-x-12">
              Marvel
            </span>
          </div>
          <span className="font-header text-lg md:text-xl text-white uppercase tracking-widest hidden sm:block">
            Studios
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="font-display text-lg text-mutedForeground hover:text-[#ED1D24] uppercase tracking-widest transition-colors duration-300 relative group"
            >
              {link.name}
              <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-[#ED1D24] transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Link
            href="/tickets"
            className="relative group hidden sm:flex items-center gap-2 bg-[#ED1D24] text-white font-display text-lg px-6 py-2 uppercase tracking-tighter border-b-4 border-red-800 hover:bg-red-500 hover:translate-y-[-2px] active:translate-y-[0px] transition-all duration-300 shadow-[var(--shadow-glow-red)]"
            style={{
              clipPath:
                "polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0% 30%)",
            }}
          >
            <Ticket className="w-4 h-4" />
            <span>Get Tickets</span>
          </Link>

          {/* Mobile Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 text-white hover:text-[#ED1D24] transition-colors"
            aria-label="Toggle Menu"
          >
            {isOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 z-[40] lg:hidden transition-all duration-500 ease-in-out ${
          isOpen
            ? "opacity-100 translate-x-0"
            : "opacity-0 translate-x-full pointer-events-none"
        }`}
      >
        {/* Background Textures */}
        <div className="absolute inset-0 bg-[#050505] overflow-hidden">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 0)",
              backgroundSize: "30px 30px",
            }}
          />
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              background:
                "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))",
              backgroundSize: "100% 2px, 3px 100%",
            }}
          />
        </div>

        <div className="relative h-full flex flex-col pt-32 px-8">
          <div className="space-y-6">
            {navLinks.map((link, idx) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className="group flex items-center justify-between border-b border-white/10 pb-4"
              >
                <span
                  className="font-display text-5xl text-white uppercase tracking-tighter group-hover:text-[#ED1D24] transition-colors"
                  style={{ transitionDelay: `${idx * 50}ms` }}
                >
                  {link.name}
                </span>
                <ChevronRight className="w-8 h-8 text-[#ED1D24] opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
              </Link>
            ))}
          </div>

          <div className="mt-auto mb-12 space-y-8">
            <div className="space-y-2">
              <p className="font-label text-xs text-[#00D4FF] tracking-[0.3em] uppercase">
                Status: Operational
              </p>
              <div className="h-1 w-full bg-white/5 overflow-hidden">
                <div className="h-full bg-[#00D4FF] w-1/3 animate-[scanline_2s_linear_infinite]" />
              </div>
            </div>

            <Link
              href="/tickets"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-4 bg-[#ED1D24] text-white font-display text-3xl py-6 uppercase tracking-tighter shadow-[var(--shadow-glow-red)]"
              style={{
                clipPath:
                  "polygon(5% 0, 100% 0, 100% 80%, 95% 100%, 0 100%, 0% 20%)",
              }}
            >
              <Ticket className="w-8 h-8" />
              Get Tickets Now
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
