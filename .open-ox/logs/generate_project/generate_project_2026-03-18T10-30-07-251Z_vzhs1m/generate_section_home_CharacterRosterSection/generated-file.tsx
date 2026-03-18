"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Zap,
  Target,
  Activity,
  ChevronRight,
  Info,
  Share2,
} from "lucide-react";

interface Character {
  id: string;
  name: string;
  alias: string;
  actor: string;
  image: string;
  color: string;
  stats: {
    power: number;
    agility: number;
    intellect: number;
    stamina: number;
  };
  description: string;
}

const characters: Character[] = [
  {
    id: "01",
    name: "Carol Danvers",
    alias: "Captain Marvel",
    actor: "Brie Larson",
    image:
      "https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&q=80&w=800",
    color: "#ED1D24",
    stats: { power: 98, agility: 85, intellect: 80, stamina: 95 },
    description:
      "One of the universe's most powerful heroes, Carol Danvers is a former U.S. Air Force fighter pilot whose DNA was fused with that of a Kree.",
  },
  {
    id: "02",
    name: "Peter Parker",
    alias: "Spider-Man",
    actor: "Tom Holland",
    image:
      "https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&q=80&w=800", // Placeholder as actual Marvel assets aren't available
    color: "#00D4FF",
    stats: { power: 75, agility: 99, intellect: 92, stamina: 88 },
    description:
      "A bite from a radioactive spider granted Peter Parker amazing arachnid-like powers, which he uses to protect his neighborhood.",
  },
  {
    id: "03",
    name: "Stephen Strange",
    alias: "Doctor Strange",
    actor: "Benedict Cumberbatch",
    image:
      "https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&q=80&w=800",
    color: "#ED1D24",
    stats: { power: 92, agility: 70, intellect: 98, stamina: 82 },
    description:
      "Formerly a renowned surgeon, Doctor Stephen Strange is now the Sorcerer Supreme, protecting Earth against magical and mystical threats.",
  },
  {
    id: "04",
    name: "Natasha Romanoff",
    alias: "Black Widow",
    actor: "Scarlett Johansson",
    image:
      "https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&q=80&w=800",
    color: "#C0C0C0",
    stats: { power: 65, agility: 96, intellect: 90, stamina: 92 },
    description:
      "A highly trained former KGB assassin and agent of S.H.I.E.L.D., Natasha Romanoff is one of the world's most lethal spies.",
  },
];

const StatBar = ({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
}) => (
  <div className="space-y-1">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        <Icon size={12} className="text-mutedForeground" />
        <span className="font-label text-[10px] tracking-widest text-mutedForeground">
          {label}
        </span>
      </div>
      <span className="font-label text-[10px] text-white">{value}%</span>
    </div>
    <div className="h-1 w-full bg-white/5 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${value}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="h-full"
        style={{ backgroundColor: color }}
      />
    </div>
  </div>
);

