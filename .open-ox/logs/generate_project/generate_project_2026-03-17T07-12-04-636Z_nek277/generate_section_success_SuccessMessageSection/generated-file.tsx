"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Share2,
  Download,
  MapPin,
  Clock,
  Ticket,
  CheckCircle2,
} from "lucide-react";

/**
 * SuccessMessageSection
 * A high-impact confirmation section for the Acid Halloween experience.
 * Features glitch typography, a scannability-optimized QR code, and brutalist UI elements.
 */
export default function SuccessMessageSection() {
  // Glitch variants for Framer Motion to simulate the "energetic" motion profile
  const glitchVariants = {
    initial: { x: 0, y: 0 },
    animate: {
      x: [-2, 2, -1, 1, 0],
      y: [1, -1, 2, -2, 0],
      transition: {
        duration: 0.2,
        repeat: Infinity,
        repeatType: "mirror" as const,
        ease: "steps(2)",
      },
    },
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.19, 1, 0.22, 1],
        staggerChildren: 0.1,
      },
    },
  };

  return (
    <section className="relative min-h-screen w-full bg-[#050505] py-24 px-6 overflow-hidden flex flex-col items-center justify-center">
      {/* Background Textures */}
      <div className="absolute inset-0 bg-grain opacity-40 pointer-events-none" />
      <div className="absolute inset-0 bg-scanlines opacity-20 pointer-events-none" />

      {/* Ambient Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#CCFF00] rounded-full blur-[120px] opacity-10" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[#BF00FF] rounded-full blur-[120px] opacity-10" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-3xl mx-auto text-center"
      >
        {/* Eyebrow Label */}
        <motion.div variants={containerVariants} className="mb-6">
          <span className="font-label text-xs md:text-sm tracking-[0.3em] text-[#CCFF00] bg-[#1A1A1A] px-4 py-2 inline-block border border-[#333333]">
            TRANSACTION_COMPLETE // ACCESS_GRANTED
          </span>
        </motion.div>

        {/* Main Heading with Glitch Effect */}
        <motion.div variants={containerVariants} className="relative mb-8">
          <h1 className="font-display text-5xl md:text-8xl uppercase tracking-tighter text-[#F5F5F5] leading-none">
            YOU&apos;RE IN <br />
            <span className="relative inline-block">
              THE VOID
              <motion.span
                variants={glitchVariants}
                initial="initial"
                animate="animate"
                className="absolute inset-0 text-[#FF007F] opacity-70 mix-blend-screen translate-x-[2px]"
                aria-hidden="true"
              >
                THE VOID
              </motion.span>
              <motion.span
                variants={glitchVariants}
                initial="initial"
                animate="animate"
                className="absolute inset-0 text-[#BF00FF] opacity-70 mix-blend-screen -translate-x-[2px]"
                aria-hidden="true"
              >
                THE VOID
              </motion.span>
            </span>
          </h1>
        </motion.div>

        {/* Status Badge */}
        <motion.div
          variants={containerVariants}
          className="flex justify-center items-center gap-3 mb-12"
        >
          <div className="h-[2px] w-12 bg-[#333333]" />
          <div className="flex items-center gap-2 text-[#CCFF00] font-label text-sm">
            <CheckCircle2 size={18} />
            <span className="tracking-widest">CONFIRMED</span>
          </div>
          <div className="h-[2px] w-12 bg-[#333333]" />
        </motion.div>

        {/* Ticket Card */}
        <motion.div
          variants={containerVariants}
          className="relative group mb-12"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-[#CCFF00] via-[#BF00FF] to-[#FF007F] opacity-30 blur-md group-hover:opacity-60 transition duration-500" />
          <div className="relative bg-[#0A0A0A] border border-[#333333] p-8 md:p-12 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#CCFF00]/5 -mr-16 -mt-16 rounded-full blur-3xl" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              {/* QR Code Section */}
              <div className="flex flex-col items-center justify-center space-y-4">
                <div
                  className="bg-white p-4 aspect-square w-48 md:w-56 flex items-center justify-center shadow-[0_0_30px_rgba(204,255,0,0.2)]"
                  style={{
                    clipPath:
                      "polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)",
                  }}
                >
                  {/* Simulated QR Code Pattern */}
                  <div className="w-full h-full bg-[#050505] flex items-center justify-center overflow-hidden p-1">
                    <div className="grid grid-cols-6 gap-1 w-full h-full opacity-90">
                      {Array.from({ length: 36 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-full h-full ${Math.random() > 0.4 ? "bg-white" : "bg-transparent"}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="font-label text-[10px] text-mutedForeground tracking-[0.2em]">
                  SCAN AT ENTRANCE // ID REQUIRED
                </p>
              </div>

              {/* Details Section */}
              <div className="text-left space-y-6">
                <div>
                  <label className="font-label text-xs text-[#CCFF00] tracking-widest block mb-1">
                    TICKET_ID
                  </label>
                  <p className="font-header text-2xl text-[#F5F5F5] tracking-tight">
                    #ACID-2024-88X2
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-start gap-3">
                    <MapPin
                      size={20}
                      className="text-[#BF00FF] mt-1 shrink-0"
                    />
                    <div>
                      <label className="font-label text-[10px] text-mutedForeground tracking-widest block">
                        LOCATION
                      </label>
                      <p className="font-body text-sm text-[#F5F5F5]">
                        THE UNDERGROUND WAREHOUSE
                        <br />
                        SECTOR 7, INDUSTRIAL DISTRICT
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock size={20} className="text-[#BF00FF] mt-1 shrink-0" />
                    <div>
                      <label className="font-label text-[10px] text-mutedForeground tracking-widest block">
                        TIME
                      </label>
                      <p className="font-body text-sm text-[#F5F5F5]">
                        OCT 31, 2024 | 22:00 — LATE
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#333333]">
                  <p className="font-label text-[10px] text-mutedForeground">
                    HOLDER:{" "}
                    <span className="text-[#F5F5F5]">VALUED_REBEL_01</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          variants={containerVariants}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <button
            className="group relative w-full sm:w-auto px-8 py-4 font-label font-bold uppercase tracking-widest text-[#050505] bg-[#CCFF00] transition-all duration-200 active:scale-95 overflow-hidden"
            style={{
              clipPath:
                "polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)",
            }}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <Download size={18} />
              Save Ticket
            </span>
            <div className="absolute inset-0 bg-[#BF00FF] translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          </button>

          <button
            className="w-full sm:w-auto px-8 py-4 font-label font-bold uppercase tracking-widest text-[#CCFF00] border-2 border-[#CCFF00] bg-transparent hover:bg-[#CCFF00] hover:text-[#050505] transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
            style={{
              clipPath:
                "polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)",
            }}
          >
            <Calendar size={18} />
            Add to Calendar
          </button>

          <button
            className="w-full sm:w-auto px-8 py-4 font-label font-bold uppercase tracking-widest text-[#F5F5F5] border-2 border-[#333333] hover:border-[#BF00FF] transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
            style={{
              clipPath:
                "polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)",
            }}
          >
            <Share2 size={18} />
            Share
          </button>
        </motion.div>

        {/* Footer Support Link */}
        <motion.div variants={containerVariants} className="mt-16">
          <p className="font-body text-sm text-mutedForeground">
            Issues with your booking?{" "}
            <a
              href="#"
              className="text-[#CCFF00] underline underline-offset-4 hover:text-[#BF00FF] transition-colors"
            >
              Contact the Void Tech Support
            </a>
          </p>
        </motion.div>
      </motion.div>

      {/* Marquee Background Element (Subtle) */}
      <div className="absolute bottom-10 left-0 w-full overflow-hidden whitespace-nowrap opacity-5 select-none pointer-events-none">
        <div className="animate-marquee inline-block">
          <span className="font-header text-9xl uppercase mx-4">
            ACID HALLOWEEN 2024
          </span>
          <span className="font-header text-9xl uppercase mx-4">
            ACID HALLOWEEN 2024
          </span>
          <span className="font-header text-9xl uppercase mx-4">
            ACID HALLOWEEN 2024
          </span>
        </div>
      </div>

      <style jsx global>{`
        @keyframes marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </section>
  );
}
