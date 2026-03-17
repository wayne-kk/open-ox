"use client";

import React from "react";
import { motion } from "framer-motion";
import { Cpu, Activity, Terminal, Zap } from "lucide-react";

export default function IntroSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.19, 1, 0.22, 1],
      },
    },
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#050505] py-24 px-6">
      {/* Background Textures */}
      <div className="absolute inset-0 bg-cyber-grid opacity-20 pointer-events-none" />
      <div className="absolute inset-0 bg-scanlines opacity-10 pointer-events-none" />

      {/* Decorative Vertical Data-Lines */}
      <div className="absolute left-4 md:left-12 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#2A2A2F] to-transparent hidden lg:block">
        <div className="absolute top-1/4 -left-1 text-[10px] font-label text-[#88888F] vertical-rl tracking-widest uppercase">
          System.Log // 2024.10.31
        </div>
      </div>
      <div className="absolute right-4 md:right-12 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#2A2A2F] to-transparent hidden lg:block">
        <div className="absolute bottom-1/4 -right-1 text-[10px] font-label text-[#00F3FF] vertical-rl tracking-widest uppercase">
          Signal_Detected // Ghost_Protocol
        </div>
      </div>

      <motion.div
        className="relative z-10 max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
      >
        {/* Left Column: Thematic Accents */}
        <div className="hidden lg:flex lg:col-span-2 flex-col gap-8 items-center justify-center">
          <motion.div variants={itemVariants} className="text-[#FF00FF]">
            <Cpu size={32} strokeWidth={1.5} />
          </motion.div>
          <div className="h-24 w-px bg-[#2A2A2F]" />
          <motion.div variants={itemVariants} className="text-[#00F3FF]">
            <Activity size={32} strokeWidth={1.5} />
          </motion.div>
          <div className="h-24 w-px bg-[#2A2A2F]" />
          <motion.div variants={itemVariants} className="text-[#BCFF00]">
            <Zap size={32} strokeWidth={1.5} />
          </motion.div>
        </div>

        {/* Center Column: Narrative Content */}
        <div className="lg:col-span-8 flex flex-col">
          <motion.div
            variants={itemVariants}
            className="mb-6 flex items-center gap-4"
          >
            <span className="h-px w-12 bg-[#FF00FF]" />
            <span className="font-label text-xs md:text-sm text-[#FF00FF] tracking-[0.3em] uppercase">
              Establish Connection: Narrative_Stream
            </span>
          </motion.div>

          <motion.h2
            variants={itemVariants}
            className="font-display text-4xl md:text-6xl lg:text-7xl italic text-[#E0E0E0] mb-8 leading-none tracking-tighter"
          >
            THE{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF00FF] to-[#00F3FF]">
              GLITCH
            </span>{" "}
            IN THE AFTERLIFE
          </motion.h2>

          <motion.div
            variants={itemVariants}
            className="relative p-8 md:p-12 bg-[#0D0D0F] border border-[#2A2A2F] clip-cyber group"
          >
            {/* Top-left accent */}
            <div className="absolute top-0 left-0 w-16 h-1 bg-[#00F3FF]" />

            <div className="space-y-6">
              <p className="font-body text-lg md:text-xl text-[#E0E0E0] leading-relaxed">
                In the year 2024, the boundary between the biological and the
                digital has dissolved. We didn't just build a city; we built a
                neural network that remembers everyone who ever lived within its
                copper veins.
              </p>

              <p className="font-body text-base md:text-lg text-[#88888F] leading-relaxed">
                This Halloween, the mainframe is fracturing. A rhythmic pulse in
                the deep-grid is summoning the ghosts of the old world into the
                neon of the new. We call it{" "}
                <span className="text-[#00F3FF] font-label tracking-wider">
                  CYBER-NIGHT
                </span>
                .
              </p>

              <div className="pt-6 flex flex-wrap gap-6 items-center border-t border-[#2A2A2F]">
                <div className="flex flex-col">
                  <span className="font-label text-[10px] text-[#4A4A4F] mb-1">
                    LOCATION
                  </span>
                  <span className="font-header text-[#E0E0E0] tracking-widest uppercase">
                    Neo-Tokyo Sector 7
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-label text-[10px] text-[#4A4A4F] mb-1">
                    STATUS
                  </span>
                  <span className="font-header text-[#BCFF00] tracking-widest uppercase flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#BCFF00] animate-pulse" />
                    Online
                  </span>
                </div>
                <div className="flex flex-col ml-auto">
                  <Terminal
                    className="text-[#2A2A2F] group-hover:text-[#FF00FF] transition-colors duration-500"
                    size={20}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="mt-12 flex justify-between items-end"
          >
            <div className="max-w-xs">
              <p className="font-label text-xs text-[#4A4A4F] leading-tight uppercase tracking-widest">
                Warning: Prolonged exposure to the afterlife frequency may cause
                permanent neural rewiring. Proceed with caution.
              </p>
            </div>
            <div className="hidden md:block">
              <span className="font-label text-[10px] text-[#2A2A2F] tracking-[0.5em] uppercase">
                [ 001 // 101 // ERR ]
              </span>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Decorative Metadata */}
        <div className="hidden lg:col-span-2 lg:flex flex-col justify-end h-full pb-12">
          <motion.div variants={itemVariants} className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex items-center justify-end gap-2 opacity-30"
              >
                <div className={`h-1 w-${(i + 1) * 4} bg-[#2A2A2F]`} />
                <div className="w-1 h-1 rounded-full bg-[#00F3FF]" />
              </div>
            ))}
            <div className="pt-4 text-right">
              <span className="font-label text-[10px] text-[#88888F] uppercase tracking-tighter">
                Protocol: 0x88FF
              </span>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Background Glows */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-[#FF00FF] opacity-[0.03] blur-[120px] rounded-full" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-[#00F3FF] opacity-[0.03] blur-[100px] rounded-full" />
    </section>
  );
}
/* 
Note: Ensure the following utility classes are defined in globals.css as per the design system:
.bg-scanlines
.bg-cyber-grid
.clip-cyber
.font-display (Orbitron)
.font-header (Rajdhani)
.font-body (Inter)
.font-label (JetBrains Mono)
*/
