"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Skull,
  Zap,
  Ghost,
  Eye,
  Biohazard,
  Monitor,
  ArrowUpRight,
  Music2,
  Radiation,
} from "lucide-react";

const OCTAGON_CLIP = "polygon(8% 0, 100% 0, 100% 92%, 92% 100%, 0 100%, 0 8%)";

const FEATURE_DATA = [
  {
    id: "01",
    title: "CYBER GHOUL",
    subtitle: "HEADLINER / LIVE SET",
    description:
      "Ultra-heavy industrial bass fused with necrotic synth-wave. A 2-hour immersive audio-visual assault.",
    icon: Skull,
    accent: "text-[#BF00FF]",
    border: "border-[#BF00FF]",
    shadow: "shadow-[0_0_20px_rgba(191,0,255,0.3)]",
    size: "md:col-span-7 md:row-span-2",
  },
  {
    id: "02",
    title: "ACID RAIN",
    subtitle: "VISUAL ARCHITECT",
    description:
      "Generative glitch art and real-time liquid light projections that melt the boundaries of reality.",
    icon: Zap,
    accent: "text-[#CCFF00]",
    border: "border-[#CCFF00]",
    shadow: "shadow-[0_0_15px_rgba(204,255,0,0.4)]",
    size: "md:col-span-5 md:row-span-1",
  },
  {
    id: "03",
    title: "VOID WALKER",
    subtitle: "DARK TECHNO",
    description:
      "Sub-atomic frequencies designed to resonate with the skeletal system. Enter the vacuum.",
    icon: Ghost,
    accent: "text-[#FF007F]",
    border: "border-[#FF007F]",
    shadow: "shadow-[0_0_20px_rgba(255,0,127,0.3)]",
    size: "md:col-span-5 md:row-span-1",
  },
  {
    id: "04",
    title: "NEON PHANTOM",
    subtitle: "SPECIAL GUEST",
    description:
      "The elusive master of high-bpm terror-core returns for a one-off midnight ritual.",
    icon: Eye,
    accent: "text-[#F5F5F5]",
    border: "border-[#333333]",
    shadow: "shadow-none",
    size: "md:col-span-4 md:row-span-1",
  },
  {
    id: "05",
    title: "TOXIC WASTE",
    subtitle: "IMMERSIVE DECOR",
    description:
      "Bio-luminescent environments and radioactive installations curated by the Waste Collective.",
    icon: Biohazard,
    accent: "text-[#CCFF00]",
    border: "border-[#CCFF00]",
    shadow: "shadow-[0_0_15px_rgba(204,255,0,0.2)]",
    size: "md:col-span-4 md:row-span-1",
  },
  {
    id: "06",
    title: "DIGITAL DECAY",
    subtitle: "LIVE CODING",
    description:
      "Algorithmic destruction. Witness the source code of the party being rewritten in real-time.",
    icon: Monitor,
    accent: "text-[#BF00FF]",
    border: "border-[#BF00FF]",
    shadow: "shadow-[0_0_20px_rgba(191,0,255,0.2)]",
    size: "md:col-span-4 md:row-span-1",
  },
];

