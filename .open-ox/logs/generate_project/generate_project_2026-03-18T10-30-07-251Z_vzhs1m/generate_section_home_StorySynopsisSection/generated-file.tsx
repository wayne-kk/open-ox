"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Shield, Zap, Target } from "lucide-react";

export default function StorySynopsisSection() {
  return (
    <section className="relative min-h-screen w-full bg-[#050505] overflow-hidden py-24 md:py-32 flex items-center">
      {/* Background Textures */}
      <div
        className="absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.1) 1px, transparent 0)`,
          backgroundSize: "30px 30px",
        }}
      />

      {/* Decorative Cinematic Slash */}
      <div className="absolute -right-20 top-0 w-1/2 h-full bg-gradient-to-l from-[#ED1D24]/10 to-transparent skew-x-[-15deg] z-0" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-12 gap-8 items-center">
          {/* Text Content - Left Side */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
            viewport={{ once: true }}
            className="col-span-12 lg:col-span-7 order-2 lg:order-1"
          >
            <div className="flex flex-col space-y-6">
              {/* Eyebrow / Release Info */}
              <div className="flex items-center space-x-4">
                <span className="h-[2px] w-12 bg-[#ED1D24]" />
                <p className="font-label text-[#ED1D24] text-sm md:text-base tracking-[0.3em] font-bold">
                  ONLY IN THEATERS // NOVEMBER 24
                </p>
              </div>

              {/* Main Headline */}
              <h2 className="font-display text-6xl md:text-8xl text-white uppercase leading-none tracking-tighter">
                UNITE{" "}
                <span
                  className="text-transparent stroke-white stroke-2"
                  style={{ WebkitTextStroke: "1px white" }}
                >
                  OR
                </span>{" "}
                <br />
                <span className="text-[#ED1D24] drop-shadow-[2px_2px_0px_rgba(255,255,255,1)]">
                  FALL
                </span>
              </h2>

              {/* Synopsis Card */}
              <div className="bg-[#121212] border-l-4 border-[#ED1D24] p-8 md:p-10 shadow-2xl relative">
                {/* Tech Scanline Overlay Effect */}
                <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />

                <p className="font-body text-lg md:text-xl text-white leading-relaxed mb-8">
                  When a localized rift in the Multiverse threatens to consume
                  our reality, the fractured remains of Earth&apos;s mightiest
                  heroes must reconcile their violent past to secure a future.
                  The stakes have never been more personal. The cost has never
                  been higher.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/10">
                  <div className="flex items-center space-x-3">
                    <Shield className="text-[#00D4FF] w-5 h-5" />
                    <span className="font-label text-xs text-zinc-400">
                      DEFEND REALITY
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Zap className="text-[#00D4FF] w-5 h-5" />
                    <span className="font-label text-xs text-zinc-400">
                      MAXIMUM POWER
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Target className="text-[#00D4FF] w-5 h-5" />
                    <span className="font-label text-xs text-zinc-400">
                      ZERO MARGIN
                    </span>
                  </div>
                </div>
              </div>

              {/* CTA Group */}
              <div className="flex flex-wrap gap-6 pt-4">
                <button
                  className="group relative px-8 py-4 bg-[#ED1D24] text-white font-display text-xl uppercase tracking-wider transition-all duration-300 border-b-4 border-red-800 hover:bg-red-500 hover:-translate-y-1 active:translate-y-0"
                  style={{
                    clipPath:
                      "polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0% 30%)",
                  }}
                >
                  Get Tickets Now
                </button>
                <button className="px-8 py-4 bg-transparent border-2 border-white/20 hover:border-white text-white font-display text-xl uppercase tracking-wider transition-all duration-300 backdrop-blur-sm">
                  Watch Trailer
                </button>
              </div>
            </div>
          </motion.div>

          {/* Character Visual - Right Side */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, ease: [0.19, 1, 0.22, 1] }}
            viewport={{ once: true }}
            className="col-span-12 lg:col-span-5 order-1 lg:order-2 relative h-[500px] md:h-[700px] flex items-center justify-center"
          >
            {/* Background Glow */}
            <div className="absolute w-[80%] h-[80%] bg-[#ED1D24]/20 rounded-full blur-[120px]" />

            {/* Character Image Placeholder (Using a styled container to represent the high-alpha cutout) */}
            <div className="relative w-full h-full group">
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent z-20" />

              {/* This represents the "Hero Asset" */}
              <div className="relative z-10 w-full h-full flex items-center justify-center">
                <div className="relative w-full h-full max-w-[450px] aspect-[2/3] border-4 border-[#C0C0C0]/30 overflow-hidden transform group-hover:scale-[1.02] transition-transform duration-700">
                  {/* Simulated Character Image */}
                  <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&q=80&w=800')] bg-cover bg-center grayscale contrast-125 opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-[#ED1D24]/40 to-transparent mix-blend-overlay" />

                    {/* Visual Tech Overlays */}
                    <div className="absolute top-4 left-4 font-label text-[10px] text-[#00D4FF] bg-black/50 p-2 border border-[#00D4FF]/30">
                      SCANNING_THREAT_LEVEL: OMEGA
                    </div>
                  </div>

                  {/* Outer Frame Accents */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#ED1D24] z-30" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#ED1D24] z-30" />
                </div>
              </div>

              {/* Floating Tech Elements */}
              <motion.div
                animate={{ y: [0, -15, 0] }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute -top-10 -right-10 w-32 h-32 border border-[#00D4FF]/20 rounded-full flex items-center justify-center backdrop-blur-md hidden md:flex"
              >
                <div className="text-center">
                  <p className="font-label text-[10px] text-[#00D4FF]">
                    INTELLIGENCE
                  </p>
                  <p className="font-display text-2xl text-white">98%</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Cinematic Gradient */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-black to-transparent z-20" />
    </section>
  );
}
