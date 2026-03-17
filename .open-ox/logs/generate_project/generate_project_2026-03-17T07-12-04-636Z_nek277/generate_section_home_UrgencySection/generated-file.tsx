"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Activity, Zap } from "lucide-react";

const calculateTimeLeft = () => {
  const targetDate = new Date("2024-10-31T00:00:00");
  const now = new Date();
  const difference = targetDate.getTime() - now.getTime();

  let timeLeft = {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  };

  if (difference > 0) {
    timeLeft = {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  }

  return timeLeft;
};

const GlitchText = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => {
  return (
    <div className={`relative inline-block ${className}`}>
      <span className="relative z-10">{text}</span>
      <motion.span
        animate={{
          x: [0, -2, 2, -1, 0],
          opacity: [0, 0.5, 0.2, 0.5, 0],
        }}
        transition={{
          repeat: Infinity,
          duration: 0.2,
          ease: "steps(2)",
        }}
        className="absolute top-0 left-0 z-0 text-[#FF007F] select-none pointer-events-none"
      >
        {text}
      </motion.span>
      <motion.span
        animate={{
          x: [0, 2, -2, 1, 0],
          opacity: [0, 0.4, 0.1, 0.4, 0],
        }}
        transition={{
          repeat: Infinity,
          duration: 0.25,
          ease: "steps(2)",
          delay: 0.1,
        }}
        className="absolute top-0 left-0 z-0 text-[#BF00FF] select-none pointer-events-none"
      >
        {text}
      </motion.span>
    </div>
  );
};

const TimeUnit = ({
  value,
  label,
  color = "#CCFF00",
}: {
  value: number;
  label: string;
  color?: string;
}) => {
  const displayValue = value.toString().padStart(2, "0");

  return (
    <div className="flex flex-col items-center group">
      <div
        className="relative bg-[#0A0A0A] border-2 border-[#333333] p-4 md:p-8 min-w-[100px] md:min-w-[160px] flex items-center justify-center overflow-hidden"
        style={{
          clipPath: "polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)",
        }}
      >
        {/* Grain Overlay */}
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] contrast-150 brightness-100" />

        {/* Scanlines Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,255,0,0.06))] bg-[length:100%_2px,3px_100%]" />

        <AnimatePresence mode="wait">
          <motion.span
            key={value}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.1, ease: [0.19, 1, 0.22, 1] }}
            className="font-header text-5xl md:text-7xl lg:text-8xl tracking-tighter relative z-10"
            style={{
              color,
              textShadow:
                value % 2 === 0 ? "0 0 15px rgba(204, 255, 0, 0.4)" : "none",
            }}
          >
            {displayValue}
          </motion.span>
        </AnimatePresence>

        {/* Decorative corner accent */}
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#CCFF00] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
      </div>
      <span className="font-label text-xs md:text-sm tracking-[0.3em] mt-4 text-[#A1A1AA] uppercase">
        {label}
      </span>
    </div>
  );
};

export default function UrgencySection() {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!isMounted) return null;

  return (
    <section className="relative py-24 px-6 bg-[#050505] overflow-hidden selection:bg-[#CCFF00] selection:text-[#050505]">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border-[1px] border-[#CCFF00] rotate-12" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] border-[1px] border-[#BF00FF] -rotate-6" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Top Metadata Bar */}
        <div className="flex flex-wrap items-center justify-between mb-12 border-b border-[#333333] pb-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[#FF007F] animate-pulse" />
            <span className="font-label text-xs md:text-sm tracking-widest text-[#F5F5F5]">
              SYSTEM STATUS:{" "}
              <span className="text-[#FF007F]">CRITICAL_URGENCY</span>
            </span>
          </div>
          <div className="flex items-center gap-6 font-label text-[10px] md:text-xs text-[#A1A1AA] tracking-[0.2em]">
            <span className="flex items-center gap-2">
              <Activity size={14} className="text-[#CCFF00]" />
              LATENCY: 14MS
            </span>
            <span className="hidden md:flex items-center gap-2">
              <Zap size={14} className="text-[#BF00FF]" />
              GRID_SYNC: ACTIVE
            </span>
            <span className="flex items-center gap-2 text-[#F5F5F5]">
              <AlertTriangle size={14} className="text-[#FF007F]" />
              OCT 31 DEADLINE
            </span>
          </div>
        </div>

        {/* Main Header Content */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div className="max-w-2xl">
            <h2 className="font-header text-5xl md:text-7xl lg:text-8xl uppercase tracking-tighter leading-[0.85] mb-6">
              The Void <br />
              <span className="text-[#CCFF00] italic">Is Opening</span>
            </h2>
            <p className="font-body text-[#A1A1AA] text-lg max-w-md border-l-2 border-[#BF00FF] pl-6 py-2 italic">
              The digital threshold dissolves in precisely:
            </p>
          </div>

          <div className="hidden lg:block text-right">
            <div className="font-label text-xs text-[#333333] mb-2 uppercase">
              Checksum: 0x882_HALLOWEEN
            </div>
            <div className="p-4 border-2 border-[#333333] inline-block rotate-3 hover:rotate-0 transition-transform duration-300">
              <GlitchText
                text="DONT_LOOK_BACK"
                className="font-header text-xl text-[#F5F5F5]"
              />
            </div>
          </div>
        </div>

        {/* Countdown Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 mb-20">
          <TimeUnit value={timeLeft.days} label="Days" color="#F5F5F5" />
          <TimeUnit value={timeLeft.hours} label="Hours" color="#F5F5F5" />
          <TimeUnit value={timeLeft.minutes} label="Mins" color="#CCFF00" />
          <TimeUnit value={timeLeft.seconds} label="Secs" color="#FF007F" />
        </div>

        {/* Action Footer */}
        <div className="flex flex-col items-center justify-center pt-8 border-t border-[#333333]">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group relative px-12 py-6 font-label font-bold text-xl uppercase tracking-widest bg-[#CCFF00] text-[#050505] transition-all duration-200"
            style={{
              clipPath:
                "polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)",
            }}
          >
            <span className="relative z-10 flex items-center gap-3">
              Secure Access Now
              <motion.span
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                →
              </motion.span>
            </span>
            {/* Hover Shadow Effect */}
            <div className="absolute inset-0 bg-[#BF00FF] translate-x-0 translate-y-0 group-hover:translate-x-2 group-hover:translate-y-2 -z-10 transition-transform duration-200" />
          </motion.button>

          <p className="mt-8 font-label text-[10px] md:text-xs text-[#333333] tracking-widest text-center uppercase">
            Warning: Access tokens are limited. System failure imminent after
            countdown completion.
          </p>
        </div>
      </div>

      {/* Extreme Decorative Elements */}
      <div className="absolute bottom-10 right-10 opacity-20 hidden xl:block">
        <div className="font-header text-[12rem] text-[#1A1A1A] leading-none select-none">
          31
        </div>
      </div>

      <div className="absolute top-1/2 -left-20 -translate-y-1/2 opacity-10 rotate-90 hidden xl:block">
        <div className="font-label text-6xl text-[#CCFF00] tracking-[1em] whitespace-nowrap">
          URGENT_URGENT_URGENT
        </div>
      </div>
    </section>
  );
}