export default function LineupSection() {
  return (
    <section className="relative w-full bg-[#050505] py-24 px-4 md:px-8 overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-grain pointer-events-none opacity-20" />
      <div className="absolute top-0 left-0 w-full h-full bg-scanlines pointer-events-none opacity-10" />

      {/* Section Header */}
      <div className="relative z-10 max-w-7xl mx-auto mb-16 md:mb-24">
        <div className="flex flex-col items-start -rotate-[-1deg] md:-ml-4">
          <span className="font-label text-[#CCFF00] text-sm md:text-base tracking-[0.3em] mb-4 flex items-center gap-2">
            <Radiation className="w-4 h-4 animate-spin-slow" />
            LIVE TRANSMISSION // OCT 31
          </span>
          <h2 className="font-header text-5xl md:text-8xl text-[#F5F5F5] leading-none uppercase tracking-tighter">
            THE{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#CCFF00] via-[#BF00FF] to-[#FF007F]">
              LINEUP
            </span>
          </h2>
        </div>
      </div>

      {/* Grid Container */}
      <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
        {FEATURE_DATA.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.01 }}
            className={`group relative flex flex-col bg-[#0A0A0A] border-2 ${item.border} ${item.size} p-6 md:p-8 transition-all duration-150 ${item.shadow}`}
            style={{ clipPath: OCTAGON_CLIP }}
          >
            {/* Grain Overlay */}
            <div className="absolute inset-0 bg-grain opacity-5 pointer-events-none" />

            {/* Card Header */}
            <div className="flex justify-between items-start mb-8">
              <div
                className={`p-3 bg-[#1A1A1A] border border-[#333333] transition-colors group-hover:bg-[#050505]`}
              >
                <item.icon
                  className={`w-8 h-8 ${item.accent} group-hover:scale-110 transition-transform duration-300`}
                />
              </div>
              <span className="font-label text-[#333333] group-hover:text-[#F5F5F5] transition-colors">
                {item.id}
              </span>
            </div>

            {/* Card Content */}
            <div className="mt-auto">
              <span
                className={`font-label text-xs tracking-widest mb-2 block ${item.accent} opacity-80`}
              >
                {item.subtitle}
              </span>
              <h3 className="font-header text-3xl md:text-4xl text-[#F5F5F5] mb-4 leading-tight group-hover:tracking-wider transition-all duration-300">
                {item.title}
              </h3>
              <p className="font-body text-[#A1A1AA] text-sm md:text-base max-w-md leading-relaxed group-hover:text-[#F5F5F5] transition-colors">
                {item.description}
              </p>
            </div>

            {/* Hover Action */}
            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
              <ArrowUpRight className={`w-6 h-6 ${item.accent}`} />
            </div>

            {/* Decorative Corner Accent */}
            <div
              className={`absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 ${item.border} opacity-30`}
            />
          </motion.div>
        ))}
      </div>

      {/* Marquee Footer (Optional visual flair) */}
      <div className="mt-24 relative overflow-hidden h-16 border-y border-[#333333] flex items-center">
        <div className="flex whitespace-nowrap animate-marquee">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center mx-8">
              <span className="font-header text-2xl text-[#1A1A1A] uppercase tracking-widest mr-4">
                Acid Halloween 2024
              </span>
              <Music2 className="text-[#1A1A1A] w-6 h-6" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA Trigger */}
      <div className="max-w-7xl mx-auto mt-12 flex justify-end">
        <button className="group relative px-8 py-4 font-label font-bold uppercase tracking-widest overflow-hidden transition-all active:scale-95">
          <div
            className="absolute inset-0 bg-[#CCFF00] transition-transform duration-300 group-hover:translate-x-1 group-hover:translate-y-1"
            style={{ clipPath: OCTAGON_CLIP }}
          />
          <div
            className="absolute inset-0 bg-[#050505] border-2 border-[#CCFF00]"
            style={{ clipPath: OCTAGON_CLIP }}
          />
          <span className="relative z-10 text-[#CCFF00] group-hover:text-[#F5F5F5] transition-colors">
            View Full Timetable
          </span>
        </button>
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
("use client");

import React from "react";
import { motion } from "framer-motion";
import {
  Skull,
  Zap,
  Ghost,
  Eye,
  Biohazard,
  Monitor,
  ArrowUpRight,
  Music2,
  Radiation,
} from "lucide-react";

const OCTAGON_CLIP = "polygon(8% 0, 100% 0, 100% 92%, 92% 100%, 0 100%, 0 8%)";

const FEATURE_DATA = [
  {
    id: "01",
    title: "CYBER GHOUL",
    subtitle: "HEADLINER / LIVE SET",
    description:
      "Ultra-heavy industrial bass fused with necrotic synth-wave. A 2-hour immersive audio-visual assault.",
    icon: Skull,
    accent: "text-[#BF00FF]",
    border: "border-[#BF00FF]",
    shadow: "shadow-[0_0_20px_rgba(191,0,255,0.3)]",
    size: "md:col-span-7 md:row-span-2",
  },
  {
    id: "02",
    title: "ACID RAIN",
    subtitle: "VISUAL ARCHITECT",
    description:
      "Generative glitch art and real-time liquid light projections that melt the boundaries of reality.",
    icon: Zap,
    accent: "text-[#CCFF00]",
    border: "border-[#CCFF00]",
    shadow: "shadow-[0_0_15px_rgba(204,255,0,0.4)]",
    size: "md:col-span-5 md:row-span-1",
  },
  {
    id: "03",
    title: "VOID WALKER",
    subtitle: "DARK TECHNO",
    description:
      "Sub-atomic frequencies designed to resonate with the skeletal system. Enter the vacuum.",
    icon: Ghost,
    accent: "text-[#FF007F]",
    border: "border-[#FF007F]",
    shadow: "shadow-[0_0_20px_rgba(255,0,127,0.3)]",
    size: "md:col-span-5 md:row-span-1",
  },
  {
    id: "04",
    title: "NEON PHANTOM",
    subtitle: "SPECIAL GUEST",
    description:
      "The elusive master of high-bpm terror-core returns for a one-off midnight ritual.",
    icon: Eye,
    accent: "text-[#F5F5F5]",
    border: "border-[#333333]",
    shadow: "shadow-none",
    size: "md:col-span-4 md:row-span-1",
  },
  {
    id: "05",
    title: "TOXIC WASTE",
    subtitle: "IMMERSIVE DECOR",
    description:
      "Bio-luminescent environments and radioactive installations curated by the Waste Collective.",
    icon: Biohazard,
    accent: "text-[#CCFF00]",
    border: "border-[#CCFF00]",
    shadow: "shadow-[0_0_15px_rgba(204,255,0,0.2)]",
    size: "md:col-span-4 md:row-span-1",
  },
  {
    id: "06",
    title: "DIGITAL DECAY",
    subtitle: "LIVE CODING",
    description:
      "Algorithmic destruction. Witness the source code of the party being rewritten in real-time.",
    icon: Monitor,
    accent: "text-[#BF00FF]",
    border: "border-[#BF00FF]",
    shadow: "shadow-[0_0_20px_rgba(191,0,255,0.2)]",
    size: "md:col-span-4 md:row-span-1",
  },
];

