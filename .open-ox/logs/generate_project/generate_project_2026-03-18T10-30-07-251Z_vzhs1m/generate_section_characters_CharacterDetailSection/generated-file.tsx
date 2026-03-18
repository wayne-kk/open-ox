"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Shield, Zap, Target, Cpu, ChevronRight, Info } from "lucide-react";

/**
 * CharacterDetailSection
 * A high-impact, editorial-style hero section for character dossiers.
 * Features: Cinematic typography, animated power stats, and immersive textures.
 */
export default function CharacterDetailSection() {
  // Animation variants for "slam" effect
  const slamTransition = {
    type: "spring",
    damping: 12,
    stiffness: 100,
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -50, filter: "blur(10px)" },
    visible: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: slamTransition,
    },
  };

  const statVariants = {
    hidden: { width: 0 },
    visible: (custom: number) => ({
      width: `${custom}%`,
      transition: { duration: 1.5, ease: "easeOut", delay: 0.8 },
    }),
  };

  return (
    <section className="relative min-h-screen w-full bg-[#050505] overflow-hidden flex flex-col justify-center">
      {/* BACKGROUND TEXTURES & EFFECTS */}
      <div className="absolute inset-0 z-0">
        {/* Halftone Dot Pattern */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Scanline Tech Overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            background:
              "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))",
            backgroundSize: "100% 4px, 4px 100%",
          }}
        />

        {/* Decorative Asymmetric Slashes */}
        <div className="absolute -right-20 top-0 w-1/2 h-full bg-[#ED1D24]/5 -skew-x-12 transform origin-top-right" />
        <div className="absolute left-1/4 bottom-0 w-px h-2/3 bg-gradient-to-t from-[#00D4FF]/40 to-transparent" />
      </div>

      <div className="container mx-auto px-6 py-24 relative z-10">
        <div className="grid grid-cols-12 gap-8 items-center">
          {/* LEFT CONTENT COLUMN */}
          <motion.div
            className="col-span-12 lg:col-span-7 order-2 lg:order-1"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {/* Eyebrow / Label */}
            <motion.div
              variants={itemVariants}
              className="flex items-center gap-3 mb-4"
            >
              <span className="h-px w-12 bg-[#ED1D24]" />
              <span className="font-label text-xs tracking-[0.3em] text-[#ED1D24] font-bold">
                SUBJECT ID: 0814-VANGUARD
              </span>
            </motion.div>

            {/* Main Title */}
            <motion.div variants={itemVariants} className="relative mb-6">
              <h1
                className="font-display text-7xl md:text-9xl uppercase leading-none tracking-tighter text-white"
                style={{
                  textShadow: "2px 2px 0px #ED1D24, 4px 4px 0px rgba(0,0,0,1)",
                }}
              >
                THE <br /> VANGUARD
              </h1>
              <div className="absolute -top-4 -left-4 font-header text-xl italic text-white/20 uppercase tracking-widest hidden md:block">
                Project Dossier
              </div>
            </motion.div>

            {/* Actor / Subtitle */}
            <motion.h3
              variants={itemVariants}
              className="font-header text-2xl md:text-3xl italic text-[#C0C0C0] uppercase mb-8 flex items-center gap-4"
            >
              <span>Ares Thorne</span>
              <span className="h-4 w-px bg-white/20" />
              <span className="text-[#00D4FF] text-lg not-italic font-label tracking-tighter">
                Played by Jackson Reed
              </span>
            </motion.h3>

            {/* Bio Body */}
            <motion.div variants={itemVariants} className="max-w-xl mb-12">
              <p className="font-body text-base md:text-lg text-white/80 leading-relaxed">
                Forged in the heart of a collapsing star, Ares Thorne was the
                only survivor of the Zenith Protocol. Now serving as
                Earth&apos;s primary deterrent against extra-dimensional
                threats, he wields the power of condensed gravity. A soldier of
                fortune turned cosmic guardian, his loyalty remains as
                unpredictable as his kinetic outbursts.
              </p>
            </motion.div>

            {/* Power Stats Grid */}
            <motion.div
              variants={itemVariants}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12"
            >
              {[
                { label: "Strength", value: 98, icon: <Shield size={14} /> },
                {
                  label: "Energy Projection",
                  value: 92,
                  icon: <Zap size={14} />,
                },
                {
                  label: "Tactical Intel",
                  value: 85,
                  icon: <Target size={14} />,
                },
                { label: "Tech Aptitude", value: 74, icon: <Cpu size={14} /> },
              ].map((stat, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between items-center font-label text-[10px] tracking-widest text-[#A1A1AA] uppercase">
                    <span className="flex items-center gap-2">
                      <span className="text-[#00D4FF]">{stat.icon}</span>
                      {stat.label}
                    </span>
                    <span className="text-white">{stat.value}%</span>
                  </div>
                  <div className="h-1 w-full bg-white/5 relative overflow-hidden">
                    <motion.div
                      custom={stat.value}
                      variants={statVariants}
                      className="absolute top-0 left-0 h-full bg-[#00D4FF] shadow-[0_0_10px_rgba(0,212,255,0.5)]"
                    />
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Actions */}
            <motion.div
              variants={itemVariants}
              className="flex flex-wrap gap-4"
            >
              <button
                className="group relative px-8 py-4 bg-[#ED1D24] text-white font-display text-xl uppercase tracking-wider transition-all duration-300 hover:bg-red-500 hover:translate-y-[-2px] active:translate-y-0 shadow-[0_0_20px_rgba(237,29,36,0.4)]"
                style={{
                  clipPath:
                    "polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0% 30%)",
                }}
              >
                <span className="flex items-center gap-2">
                  Access Data-Log{" "}
                  <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                </span>
              </button>

              <button
                className="px-8 py-4 bg-transparent border border-white/20 text-white font-display text-xl uppercase tracking-wider hover:bg-white/5 transition-all duration-300 flex items-center gap-2"
                style={{
                  clipPath:
                    "polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0% 30%)",
                }}
              >
                <Info size={18} className="text-[#00D4FF]" />
                Origin Story
              </button>
            </motion.div>
          </motion.div>

          {/* RIGHT ART COLUMN */}
          <div className="col-span-12 lg:col-span-5 order-1 lg:order-2 relative h-[50vh] lg:h-[80vh] flex items-center justify-center">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-radial-gradient from-[#ED1D24]/20 via-transparent to-transparent blur-3xl rounded-full" />

            {/* Character Image Container */}
            <motion.div
              className="relative w-full h-full"
              initial={{ opacity: 0, scale: 0.8, x: 100 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ ...slamTransition, delay: 0.4 }}
            >
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Decorative Frame Elements */}
                <div className="absolute top-0 right-0 w-24 h-24 border-t-2 border-r-2 border-[#00D4FF]/30" />
                <div className="absolute bottom-0 left-0 w-24 h-24 border-b-2 border-l-2 border-[#ED1D24]/30" />

                {/* Image Placeholder / Asset */}
                <div className="relative w-full h-full max-w-md lg:max-w-none">
                  {/* Note: In a real app, replace with <Image />. Using a stylized div to represent high-impact art */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent z-10" />
                  <div className="w-full h-full bg-[#121212] flex items-center justify-center overflow-hidden border border-white/5">
                    <div className="text-center p-8 opacity-20">
                      <div className="font-display text-9xl text-white">V</div>
                      <div className="font-label text-xs uppercase tracking-widest text-[#00D4FF]">
                        Render Sequence Pending
                      </div>
                    </div>
                    {/* Simulated High-Res Character Render */}
                    <div
                      className="absolute inset-0 bg-cover bg-center grayscale hover:grayscale-0 transition-all duration-700 scale-110 hover:scale-100"
                      style={{
                        backgroundImage: `url('https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?q=80&w=2070&auto=format&fit=crop')`,
                        mixBlendMode: "overlay",
                      }}
                    />
                    {/* Technical HUD Overlay */}
                    <div className="absolute inset-4 border border-[#00D4FF]/10 pointer-events-none flex flex-col justify-between p-4">
                      <div className="flex justify-between items-start font-label text-[8px] text-[#00D4FF]/40">
                        <span>SCAN_READY: 100%</span>
                        <span>GRID_LOCK: ACTIVE</span>
                      </div>
                      <div className="flex justify-between items-end font-label text-[8px] text-[#00D4FF]/40">
                        <span>LAT: 34.0522 N</span>
                        <span>LON: 118.2437 W</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Floating Metadata Labels */}
            <motion.div
              className="absolute top-10 right-0 bg-black/80 backdrop-blur-md border-l-4 border-[#00D4FF] p-4 hidden xl:block"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2 }}
            >
              <p className="font-label text-[10px] text-[#00D4FF] mb-1 tracking-tighter">
                THREAT LEVEL
              </p>
              <p className="font-header text-2xl text-white uppercase italic">
                Omega Class
              </p>
            </motion.div>

            <motion.div
              className="absolute bottom-20 left-0 bg-black/80 backdrop-blur-md border-l-4 border-[#ED1D24] p-4 hidden xl:block"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.4 }}
            >
              <p className="font-label text-[10px] text-[#ED1D24] mb-1 tracking-tighter">
                AFFILIATION
              </p>
              <p className="font-header text-2xl text-white uppercase italic">
                The Eternals
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#050505] to-transparent z-20" />
    </section>
  );
}
("use client");

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Shield, Zap, Target, Cpu, ChevronRight, Info } from "lucide-react";

