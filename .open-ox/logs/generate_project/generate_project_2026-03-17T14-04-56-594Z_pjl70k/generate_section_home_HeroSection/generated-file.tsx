"use client";

import React from "react";
import { motion } from "framer-motion";
import { Zap, Shield, Cpu, ChevronRight, Activity } from "lucide-react";

/**
 * HeroSection: The high-impact entry point for Cyber-Night Halloween 2024.
 * Features a centered layout with layered cyberpunk textures, glitch typography,
 * and high-contrast neon accents.
 */
export default function HeroSection() {
  return (
    <section className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#050505] py-24 px-6 md:px-12">
      {/* --- BACKGROUND LAYERS --- */}

      {/* Base Cyber-Grid */}
      <div className="absolute inset-0 bg-cyber-grid opacity-20 pointer-events-none" />

      {/* Scan-Line Overlay */}
      <div className="absolute inset-0 bg-scanlines opacity-30 pointer-events-none" />

      {/* Ambient Neon Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#FF00FF] rounded-full blur-[120px] opacity-10 animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[#00F3FF] rounded-full blur-[120px] opacity-10 animate-pulse" />

      {/* Decorative Vertical Data-Lines */}
      <div className="absolute left-8 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[#2A2A2F] to-transparent hidden lg:block" />
      <div className="absolute right-8 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[#2A2A2F] to-transparent hidden lg:block" />

      {/* --- CONTENT CONTAINER --- */}
      <div className="relative z-10 max-w-5xl w-full flex flex-col items-center text-center">
        {/* Eyebrow / Status Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
          className="mb-8 flex items-center gap-3 px-4 py-1.5 border border-[#BCFF00]/30 bg-[#BCFF00]/5 backdrop-blur-sm"
        >
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#BCFF00] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#BCFF00]"></span>
          </div>
          <span className="font-label text-[#BCFF00] text-[10px] md:text-xs tracking-[0.3em] uppercase">
            System Initializing // Oct 31 2024
          </span>
        </motion.div>

        {/* Main Headline */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.19, 1, 0.22, 1] }}
          className="relative mb-6"
        >
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl italic uppercase tracking-tighter text-[#E0E0E0] drop-shadow-[0_0_15px_rgba(255,0,255,0.3)]">
            Cyber-Halloween <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF00FF] via-[#00F3FF] to-[#BCFF00]">
              2024
            </span>
          </h1>
          {/* Glitch Effect Decorative Layer */}
          <div className="absolute -inset-1 opacity-20 blur-sm pointer-events-none select-none font-display text-5xl md:text-7xl lg:text-8xl italic uppercase tracking-tighter text-[#FF00FF] translate-x-1 translate-y-1 animate-pulse">
            Cyber-Halloween 2024
          </div>
        </motion.div>

        {/* Supporting Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.19, 1, 0.22, 1] }}
          className="font-body text-base md:text-xl text-[#88888F] max-w-2xl mb-12 leading-relaxed"
        >
          Enter the Matrix of the Dead. A high-frequency convergence of tech and
          terror. Upload your consciousness to the ultimate neon-drenched
          nightmare.
        </motion.p>

        {/* CTA Block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.19, 1, 0.22, 1] }}
          className="flex flex-col sm:flex-row items-center gap-6 mb-16"
        >
          {/* Primary CTA */}
          <button
            className="group relative px-10 py-4 bg-[#FF00FF] text-[#050505] font-label font-bold tracking-[0.2em] transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,0,255,0.6)] active:scale-95"
            style={{
              clipPath:
                "polygon(0% 0%, 100% 0%, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0% 100%)",
            }}
          >
            <span className="relative z-10 flex items-center gap-2">
              JOIN THE GRID <ChevronRight className="w-4 h-4" />
            </span>
            <div className="absolute inset-0 bg-white/20 translate-x-full group-hover:translate-x-0 transition-transform duration-300 skew-x-12" />
          </button>

          {/* Secondary CTA */}
          <button className="group relative px-10 py-4 border border-[#00F3FF] text-[#00F3FF] font-label tracking-[0.2em] transition-all duration-300 hover:bg-[#00F3FF] hover:text-[#050505] active:scale-95 overflow-hidden">
            <span className="relative z-10">VIEW PROTOCOLS</span>
            <div className="absolute inset-0 bg-[#00F3FF]/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </button>
        </motion.div>

        {/* Social Proof / Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-3xl border-t border-[#2A2A2F] pt-12"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-[#00F3FF]">
              <Activity className="w-4 h-4" />
              <span className="font-label text-sm tracking-widest">
                4,029 OPERATIVES
              </span>
            </div>
            <p className="text-[10px] font-label text-[#88888F] uppercase">
              Currently Synced
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-[#FF00FF]">
              <Cpu className="w-4 h-4" />
              <span className="font-label text-sm tracking-widest">
                12 NODE STAGES
              </span>
            </div>
            <p className="text-[10px] font-label text-[#88888F] uppercase">
              Physical Locations
            </p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-[#BCFF00]">
              <Shield className="w-4 h-4" />
              <span className="font-label text-sm tracking-widest">
                ENCRYPTED ENTRY
              </span>
            </div>
            <p className="text-[10px] font-label text-[#88888F] uppercase">
              Secure Access Only
            </p>
          </div>
        </motion.div>
      </div>

      {/* Decorative Corner Brackets */}
      <div className="absolute top-12 left-12 w-12 h-12 border-t-2 border-l-2 border-[#00F3FF]/30 pointer-events-none" />
      <div className="absolute bottom-12 right-12 w-12 h-12 border-b-2 border-r-2 border-[#FF00FF]/30 pointer-events-none" />

      {/* Scroll Indicator */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="font-label text-[8px] text-[#88888F] tracking-[0.4em] uppercase">
          Scroll to Initialize
        </span>
        <div className="w-[1px] h-12 bg-gradient-to-b from-[#00F3FF] to-transparent" />
      </motion.div>
    </section>
  );
}
/* 
  Note: Ensure the following are defined in your globals.css:
  - .bg-cyber-grid: CSS grid pattern
  - .bg-scanlines: CSS scanline gradient
  - font-display: Orbitron
  - font-header: Rajdhani
  - font-body: Inter
  - font-label: JetBrains Mono
*/
