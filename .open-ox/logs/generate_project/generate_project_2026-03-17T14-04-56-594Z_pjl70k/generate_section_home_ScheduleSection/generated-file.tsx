"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Cpu,
  Ghost,
  Skull,
  Clock,
  ChevronRight,
  Terminal,
} from "lucide-react";

const events = [
  {
    time: "20:00",
    label: "ACCESS GRANTED",
    title: "Doors Open",
    description:
      "Initialize your neural link. Early bird arrivals receive a limited-edition hardware badge and welcome stimulant.",
    icon: Zap,
    color: "text-[#00F3FF]",
    glow: "shadow-[0_0_15px_rgba(0,243,255,0.4)]",
    borderColor: "border-[#00F3FF]/30",
  },
  {
    time: "21:30",
    label: "SYSTEM SYNC",
    title: "AI Ritual",
    description:
      "A generative audio-visual performance where the crowd's biometric data controls the atmospheric resonance.",
    icon: Cpu,
    color: "text-[#FF00FF]",
    glow: "shadow-[0_0_15px_rgba(255,0,255,0.4)]",
    borderColor: "border-[#FF00FF]/30",
  },
  {
    time: "23:00",
    label: "PROTOCOL V0ID",
    title: "Costume Battle",
    description:
      "Upload your physical form. The best cybernetic enhancements and high-tech horror ensembles compete for the grand bounty.",
    icon: Ghost,
    color: "text-[#BCFF00]",
    glow: "shadow-[0_0_15px_rgba(188,255,0,0.4)]",
    borderColor: "border-[#BCFF00]/30",
  },
  {
    time: "01:00",
    label: "CRITICAL FAILURE",
    title: "Midnight Glitch",
    description:
      "Total system collapse. The main stage enters an overclocked state with high-frequency bass and strobe-heavy visuals.",
    icon: Skull,
    color: "text-[#FF3131]",
    glow: "shadow-[0_0_15px_rgba(255,49,49,0.4)]",
    borderColor: "border-[#FF3131]/30",
  },
];

export default function ScheduleSection() {
  return (
    <section className="relative py-24 bg-[#050505] overflow-hidden">
      {/* Background Textures */}
      <div className="absolute inset-0 bg-cyber-grid opacity-20 pointer-events-none" />
      <div className="absolute inset-0 bg-scanlines opacity-10 pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="mb-20 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex items-center gap-3 mb-4"
          >
            <Terminal className="w-5 h-5 text-[#00F3FF]" />
            <span className="font-label text-xs tracking-[0.3em] text-[#00F3FF] uppercase">
              Event Chronology // 2024.10.31
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-header text-4xl md:text-6xl text-[#E0E0E0] tracking-widest uppercase mb-6"
          >
            The Timeline <span className="text-[#FF00FF] italic">of Chaos</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="font-body text-[#88888F] text-lg leading-relaxed"
          >
            Follow the sequence. Every hour brings a deeper descent into the
            neon void. Do not disconnect until the protocol is complete.
          </motion.p>
        </div>

        {/* Timeline Container */}
        <div className="relative">
          {/* Vertical Central Line */}
          <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-[#00F3FF] via-[#FF00FF] to-[#BCFF00] md:-translate-x-1/2 opacity-30" />

          {/* Timeline Nodes */}
          <div className="space-y-12 md:space-y-0">
            {events.map((event, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={`relative flex flex-col md:flex-row items-start ${
                  index % 2 === 0 ? "md:flex-row-reverse" : ""
                }`}
              >
                {/* Node Dot */}
                <div className="absolute left-8 md:left-1/2 w-4 h-4 rounded-full bg-[#050505] border-2 border-current md:-translate-x-1/2 top-8 z-20 flex items-center justify-center">
                  <div
                    className={`w-1.5 h-1.5 rounded-full bg-white animate-pulse ${event.color}`}
                  />
                </div>

                {/* Content Card */}
                <div
                  className={`w-full md:w-5/12 ml-16 md:ml-0 ${index % 2 === 0 ? "md:pr-16" : "md:pl-16"}`}
                >
                  <div
                    className={`group relative p-6 bg-[#0D0D0F] border ${event.borderColor} clip-cyber transition-all duration-300 hover:bg-[#121214] hover:border-opacity-100 ${event.glow}`}
                  >
                    {/* Corner Accent */}
                    <div
                      className={`absolute top-0 right-0 w-8 h-[1px] ${index % 2 === 0 ? "bg-[#00F3FF]" : "bg-[#FF00FF]"}`}
                    />

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <event.icon className={`w-6 h-6 ${event.color}`} />
                        <span
                          className={`font-label text-xs tracking-widest ${event.color}`}
                        >
                          {event.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 font-label text-sm text-[#E0E0E0]">
                        <Clock className="w-3 h-3 text-[#88888F]" />
                        {event.time}
                      </div>
                    </div>

                    <h3 className="font-header text-2xl text-[#E0E0E0] mb-3 uppercase tracking-wider group-hover:text-white transition-colors">
                      {event.title}
                    </h3>

                    <p className="font-body text-[#88888F] text-sm md:text-base leading-relaxed mb-4">
                      {event.description}
                    </p>

                    <button className="flex items-center gap-2 font-label text-[10px] text-[#00F3FF] uppercase tracking-[0.2em] group/btn">
                      <span>Expand Protocol</span>
                      <ChevronRight className="w-3 h-3 transition-transform group-hover/btn:translate-x-1" />
                    </button>
                  </div>
                </div>

                {/* Spacer for MD screens */}
                <div className="hidden md:block md:w-2/12" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom Decorative Element */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-24 flex flex-col items-center justify-center text-center"
        >
          <div className="w-px h-16 bg-gradient-to-b from-[#BCFF00] to-transparent mb-6" />
          <p className="font-label text-[10px] text-[#4A4A4F] tracking-[0.5em] uppercase">
            End of Transmission // Stay Synchronized
          </p>
        </motion.div>
      </div>

      {/* Side Data Decorative Elements */}
      <div className="hidden lg:block absolute left-10 top-1/2 -translate-y-1/2 space-y-4 opacity-20">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`h-[1px] bg-[#00F3FF]`}
              style={{ width: `${Math.random() * 40 + 20}px` }}
            />
            <div className="w-1 h-1 rounded-full bg-[#00F3FF]" />
          </div>
        ))}
      </div>

      <div className="hidden lg:block absolute right-10 top-1/2 -translate-y-1/2 space-y-4 opacity-20">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-2 flex-row-reverse">
            <div
              className={`h-[1px] bg-[#FF00FF]`}
              style={{ width: `${Math.random() * 40 + 20}px` }}
            />
            <div className="w-1 h-1 rounded-full bg-[#FF00FF]" />
          </div>
        ))}
      </div>
    </section>
  );
}
