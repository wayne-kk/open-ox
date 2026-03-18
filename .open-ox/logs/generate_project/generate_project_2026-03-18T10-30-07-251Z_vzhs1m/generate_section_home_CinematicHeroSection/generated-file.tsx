"use client";

import React, { useState, useEffect } from "react";
import { Play, Ticket, ChevronDown, Shield, Zap, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function CinematicHeroSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Prevent scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isModalOpen]);

  const chamferClipPath =
    "polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0% 30%)";

  return (
    <section className="relative h-screen w-full overflow-hidden bg-[#050505] flex items-center justify-center">
      {/* Background Video/Image Layer */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#050505] z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/80 z-10" />

        {/* Placeholder for Cinematic Video - In production use <video> tag */}
        <img
          src="https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?auto=format&fit=crop&q=80&w=2070"
          alt="Cinematic Movie Background"
          className="w-full h-full object-cover opacity-60 scale-105 animate-[pulse_10s_ease-in-out_infinite]"
        />

        {/* Texture Overlays */}
        <div
          className="absolute inset-0 z-20 pointer-events-none opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 0)",
            backgroundSize: "30px 30px",
          }}
        />
        <div className="absolute inset-0 z-20 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
      </div>

      {/* HUD / Tech Decorative Elements */}
      <div className="absolute inset-0 z-30 pointer-events-none p-6 md:p-12 hidden md:block">
        <div className="h-full w-full border border-[#00D4FF]/20 relative">
          {/* Corner Accents */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#00D4FF]" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#00D4FF]" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#00D4FF]" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#00D4FF]" />

          {/* Tech Readouts */}
          <div className="absolute top-8 left-8 font-label text-[10px] text-[#00D4FF]/60 flex flex-col gap-1">
            <span className="flex items-center gap-2">
              <Globe size={10} /> SYSTEM_READY: MULTIVERSE_SYNC
            </span>
            <span className="flex items-center gap-2">
              <Shield size={10} /> ENCRYPTION: LEVEL_OMEGA
            </span>
            <span className="flex items-center gap-2 animate-pulse">
              <Zap size={10} /> POWER_CORE: 100%
            </span>
          </div>

          <div className="absolute bottom-8 right-8 font-label text-[10px] text-[#00D4FF]/60 text-right">
            <span>COORDINATES: 40.7128° N, 74.0060° W</span>
            <br />
            <span>TIMESTAMP: {new Date().toISOString().split("T")[0]}</span>
          </div>
        </div>
      </div>

      {/* Main Content Stack */}
      <div className="relative z-40 container mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
          className="flex flex-col items-center"
        >
          {/* Eyebrow */}
          <span className="font-label text-xs md:text-sm tracking-[0.3em] text-[#C0C0C0] mb-6 block drop-shadow-lg">
            MARVEL STUDIOS PRESENTS
          </span>

          {/* Title Wordmark */}
          <h1
            className="font-display text-7xl md:text-[12rem] leading-[0.85] text-white uppercase tracking-tighter mb-8 italic"
            style={{
              textShadow: "2px 2px 0px #ED1D24, 6px 6px 0px rgba(0,0,0,1)",
              filter: "drop-shadow(0 0 30px rgba(237, 29, 36, 0.3))",
            }}
          >
            ETERNITY <br />{" "}
            <span className="text-5xl md:text-8xl not-italic tracking-normal">
              WAR
            </span>
          </h1>

          {/* Subheading */}
          <p className="font-body text-lg md:text-2xl text-[#A1A1AA] max-w-2xl mx-auto mb-12 leading-relaxed">
            The multiverse fractures. History dissolves. One final stand to
            rewrite the destiny of every timeline.
          </p>

          {/* CTA Group */}
          <div className="flex flex-col sm:flex-row gap-6 items-center justify-center">
            {/* Primary Action */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="group relative transition-transform duration-300 hover:scale-105 active:scale-95"
            >
              <div
                className="bg-[#ED1D24] text-white px-10 py-5 flex items-center gap-3 shadow-[0_0_20px_rgba(237,29,36,0.4)]"
                style={{ clipPath: chamferClipPath }}
              >
                <Play className="fill-current" size={20} />
                <span className="font-display text-2xl tracking-wider pt-1">
                  WATCH TRAILER
                </span>
              </div>
              <div
                className="absolute inset-0 bg-white/20 translate-x-1 translate-y-1 -z-10 group-hover:translate-x-2 group-hover:translate-y-2 transition-transform"
                style={{ clipPath: chamferClipPath }}
              />
            </button>

            {/* Secondary Action */}
            <button className="group relative transition-colors duration-300">
              <div
                className="bg-transparent border-2 border-white/20 hover:border-white text-white px-10 py-[18px] flex items-center gap-3 backdrop-blur-md"
                style={{ clipPath: chamferClipPath }}
              >
                <Ticket size={20} className="text-[#00D4FF]" />
                <span className="font-display text-2xl tracking-wider pt-1">
                  GET TICKETS
                </span>
              </div>
            </button>
          </div>

          {/* Social Proof / Stats */}
          <div className="mt-16 flex items-center gap-8 border-y border-white/10 py-4 px-8 backdrop-blur-sm">
            <div className="text-center">
              <div className="font-display text-2xl text-white">MAY 04</div>
              <div className="font-label text-[10px] text-[#A1A1AA]">
                IN THEATERS
              </div>
            </div>
            <div className="w-[1px] h-8 bg-white/10" />
            <div className="text-center">
              <div className="font-display text-2xl text-[#00D4FF]">
                IMAX 3D
              </div>
              <div className="font-label text-[10px] text-[#A1A1AA]">
                EXPERIENCE
              </div>
            </div>
            <div className="w-[1px] h-8 bg-white/10" />
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-[#121212] bg-[#1A1A1A] overflow-hidden"
                >
                  <img
                    src={`https://i.pravatar.cc/100?img=${i + 10}`}
                    alt="Fan Avatar"
                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all"
                  />
                </div>
              ))}
              <div className="w-8 h-8 rounded-full border-2 border-[#121212] bg-[#ED1D24] flex items-center justify-center text-[10px] font-bold text-white">
                98%
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2">
        <span className="font-label text-[10px] tracking-[0.4em] text-white/40 uppercase">
          Initiate Protocol
        </span>
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="text-[#ED1D24]" size={24} />
        </motion.div>
      </div>

      {/* Trailer Modal Overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-12"
          >
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-8 right-8 text-white/60 hover:text-white transition-colors"
            >
              <span className="font-label text-sm tracking-widest uppercase flex items-center gap-2">
                [ Close ]
              </span>
            </button>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-6xl aspect-video bg-black border border-white/10 shadow-[0_0_100px_rgba(237,29,36,0.2)] relative overflow-hidden"
            >
              {/* Simulated Video Player */}
              <div className="absolute inset-0 flex items-center justify-center group cursor-pointer">
                <img
                  src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=2025"
                  className="w-full h-full object-cover opacity-80"
                  alt="Trailer Thumbnail"
                />
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-2 border-white flex items-center justify-center group-hover:scale-110 transition-transform bg-white/10 backdrop-blur-sm">
                    <Play className="fill-white ml-2" size={40} />
                  </div>
                </div>
              </div>

              {/* Video Controls Overlay (Visual Only) */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black to-transparent flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-[#ED1D24] animate-pulse" />
                  <span className="font-label text-xs text-white/80">
                    00:42 / 02:15
                  </span>
                </div>
                <div className="flex gap-4">
                  <div className="w-32 h-1 bg-white/20 relative">
                    <div className="absolute top-0 left-0 w-1/3 h-full bg-[#ED1D24]" />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