/**
 * CharacterDetailSection
 * A high-impact, editorial-style hero section for character dossiers.
 * Features: Cinematic typography, animated power stats, and immersive textures.
 */
export default function CharacterDetailSection() {
  // Animation variants for "slam" effect
  const slamTransition = {
    type: "spring",
    damping: 12,
    stiffness: 100,
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -50, filter: "blur(10px)" },
    visible: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: slamTransition,
    },
  };

  const statVariants = {
    hidden: { width: 0 },
    visible: (custom: number) => ({
      width: `${custom}%`,
      transition: { duration: 1.5, ease: "easeOut", delay: 0.8 },
    }),
  };

  return (
    <section className="relative min-h-screen w-full bg-[#050505] overflow-hidden flex flex-col justify-center">
      {/* BACKGROUND TEXTURES & EFFECTS */}
      <div className="absolute inset-0 z-0">
        {/* Halftone Dot Pattern */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Scanline Tech Overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            background:
              "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))",
            backgroundSize: "100% 4px, 4px 100%",
          }}
        />

        {/* Decorative Asymmetric Slashes */}
        <div className="absolute -right-20 top-0 w-1/2 h-full bg-[#ED1D24]/5 -skew-x-12 transform origin-top-right" />
        <div className="absolute left-1/4 bottom-0 w-px h-2/3 bg-gradient-to-t from-[#00D4FF]/40 to-transparent" />
      </div>

      <div className="container mx-auto px-6 py-24 relative z-10">
        <div className="grid grid-cols-12 gap-8 items-center">
          {/* LEFT CONTENT COLUMN */}
          <motion.div
            className="col-span-12 lg:col-span-7 order-2 lg:order-1"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {/* Eyebrow / Label */}
            <motion.div
              variants={itemVariants}
              className="flex items-center gap-3 mb-4"
            >
              <span className="h-px w-12 bg-[#ED1D24]" />
              <span className="font-label text-xs tracking-[0.3em] text-[#ED1D24] font-bold">
                SUBJECT ID: 0814-VANGUARD
              </span>
            </motion.div>

            {/* Main Title */}
            <motion.div variants={itemVariants} className="relative mb-6">
              <h1
                className="font-display text-7xl md:text-9xl uppercase leading-none tracking-tighter text-white"
                style={{
                  textShadow: "2px 2px 0px #ED1D24, 4px 4px 0px rgba(0,0,0,1)",
                }}
              >
                THE <br /> VANGUARD
              </h1>
              <div className="absolute -top-4 -left-4 font-header text-xl italic text-white/20 uppercase tracking-widest hidden md:block">
                Project Dossier
              </div>
            </motion.div>

            {/* Actor / Subtitle */}
            <motion.h3
              variants={itemVariants}
              className="font-header text-2xl md:text-3xl italic text-[#C0C0C0] uppercase mb-8 flex items-center gap-4"
            >
              <span>Ares Thorne</span>
              <span className="h-4 w-px bg-white/20" />
              <span className="text-[#00D4FF] text-lg not-italic font-label tracking-tighter">
                Played by Jackson Reed
              </span>
            </motion.h3>

            {/* Bio Body */}
            <motion.div variants={itemVariants} className="max-w-xl mb-12">
              <p className="font-body text-base md:text-lg text-white/80 leading-relaxed">
                Forged in the heart of a collapsing star, Ares Thorne was the
                only survivor of the Zenith Protocol. Now serving as
                Earth&apos;s primary deterrent against extra-dimensional
                threats, he wields the power of condensed gravity. A soldier of
                fortune turned cosmic guardian, his loyalty remains as
                unpredictable as his kinetic outbursts.
              </p>
            </motion.div>

            {/* Power Stats Grid */}
            <motion.div
              variants={itemVariants}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12"
            >
              {[
                { label: "Strength", value: 98, icon: <Shield size={14} /> },
                {
                  label: "Energy Projection",
                  value: 92,
                  icon: <Zap size={14} />,
                },
                {
                  label: "Tactical Intel",
                  value: 85,
                  icon: <Target size={14} />,
                },
                { label: "Tech Aptitude", value: 74, icon: <Cpu size={14} /> },
              ].map((stat, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between items-center font-label text-[10px] tracking-widest text-[#A1A1AA] uppercase">
                    <span className="flex items-center gap-2">
                      <span className="text-[#00D4FF]">{stat.icon}</span>
                      {stat.label}
                    </span>
                    <span className="text-white">{stat.value}%</span>
                  </div>
                  <div className="h-1 w-full bg-white/5 relative overflow-hidden">
                    <motion.div
                      custom={stat.value}
                      variants={statVariants}
                      className="absolute top-0 left-0 h-full bg-[#00D4FF] shadow-[0_0_10px_rgba(0,212,255,0.5)]"
                    />
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Actions */}
            <motion.div
              variants={itemVariants}
              className="flex flex-wrap gap-4"
            >
              <button
                className="group relative px-8 py-4 bg-[#ED1D24] text-white font-display text-xl uppercase tracking-wider transition-all duration-300 hover:bg-red-500 hover:translate-y-[-2px] active:translate-y-0 shadow-[0_0_20px_rgba(237,29,36,0.4)]"
                style={{
                  clipPath:
                    "polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0% 30%)",
                }}
              >
                <span className="flex items-center gap-2">
                  Access Data-Log{" "}
                  <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                </span>
              </button>

              <button
                className="px-8 py-4 bg-transparent border border-white/20 text-white font-display text-xl uppercase tracking-wider hover:bg-white/5 transition-all duration-300 flex items-center gap-2"
                style={{
                  clipPath:
                    "polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0% 30%)",
                }}
              >
                <Info size={18} className="text-[#00D4FF]" />
                Origin Story
              </button>
            </motion.div>
          </motion.div>

          {/* RIGHT ART COLUMN */}
          <div className="col-span-12 lg:col-span-5 order-1 lg:order-2 relative h-[50vh] lg:h-[80vh] flex items-center justify-center">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-radial-gradient from-[#ED1D24]/20 via-transparent to-transparent blur-3xl rounded-full" />

            {/* Character Image Container */}
            <motion.div
              className="relative w-full h-full"
              initial={{ opacity: 0, scale: 0.8, x: 100 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ ...slamTransition, delay: 0.4 }}
            >
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Decorative Frame Elements */}
                <div className="absolute top-0 right-0 w-24 h-24 border-t-2 border-r-2 border-[#00D4FF]/30" />
                <div className="absolute bottom-0 left-0 w-24 h-24 border-b-2 border-l-2 border-[#ED1D24]/30" />

                {/* Image Placeholder / Asset */}
                <div className="relative w-full h-full max-w-md lg:max-w-none">
                  {/* Note: In a real app, replace with <Image />. Using a stylized div to represent high-impact art */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent z-10" />
                  <div className="w-full h-full bg-[#121212] flex items-center justify-center overflow-hidden border border-white/5">
                    <div className="text-center p-8 opacity-20">
                      <div className="font-display text-9xl text-white">V</div>
                      <div className="font-label text-xs uppercase tracking-widest text-[#00D4FF]">
                        Render Sequence Pending
                      </div>
                    </div>
                    {/* Simulated High-Res Character Render */}
                    <div
                      className="absolute inset-0 bg-cover bg-center grayscale hover:grayscale-0 transition-all duration-700 scale-110 hover:scale-100"
                      style={{
                        backgroundImage: `url('https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?q=80&w=2070&auto=format&fit=crop')`,
                        mixBlendMode: "overlay",
                      }}
                    />
                    {/* Technical HUD Overlay */}
                    <div className="absolute inset-4 border border-[#00D4FF]/10 pointer-events-none flex flex-col justify-between p-4">
                      <div className="flex justify-between items-start font-label text-[8px] text-[#00D4FF]/40">
                        <span>SCAN_READY: 100%</span>
                        <span>GRID_LOCK: ACTIVE</span>
                      </div>
                      <div className="flex justify-between items-end font-label text-[8px] text-[#00D4FF]/40">
                        <span>LAT: 34.0522 N</span>
                        <span>LON: 118.2437 W</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Floating Metadata Labels */}
            <motion.div
              className="absolute top-10 right-0 bg-black/80 backdrop-blur-md border-l-4 border-[#00D4FF] p-4 hidden xl:block"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2 }}
            >
              <p className="font-label text-[10px] text-[#00D4FF] mb-1 tracking-tighter">
                THREAT LEVEL
              </p>
              <p className="font-header text-2xl text-white uppercase italic">
                Omega Class
              </p>
            </motion.div>

            <motion.div
              className="absolute bottom-20 left-0 bg-black/80 backdrop-blur-md border-l-4 border-[#ED1D24] p-4 hidden xl:block"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.4 }}
            >
              <p className="font-label text-[10px] text-[#ED1D24] mb-1 tracking-tighter">
                AFFILIATION
              </p>
              <p className="font-header text-2xl text-white uppercase italic">
                The Eternals
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#050505] to-transparent z-20" />
    </section>
  );
}
