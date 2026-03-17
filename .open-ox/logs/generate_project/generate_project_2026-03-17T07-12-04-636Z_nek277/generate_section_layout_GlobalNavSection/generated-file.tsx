"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Zap } from "lucide-react";

/**
 * GlobalNavSection
 * A high-impact, sticky navigation component for the Acid Halloween 2024 experience.
 * Features: Liquid metal logo simulation, neon CTA, and glitch-ready interactions.
 */
export default function GlobalNavSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll state for background styling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Lineup", href: "#lineup" },
    { name: "Location", href: "#location" },
    { name: "Tickets", href: "#tickets" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 w-full z-[100] transition-all duration-300 ${
        scrolled
          ? "py-3 bg-[#050505]/90 backdrop-blur-md border-b border-[#333333]"
          : "py-6 bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        {/* Brand / Liquid Metal Logo */}
        <Link href="/" className="group relative flex items-center gap-2">
          <div className="relative">
            <Zap className="w-8 h-8 text-[#CCFF00] fill-[#CCFF00] group-hover:animate-pulse" />
            <div className="absolute inset-0 bg-[#CCFF00] blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
          </div>
          <span className="font-display text-2xl md:text-3xl font-extrabold tracking-tighter uppercase italic bg-clip-text text-transparent bg-gradient-to-b from-[#e0e0e0] via-[#ffffff] to-[#7a7a7a] drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
            Acid
            <span className="text-[#CCFF00] drop-shadow-[0_0_8px_#CCFF00]">
              24
            </span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-12">
          <ul className="flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link.name}>
                <Link
                  href={link.href}
                  className="font-label text-xs tracking-[0.2em] uppercase text-[#A1A1AA] hover:text-[#CCFF00] transition-colors relative group"
                >
                  {link.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-[#CCFF00] transition-all duration-300 group-hover:w-full" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Primary CTA - Octagon Cut */}
          <Link href="/#tickets">
            <button
              className="relative font-label text-sm font-bold uppercase tracking-widest px-8 py-3 bg-[#CCFF00] text-[#050505] transition-all duration-200 active:scale-95 hover:shadow-[6px_6px_0px_#BF00FF]"
              style={{
                clipPath:
                  "polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)",
              }}
            >
              Buy Tickets
            </button>
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          className="md:hidden p-2 text-[#CCFF00]"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle Menu"
        >
          {isOpen ? <X size={32} /> : <Menu size={32} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[90] bg-[#050505] flex flex-col p-8 pt-32"
          >
            {/* Grain Overlay for Mobile Menu */}
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-150 brightness-100" />

            <div className="flex flex-col gap-8 relative z-10">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.name}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className="font-header text-5xl uppercase tracking-tighter text-[#F5F5F5] hover:text-[#CCFF00] flex items-baseline gap-4 group"
                  >
                    <span className="font-label text-sm text-[#CCFF00] opacity-50">
                      0{i + 1}
                    </span>
                    {link.name}
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="mt-auto relative z-10">
              <Link href="/#tickets" onClick={() => setIsOpen(false)}>
                <button
                  className="w-full font-header text-2xl uppercase py-6 bg-[#CCFF00] text-[#050505] transition-all active:scale-[0.98]"
                  style={{
                    clipPath:
                      "polygon(5% 0, 100% 0, 100% 80%, 95% 100%, 0 100%, 0 20%)",
                  }}
                >
                  Get Access Now
                </button>
              </Link>

              <div className="mt-8 flex justify-between items-center border-t border-[#333333] pt-6">
                <span className="font-label text-[10px] tracking-widest text-[#A1A1AA] uppercase">
                  October 31 // 2024
                </span>
                <div className="flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-[#FF007F] animate-ping" />
                  <span className="font-label text-[10px] tracking-widest text-[#FF007F] uppercase">
                    Live Status
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subtle Scanline Overlay on Nav for Texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
    </nav>
  );
}
