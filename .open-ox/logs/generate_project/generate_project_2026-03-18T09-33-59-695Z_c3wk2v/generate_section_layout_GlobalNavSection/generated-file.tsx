"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Sparkles } from "lucide-react";

/**
 * GlobalNavSection
 * A responsive, ethereal navigation component designed with a Ghibli-inspired aesthetic.
 * Features: Sticky scroll behavior, glassmorphism, organic shapes, and a magical glow CTA.
 */
export default function GlobalNavSection() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Handle scroll state for visual transitions
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "The World", href: "/the-world" },
    { name: "Story", href: "/#story" },
    { name: "Characters", href: "/#characters" },
    { name: "Gallery", href: "/#gallery" },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-700 ease-in-out px-4 md:px-8 py-4 ${
          isScrolled ? "pt-4" : "pt-6 md:pt-8"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Brand / Logo */}
          <Link
            href="/"
            className="relative z-[110] group flex items-center gap-2 focus:outline-none"
          >
            <span className="font-display italic text-2xl md:text-3xl text-foreground tracking-tight transition-transform duration-500 group-hover:scale-105">
              Studio<span className="text-accent">Ethereal</span>
            </span>
          </Link>

          {/* Desktop Navigation Bar */}
          <div
            className={`hidden md:flex items-center gap-8 px-8 py-2.5 rounded-full border transition-all duration-700 ${
              isScrolled
                ? "bg-card/80 backdrop-blur-lg border-border shadow-paper translate-y-0"
                : "bg-transparent border-transparent translate-y-[-4px]"
            }`}
          >
            <ul className="flex items-center gap-8">
              {navLinks.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="font-label text-[11px] tracking-[0.25em] uppercase text-mutedForeground hover:text-accent transition-colors duration-300"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Right Side Actions (CTA & Mobile Toggle) */}
          <div className="flex items-center gap-4 relative z-[110]">
            <Link
              href="/#tickets"
              className="relative hidden sm:flex items-center gap-2 bg-accent text-background px-6 py-2.5 rounded-full font-label text-xs tracking-widest uppercase transition-all duration-500 hover:bg-[#3E674A] hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(125,185,182,0.4)] group overflow-hidden"
            >
              <span className="relative z-10">Get Tickets</span>
              <Sparkles className="w-3.5 h-3.5 relative z-10 transition-transform duration-500 group-hover:rotate-12" />
              {/* Subtle magical glow layer */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </Link>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2.5 rounded-full bg-card/50 backdrop-blur-sm border border-border text-foreground md:hidden hover:bg-muted transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              className="absolute top-0 left-0 w-full h-screen bg-background/98 backdrop-blur-xl z-[105] flex flex-col items-center justify-center p-8 md:hidden"
            >
              {/* Decorative background element */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accentSecondary/10 rounded-full blur-3xl pointer-events-none" />

              <ul className="flex flex-col items-center gap-8 relative z-10">
                {navLinks.map((link, i) => (
                  <motion.li
                    key={link.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="font-header text-3xl text-foreground hover:text-accentSecondary transition-colors italic"
                    >
                      {link.name}
                    </Link>
                  </motion.li>
                ))}
                <motion.li
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-4"
                >
                  <Link
                    href="/#tickets"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 bg-accentTertiary text-background px-8 py-4 rounded-full font-label text-sm tracking-widest uppercase shadow-lg"
                  >
                    Book Your Journey
                  </Link>
                </motion.li>
              </ul>

              {/* Mobile Footer Info */}
              <div className="absolute bottom-12 text-center">
                <p className="font-label text-[10px] tracking-widest text-mutedForeground uppercase">
                  Now Playing in Select Theaters
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Global Paper Grain Overlay (Visual consistency) */}
      <div className="fixed inset-0 pointer-events-none z-[200] opacity-[0.03] mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]" />
    </>
  );
}
