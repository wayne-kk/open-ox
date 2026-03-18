"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Calendar, MousePointer2, Star, Award } from "lucide-react";

/**
 * HeroSection Component
 * An immersive, Ghibli-inspired hero section featuring a "living painting" aesthetic.
 * Uses Framer Motion for ambient drifting effects and follows the strict typography
 * and color tokens defined in the design system.
 */
export default function HeroSection() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <section className="relative w-full h-[100vh] min-h-[700px] flex items-center justify-center overflow-hidden bg-[#FDFBF7]">
      {/* Background Layer: The Living Painting */}
      <div className="absolute inset-0 z-0">
        {/* Cinematic Video/Image Background */}
        <div className="absolute inset-0 scale-110">
          <motion.div
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 2.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full h-full"
          >
            {/* Using a high-quality placeholder that mimics Ghibli landscape aesthetics */}
            <img
              src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=2000"
              alt="The Whispering Woods Landscape"
              className="w-full h-full object-cover brightness-[0.85] contrast-[1.05]"
            />
          </motion.div>
        </div>

        {/* Watercolor Bleed Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#FDFBF7]/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#FDFBF7]/30 via-transparent to-[#FDFBF7]/30" />

        {/* Paper Grain Texture Overlay */}
        <div
          className="absolute inset-0 z-10 pointer-events-none opacity-40 mix-blend-multiply"
          style={{
            backgroundImage: `url("https://www.transparenttextures.com/patterns/natural-paper.png")`,
            backgroundRepeat: "repeat",
          }}
        />

        {/* Floating Atmospheric Particles (Ambient Motion) */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-[#7DB9B6]/40 blur-sm"
              initial={{
                x: Math.random() * 100 + "%",
                y: Math.random() * 100 + "%",
                opacity: 0,
              }}
              animate={{
                y: [null, "-20vh"],
                opacity: [0, 0.6, 0],
                x: [null, (Math.random() - 0.5) * 100 + "px"],
              }}
              transition={{
                duration: 10 + Math.random() * 10,
                repeat: Infinity,
                ease: "linear",
                delay: Math.random() * 5,
              }}
            />
          ))}
        </div>
      </div>

      {/* Content Layer */}
      <div className="relative z-20 container mx-auto px-6 flex flex-col items-center text-center">
        {/* Social Proof / Award Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mb-8 flex items-center gap-4"
        >
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F5F0E6]/90 border border-[#D9D2C5] shadow-sm backdrop-blur-sm">
            <Award className="w-4 h-4 text-[#4A7C59]" />
            <span className="font-label text-[10px] md:text-xs text-[#2D302E] tracking-[0.2em] uppercase">
              Winner: Best Animation 2024
            </span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#F5F0E6]/90 border border-[#D9D2C5] shadow-sm backdrop-blur-sm">
            <div className="flex -space-x-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="w-3 h-3 fill-[#E9806E] text-[#E9806E]"
                />
              ))}
            </div>
            <span className="font-label text-[10px] text-[#2D302E] tracking-widest uppercase ml-1">
              4.9 Rating
            </span>
          </div>
        </motion.div>

        {/* Eyebrow Text */}
        <motion.span
          initial={{ opacity: 0, letterSpacing: "0.5em" }}
          animate={{ opacity: 1, letterSpacing: "0.3em" }}
          transition={{ delay: 0.8, duration: 1.2 }}
          className="font-label text-xs md:text-sm text-[#4A7C59] font-bold uppercase mb-4 block"
        >
          A Studio Mirai Original Film
        </motion.span>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 1 }}
          className="font-display text-6xl md:text-9xl text-[#2D302E] italic font-light tracking-tighter leading-none mb-6"
          style={{ textShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
        >
          The Whispering <br className="hidden md:block" /> Woods
        </motion.h1>

        {/* Supporting Subheading */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 1 }}
          className="font-body text-[#2D302E] text-lg md:text-2xl max-w-2xl mx-auto mb-10 leading-relaxed font-light"
        >
          Journey into a world where the wind carries forgotten secrets and
          every leaf tells a story of the ancient spirits within.
        </motion.p>

        {/* CTA Block */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.8, duration: 0.8 }}
          className="flex flex-col sm:flex-row items-center gap-6"
        >
          {/* Primary Action: Watch Trailer */}
          <button className="group relative flex items-center gap-3 px-10 py-5 bg-[#4A7C59] text-[#FDFBF7] rounded-full font-label text-sm uppercase tracking-[0.2em] transition-all duration-500 ease-out hover:bg-[#3E674A] hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(74,124,89,0.4)] overflow-hidden">
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FDFBF7]/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                <Play className="w-3.5 h-3.5 fill-current" />
              </div>
              Watch Trailer
            </div>
            {/* Hover Shine Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
          </button>

          {/* Secondary Action: Book Tickets */}
          <button className="flex items-center gap-3 px-10 py-5 border border-[#4A7C59] text-[#4A7C59] rounded-full font-label text-sm uppercase tracking-[0.2em] transition-all duration-500 ease-out hover:bg-[#7DB9B6] hover:text-[#FDFBF7] hover:border-[#7DB9B6] hover:-translate-y-1">
            <Calendar className="w-4 h-4" />
            Book Tickets
          </button>
        </motion.div>
      </div>

      {/* Floating Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5, duration: 1 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-4"
      >
        <span className="font-label text-[10px] text-[#707571] tracking-[0.4em] uppercase">
          Explore the World
        </span>
        <motion.div
          animate={{ y: [0, 12, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="w-px h-16 bg-gradient-to-b from-[#4A7C59] to-transparent"
        />
      </motion.div>

      {/* Interactive Cursor Ornament (Optional Decorative Detail) */}
      <div className="hidden lg:block absolute pointer-events-none inset-0 z-30 opacity-20">
        <motion.div
          animate={{
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-20 right-20 w-64 h-64 border border-dashed border-[#4A7C59] rounded-full"
        />
        <motion.div
          animate={{
            rotate: -360,
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-40 left-10 w-48 h-48 border border-dashed border-[#7DB9B6] rounded-full"
        />
      </div>

      {/* Accessibility: Hidden H2 for structure */}
      <h2 className="sr-only">Movie Introduction and Trailer</h2>
    </section>
  );
}
