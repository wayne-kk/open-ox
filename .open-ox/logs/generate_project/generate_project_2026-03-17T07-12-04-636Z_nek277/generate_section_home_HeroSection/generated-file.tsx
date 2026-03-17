"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skull, Zap, ChevronRight, Activity, Disc } from "lucide-react";

/**
 * HeroSection Component
 * Visual identity: Acid Halloween 2024
 * Features: Glitch typography, chrome effects, grainy textures, and high-energy motion.
 */
export default function HeroSection() {
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 150);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const octagonClip =
    "polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)";

  return (
    <section className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-[#050505] py-24 px-4 md:px-8">
      {/* Background Layers */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Grain Overlay */}
        <div className="absolute inset-0 bg-grain opacity-40 mix-blend-overlay" />

        {/* Scanlines Overlay */}
        <div className="absolute inset-0 bg-scanlines opacity-20" />

        {/* Dynamic Glows */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.15, 0.3, 0.15],
            x: [0, 50, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-[#CCFF00] rounded-full blur-[160px]"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.1, 0.2, 0.1],
            x: [0, -40, 0],
            y: [0, 60, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 -right-1/4 w-[500px] h-[500px] bg-[#BF00FF] rounded-full blur-[140px]"
        />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto w-full flex flex-col items-center text-center">
        {/* Eyebrow / Social Proof Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-wrap items-center justify-center gap-3"
        >
          <div className="flex items-center gap-2 px-3 py-1 bg-[#1A1A1A] border border-[#333333] text-[#CCFF00] font-label text-xs tracking-widest uppercase">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#CCFF00] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#CCFF00]"></span>
            </span>
            System Live
          </div>
          <div className="px-3 py-1 bg-[#1A1A1A] border border-[#333333] text-[#F5F5F5] font-label text-xs tracking-widest uppercase">
            12.4K Entities Connected
          </div>
        </motion.div>

        {/* Headline Stack */}
        <div className="relative mb-8 select-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
            className="relative"
          >
            <h1
              className={`font-display text-6xl sm:text-7xl md:text-[10rem] lg:text-[12rem] leading-none uppercase tracking-tighter transition-all duration-75 ${glitch ? "text-[#FF007F] translate-x-1" : "text-[#CCFF00]"}`}
              style={{
                textShadow: glitch ? "2px 0 #BF00FF, -2px 0 #CCFF00" : "none",
              }}
            >
              Acid
            </h1>
            <h1
              className={`font-header text-5xl sm:text-6xl md:text-8xl lg:text-9xl leading-[0.8] uppercase tracking-tight text-[#F5F5F5] -mt-2 md:-mt-8 transition-all duration-75 ${glitch ? "text-[#BF00FF] -translate-x-1" : ""}`}
            >
              Halloween
            </h1>
          </motion.div>

          {/* Floating Visual Asset (Chrome Skull) */}
          <motion.div
            animate={{
              y: [0, -20, 0],
              rotate: [-5, 5, -5],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-12 -right-8 md:-top-24 md:-right-24 z-20"
          >
            <div className="relative group">
              <div className="absolute inset-0 bg-[#CCFF00] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
              <Skull
                className="w-24 h-24 md:w-48 md:h-48 text-white mix-blend-difference drop-shadow-[0_0_15px_rgba(204,255,0,0.5)]"
                strokeWidth={1}
              />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Zap className="w-8 h-8 text-[#CCFF00] fill-[#CCFF00]" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="max-w-2xl font-body text-lg md:text-xl text-[#A1A1AA] leading-relaxed mb-12 px-4"
        >
          A multi-sensory descent into the digital afterlife. 48 hours of pure
          sonic chaos, warped reality, and neon-drenched nightmares. The void is
          calling your name.
        </motion.p>

        {/* CTA Block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-6 items-center justify-center w-full"
        >
          {/* Primary Button */}
          <button
            style={{ clipPath: octagonClip }}
            className="group relative px-10 py-5 bg-[#CCFF00] text-[#050505] font-label font-bold uppercase tracking-widest text-lg transition-all duration-200 active:scale-95 border-2 border-[#050505] hover:shadow-[6px_6px_0px_#BF00FF]"
          >
            <span className="flex items-center gap-2">
              Enter the Void{" "}
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          </button>

          {/* Secondary Button */}
          <button
            style={{ clipPath: octagonClip }}
            className="group px-10 py-5 bg-transparent text-[#CCFF00] font-label font-bold uppercase tracking-widest text-lg border-2 border-[#CCFF00] transition-all duration-200 hover:bg-[#CCFF00] hover:text-[#050505] active:scale-95"
          >
            View Lineup
          </button>
        </motion.div>

        {/* Metadata / Trust Row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8 w-full max-w-4xl border-t border-[#333333] pt-12"
        >
          <div className="flex flex-col items-center md:items-start">
            <span className="font-label text-[#A1A1AA] text-xs mb-1">DATE</span>
            <span className="font-header text-[#F5F5F5] text-lg">
              OCT 31 — NOV 02
            </span>
          </div>
          <div className="flex flex-col items-center md:items-start">
            <span className="font-label text-[#A1A1AA] text-xs mb-1">
              LOCATION
            </span>
            <span className="font-header text-[#F5F5F5] text-lg">
              VIRTUAL SECTOR 7
            </span>
          </div>
          <div className="flex flex-col items-center md:items-start">
            <span className="font-label text-[#A1A1AA] text-xs mb-1">
              ARTISTS
            </span>
            <span className="font-header text-[#F5F5F5] text-lg">
              40+ EXPERIMENTAL
            </span>
          </div>
          <div className="flex flex-col items-center md:items-start">
            <span className="font-label text-[#A1A1AA] text-xs mb-1">
              STATUS
            </span>
            <span className="font-header text-[#CCFF00] text-lg animate-pulse">
              TICKETS LOW
            </span>
          </div>
        </motion.div>
      </div>

      {/* Side Decorative Elements */}
      <div className="hidden lg:block absolute left-8 top-1/2 -translate-y-1/2 space-y-12">
        <div className="rotate-90 origin-left text-[#333333] font-label text-[10px] tracking-[1em] uppercase whitespace-nowrap">
          SYSTEM_OVERRIDE_INITIATED
        </div>
        <div className="flex flex-col gap-4 text-[#CCFF00]/30">
          <Activity className="w-4 h-4" />
          <Disc className="w-4 h-4 animate-spin-slow" />
          <Zap className="w-4 h-4" />
        </div>
      </div>

      <div className="hidden lg:block absolute right-8 top-1/2 -translate-y-1/2 space-y-12">
        <div className="-rotate-90 origin-right text-[#333333] font-label text-[10px] tracking-[1em] uppercase whitespace-nowrap">
          TERMINAL_VOID_CONNECTION
        </div>
        <div className="flex flex-col gap-4 text-[#BF00FF]/30">
          <div className="w-px h-24 bg-gradient-to-b from-transparent via-[#BF00FF] to-transparent" />
          <span className="font-label text-[10px] text-right">ERR_0404</span>
        </div>
      </div>

      {/* Bottom Marquee */}
      <div className="absolute bottom-0 w-full bg-[#CCFF00] py-2 overflow-hidden border-t-2 border-[#050505]">
        <div className="flex whitespace-nowrap animate-marquee">
          {[...Array(10)].map((_, i) => (
            <span
              key={i}
              className="font-label font-black text-[#050505] text-sm uppercase tracking-tighter mx-4"
            >
              Acid Halloween 2024 • Enter the Void • Limited Drop • October 31 •
              No Escape •
            </span>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </section>
  );
}
