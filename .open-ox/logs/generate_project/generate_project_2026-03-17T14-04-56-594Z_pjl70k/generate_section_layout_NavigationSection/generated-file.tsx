"use client";

import React, { useState, useEffect } from "react";
import { Menu, X, Zap, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * NavigationSection Component
 *
 * A high-impact, cyberpunk-themed sticky navigation bar.
 * Features:
 * - Glitch-effect logo
 * - Glassmorphism background with scroll-aware opacity
 * - Responsive mobile menu with mechanical transitions
 * - Custom chamfered 'clip-cyber' CTA button
 * - Monospace technical labels
 */
export default function NavigationSection() {
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
    { name: "Intro", href: "#intro" },
    { name: "Highlights", href: "#highlights" },
    { name: "Schedule", href: "#schedule" },
  ];

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 border-b ${
        scrolled
          ? "bg-[#050505]/80 backdrop-blur-md border-[#FF00FF]/30 py-3"
          : "bg-transparent border-transparent py-6"
      }`}
    >
      {/* Scanline Overlay Effect (Subtle) */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_bottom,transparent_50%,#000_50%)] bg-[length:100%_4px]" />

      <nav className="container mx-auto px-4 md:px-6 flex items-center justify-between relative">
        {/* Brand/Logo */}
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="relative">
            <Zap className="w-8 h-8 text-[#FF00FF] fill-[#FF00FF] animate-[flicker_3s_infinite]" />
            <Zap className="w-8 h-8 text-[#00F3FF] absolute top-0 left-0 opacity-50 blur-[2px] group-hover:translate-x-1 transition-transform" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-2xl md:text-3xl italic font-black tracking-tighter text-[#E0E0E0] leading-none">
              CYBER<span className="text-[#FF00FF]">-</span>NIGHT
            </span>
            <span className="font-label text-[10px] tracking-[0.3em] text-[#88888F] leading-none uppercase">
              Halloween 2024
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <ul className="hidden lg:flex items-center gap-10">
          {navLinks.map((link) => (
            <li key={link.name}>
              <a
                href={link.href}
                className="font-label text-sm font-medium uppercase tracking-[0.2em] text-[#88888F] hover:text-[#00F3FF] transition-colors duration-200 flex items-center gap-1 group"
              >
                <span className="text-[#00F3FF] opacity-0 group-hover:opacity-100 transition-opacity -ml-4">
                  &gt;
                </span>
                {link.name}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop CTA */}
        <div className="hidden md:block">
          <button
            className="relative group overflow-hidden px-8 py-3 bg-[#FF00FF] text-[#050505] font-label text-sm font-bold uppercase tracking-widest transition-all duration-200 active:scale-95 [clip-path:polygon(0%_0%,100%_0%,100%_calc(100%-12px),calc(100%-12px)_100%,0%_100%)]"
            style={{ boxShadow: "var(--shadow-neon-magenta)" }}
          >
            <span className="relative z-10 flex items-center gap-2">
              Register Now
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
            {/* Hover Glitch Layer */}
            <div className="absolute inset-0 bg-[#00F3FF] translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)]" />
          </button>
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={toggleMenu}
          className="lg:hidden p-2 text-[#E0E0E0] hover:text-[#FF00FF] transition-colors"
          aria-label="Toggle Menu"
        >
          {isOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 top-[73px] bg-[#050505] z-40 lg:hidden overflow-hidden"
          >
            {/* Cyber Grid Background */}
            <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(0,243,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,243,255,0.05)_1px,transparent_1px)] bg-[length:40px_40px]" />

            <div className="relative z-10 p-8 flex flex-col h-full">
              <div className="flex flex-col gap-8">
                {navLinks.map((link, idx) => (
                  <motion.a
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * idx }}
                    className="font-header text-4xl uppercase tracking-widest text-[#E0E0E0] hover:text-[#FF00FF] border-b border-[#2A2A2F] pb-4 flex justify-between items-center group"
                  >
                    {link.name}
                    <ChevronRight className="w-8 h-8 text-[#FF00FF] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.a>
                ))}
              </div>

              <div className="mt-auto pb-12">
                <button
                  className="w-full py-6 bg-[#FF00FF] text-[#050505] font-label text-lg font-bold uppercase tracking-[0.2em] [clip-path:polygon(0%_0%,100%_0%,100%_calc(100%-20px),calc(100%-20px)_100%,0%_100%)] shadow-[0_0_20px_rgba(255,0,255,0.4)]"
                  onClick={() => setIsOpen(false)}
                >
                  SECURE ACCESS
                </button>
                <div className="mt-6 flex justify-between items-center text-[#88888F] font-label text-[10px] tracking-widest uppercase">
                  <span>SYSTEM STATUS: ONLINE</span>
                  <span className="text-[#BCFF00] animate-pulse">
                    ● ENCRYPTED
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @keyframes flicker {
          0%,
          19.999%,
          22%,
          62.999%,
          64%,
          64.999%,
          70%,
          100% {
            opacity: 1;
            filter: drop-shadow(0 0 5px rgba(255, 0, 255, 0.8));
          }
          20%,
          21.999%,
          63%,
          63.999%,
          65%,
          69.999% {
            opacity: 0.4;
            filter: none;
          }
        }

        :root {
          --shadow-neon-magenta:
            0 0 10px rgba(255, 0, 255, 0.5), 0 0 20px rgba(255, 0, 255, 0.2);
          --shadow-neon-cyan:
            0 0 10px rgba(0, 243, 255, 0.5), 0 0 20px rgba(0, 243, 255, 0.2);
        }
      `}</style>
    </header>
  );
}