export default function LineupSection() {
  return (
    <section className="relative w-full bg-[#050505] py-24 px-4 md:px-8 overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-grain pointer-events-none opacity-20" />
      <div className="absolute top-0 left-0 w-full h-full bg-scanlines pointer-events-none opacity-10" />

      {/* Section Header */}
      <div className="relative z-10 max-w-7xl mx-auto mb-16 md:mb-24">
        <div className="flex flex-col items-start -rotate-[-1deg] md:-ml-4">
          <span className="font-label text-[#CCFF00] text-sm md:text-base tracking-[0.3em] mb-4 flex items-center gap-2">
            <Radiation className="w-4 h-4 animate-spin-slow" />
            LIVE TRANSMISSION // OCT 31
          </span>
          <h2 className="font-header text-5xl md:text-8xl text-[#F5F5F5] leading-none uppercase tracking-tighter">
            THE{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#CCFF00] via-[#BF00FF] to-[#FF007F]">
              LINEUP
            </span>
          </h2>
        </div>
      </div>

      {/* Grid Container */}
      <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
        {FEATURE_DATA.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.01 }}
            className={`group relative flex flex-col bg-[#0A0A0A] border-2 ${item.border} ${item.size} p-6 md:p-8 transition-all duration-150 ${item.shadow}`}
            style={{ clipPath: OCTAGON_CLIP }}
          >
            {/* Grain Overlay */}
            <div className="absolute inset-0 bg-grain opacity-5 pointer-events-none" />

            {/* Card Header */}
            <div className="flex justify-between items-start mb-8">
              <div
                className={`p-3 bg-[#1A1A1A] border border-[#333333] transition-colors group-hover:bg-[#050505]`}
              >
                <item.icon
                  className={`w-8 h-8 ${item.accent} group-hover:scale-110 transition-transform duration-300`}
                />
              </div>
              <span className="font-label text-[#333333] group-hover:text-[#F5F5F5] transition-colors">
                {item.id}
              </span>
            </div>

            {/* Card Content */}
            <div className="mt-auto">
              <span
                className={`font-label text-xs tracking-widest mb-2 block ${item.accent} opacity-80`}
              >
                {item.subtitle}
              </span>
              <h3 className="font-header text-3xl md:text-4xl text-[#F5F5F5] mb-4 leading-tight group-hover:tracking-wider transition-all duration-300">
                {item.title}
              </h3>
              <p className="font-body text-[#A1A1AA] text-sm md:text-base max-w-md leading-relaxed group-hover:text-[#F5F5F5] transition-colors">
                {item.description}
              </p>
            </div>

            {/* Hover Action */}
            <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
              <ArrowUpRight className={`w-6 h-6 ${item.accent}`} />
            </div>

            {/* Decorative Corner Accent */}
            <div
              className={`absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 ${item.border} opacity-30`}
            />
          </motion.div>
        ))}
      </div>

      {/* Marquee Footer (Optional visual flair) */}
      <div className="mt-24 relative overflow-hidden h-16 border-y border-[#333333] flex items-center">
        <div className="flex whitespace-nowrap animate-marquee">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center mx-8">
              <span className="font-header text-2xl text-[#1A1A1A] uppercase tracking-widest mr-4">
                Acid Halloween 2024
              </span>
              <Music2 className="text-[#1A1A1A] w-6 h-6" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA Trigger */}
      <div className="max-w-7xl mx-auto mt-12 flex justify-end">
        <button className="group relative px-8 py-4 font-label font-bold uppercase tracking-widest overflow-hidden transition-all active:scale-95">
          <div
            className="absolute inset-0 bg-[#CCFF00] transition-transform duration-300 group-hover:translate-x-1 group-hover:translate-y-1"
            style={{ clipPath: OCTAGON_CLIP }}
          />
          <div
            className="absolute inset-0 bg-[#050505] border-2 border-[#CCFF00]"
            style={{ clipPath: OCTAGON_CLIP }}
          />
          <span className="relative z-10 text-[#CCFF00] group-hover:text-[#F5F5F5] transition-colors">
            View Full Timetable
          </span>
        </button>
      </div>
    </section>
  );
}