export default function CharacterRosterSection() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <section className="relative py-24 md:py-32 bg-[#050505] overflow-hidden">
      {/* Background Textures */}
      <div
        className="absolute inset-0 z-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 0)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Decorative Slashes */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#ED1D24]/5 blur-[120px] rounded-full" />
      <div className="absolute top-1/2 -left-48 w-[800px] h-2 bg-[#ED1D24]/10 -rotate-[15deg] z-0" />
      <div className="absolute top-1/3 -right-48 w-[600px] h-1 bg-[#00D4FF]/10 -rotate-[15deg] z-0" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="mb-16 md:mb-24 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
            >
              <span className="font-label text-xs tracking-[0.3em] text-[#ED1D24] mb-4 block">
                PERSONNEL DOSSIER // PHASE FIVE
              </span>
              <h2 className="font-display text-6xl md:text-8xl text-white uppercase leading-none tracking-tighter">
                Assemble The{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/20">
                  Ensemble
                </span>
              </h2>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="hidden md:block text-right"
          >
            <p className="font-body text-mutedForeground max-w-xs text-sm leading-relaxed mb-4">
              Access classified biological data and combat efficiency ratings
              for active field operatives.
            </p>
            <div className="flex justify-end gap-2">
              <div className="w-12 h-1 bg-[#ED1D24]" />
              <div className="w-4 h-1 bg-white/20" />
              <div className="w-4 h-1 bg-white/20" />
            </div>
          </motion.div>
        </div>

        {/* Character Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {characters.map((char, index) => (
            <motion.div
              key={char.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              onMouseEnter={() => setHoveredId(char.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="group relative aspect-[2/3] cursor-pointer"
            >
              {/* Card Container */}
              <div
                className="absolute inset-0 bg-[#121212] border border-white/10 transition-all duration-500 group-hover:border-[#00D4FF]/50 overflow-hidden"
                style={{
                  clipPath:
                    "polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0% 30%)",
                }}
              >
                {/* Image Layer */}
                <div className="absolute inset-0 z-0 grayscale group-hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-110">
                  <Image
                    src={char.image}
                    alt={char.alias}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                </div>

                {/* Scanline Overlay */}
                <div
                  className="absolute inset-0 z-10 opacity-20 pointer-events-none group-hover:opacity-40 transition-opacity"
                  style={{
                    background:
                      "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.03), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.03))",
                    backgroundSize: "100% 2px, 3px 100%",
                  }}
                />

                {/* Content Overlay */}
                <div className="absolute inset-0 z-20 p-8 flex flex-col justify-end">
                  {/* ID Badge */}
                  <div className="absolute top-8 left-8">
                    <span className="font-label text-[10px] text-white/40 tracking-widest block">
                      REF_ID: {char.id}
                    </span>
                  </div>

                  <div className="transform transition-transform duration-500 group-hover:-translate-y-4">
                    <h3 className="font-header text-2xl text-white italic uppercase leading-none mb-1 group-hover:text-[#00D4FF] transition-colors">
                      {char.alias}
                    </h3>
                    <p className="font-label text-[10px] text-mutedForeground tracking-[0.2em] uppercase">
                      {char.actor}
                    </p>
                  </div>

                  {/* Expanded Stats (Hover Only) */}
                  <AnimatePresence>
                    {hoveredId === char.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4 mt-4 pt-4 border-t border-white/10"
                      >
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          <StatBar
                            label="PWR"
                            value={char.stats.power}
                            icon={Zap}
                            color={char.color}
                          />
                          <StatBar
                            label="AGL"
                            value={char.stats.agility}
                            icon={Activity}
                            color={char.color}
                          />
                          <StatBar
                            label="INT"
                            value={char.stats.intellect}
                            icon={Target}
                            color={char.color}
                          />
                          <StatBar
                            label="STM"
                            value={char.stats.stamina}
                            icon={Shield}
                            color={char.color}
                          />
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <button className="flex items-center gap-2 text-[#00D4FF] font-label text-[10px] tracking-widest hover:brightness-125 transition-all">
                            VIEW DOSSIER <ChevronRight size={12} />
                          </button>
                          <div className="flex gap-3">
                            <Share2
                              size={14}
                              className="text-white/40 hover:text-white cursor-pointer transition-colors"
                            />
                            <Info
                              size={14}
                              className="text-white/40 hover:text-white cursor-pointer transition-colors"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Corner Accents */}
                <div
                  className="absolute bottom-0 right-0 w-16 h-16 bg-[#ED1D24] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
                />
              </div>

              {/* Glowing Background Effect */}
              <div className="absolute -inset-2 bg-[#00D4FF]/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA Area */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-20 flex flex-col items-center"
        >
          <div className="inline-flex items-center gap-4 px-6 py-3 bg-[#1A1A1A] border border-white/5 font-label text-[10px] tracking-[0.3em] text-mutedForeground uppercase">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            Full Database Access Required for Classied Files
          </div>

          <button className="mt-8 group relative px-12 py-5 overflow-hidden transition-all duration-300">
            <div
              className="absolute inset-0 bg-[#ED1D24] transition-transform duration-300 group-hover:scale-105"
              style={{
                clipPath:
                  "polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0% 30%)",
              }}
            />
            <div className="relative flex items-center gap-3">
              <span className="font-display text-2xl text-white uppercase tracking-wider">
                Expand Roster
              </span>
              <ChevronRight className="text-white group-hover:translate-x-1 transition-transform" />
            </div>
            {/* Red Glow */}
            <div className="absolute inset-0 shadow-[0_0_20px_rgba(237,29,36,0.4)] opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </motion.div>
      </div>

      {/* Side Decorative Text */}
      <div className="absolute top-1/2 -left-12 -translate-y-1/2 rotate-90 hidden lg:block">
        <span className="font-label text-[10px] text-white/10 tracking-[1em] uppercase whitespace-nowrap">
          S.H.I.E.L.D. PROTOCOL // LEVEL 7 CLEARANCE
        </span>
      </div>
      <div className="absolute top-1/2 -right-12 -translate-y-1/2 -rotate-90 hidden lg:block">
        <span className="font-label text-[10px] text-white/10 tracking-[1em] uppercase whitespace-nowrap">
          AVENGERS INITIATIVE // ENSEMBLE_V5
        </span>
      </div>
    </section>
  );
}
