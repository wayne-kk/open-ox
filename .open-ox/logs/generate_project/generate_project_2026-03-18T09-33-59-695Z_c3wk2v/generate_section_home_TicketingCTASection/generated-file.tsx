"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Ticket,
  Mail,
  MapPin,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function TicketingCTASection() {
  const [zipCode, setZipCode] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);

  return (
    <section className="relative w-full overflow-hidden py-24 md:py-32 lg:py-40 bg-[#FDFBF7]">
      {/* Paper Grain Overlay */}
      <div className="absolute inset-0 z-50 pointer-events-none opacity-40 bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')]" />

      {/* Decorative Sunset Watercolor Background */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute bottom-0 left-0 w-full h-full opacity-60"
          style={{
            background: "linear-gradient(to top, #E9806E 0%, #FDFBF7 70%)",
            clipPath: "ellipse(120% 60% at 50% 100%)",
          }}
        />

        {/* Drifting Watercolor Blobs */}
        <motion.div
          animate={{
            x: [0, 30, 0],
            y: [0, -20, 0],
            rotate: [0, 5, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-20 -right-20 w-96 h-96 bg-[#7DB9B6] opacity-10 blur-[100px] rounded-full"
        />
        <motion.div
          animate={{
            x: [0, -40, 0],
            y: [0, 30, 0],
            rotate: [0, -8, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 -left-20 w-[500px] h-[500px] bg-[#4A7C59] opacity-10 blur-[120px] rounded-full"
        />
      </div>

      <div className="relative z-10 container mx-auto px-6">
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
          {/* Eyebrow Label */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-6"
          >
            <span className="font-['Montserrat',_sans-serif] text-xs md:text-sm font-bold tracking-[0.3em] uppercase text-[#4A7C59] bg-[#4A7C59]/10 px-4 py-2 rounded-full inline-block">
              A Cinematic Journey Awaits
            </span>
          </motion.div>

          {/* Main Title */}
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="font-['Cormorant_Garamond',_serif] text-5xl md:text-7xl lg:text-8xl font-light tracking-tight text-[#2D302E] italic mb-8"
          >
            The Light of the <br className="hidden md:block" /> Hidden Valley
          </motion.h2>

          {/* Subheading/Release Date */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mb-12"
          >
            <p className="font-['Playfair_Display',_serif] text-2xl md:text-3xl font-medium text-[#707571]">
              In Theaters Everywhere{" "}
              <span className="text-[#E9806E]">August 12, 2024</span>
            </p>
          </motion.div>

          {/* Search/Ticketing Box */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.6 }}
            className="w-full max-w-2xl bg-[#F5F0E6] p-4 md:p-8 rounded-[24px] shadow-[0_2px_5px_rgba(0,0,0,0.05),_0_10px_20px_rgba(0,0,0,0.02)] border border-[#D9D2C5] relative"
          >
            {/* Hand-drawn accent lines */}
            <div className="absolute -top-4 -right-4 text-[#7DB9B6] opacity-40">
              <Sparkles size={48} />
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-stretch">
              <div className="relative flex-grow group">
                <label
                  htmlFor="zip-search"
                  className="absolute -top-6 left-2 font-['Montserrat',_sans-serif] text-[10px] uppercase font-bold tracking-widest text-[#707571]"
                >
                  Find a Theater Near You
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-[#707571] w-5 h-5" />
                  <input
                    id="zip-search"
                    type="text"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="Enter City or Zip Code"
                    className="w-full pl-12 pr-4 py-4 bg-[#F0EDE5] border-b-2 border-[#D9D2C5] focus:border-[#7DB9B6] outline-none font-['Quicksand',_sans-serif] text-lg transition-all duration-300 placeholder:text-[#707571]/50"
                  />
                </div>
              </div>

              <button className="bg-[#4A7C59] text-[#FDFBF7] font-['Montserrat',_sans-serif] font-bold uppercase tracking-widest px-8 py-4 rounded-full flex items-center justify-center gap-3 transition-all duration-500 ease-out hover:bg-[#3E674A] hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(74,124,89,0.35)] group">
                <Ticket className="w-5 h-5 transition-transform group-hover:rotate-12" />
                <span>Get Tickets</span>
              </button>
            </div>

            <p className="mt-6 font-['Quicksand',_sans-serif] text-sm text-[#707571] italic">
              * IMAX and 3D screenings available in select locations.
            </p>
          </motion.div>

          {/* Secondary Action: Newsletter */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 1 }}
            className="mt-16 flex flex-col items-center gap-6"
          >
            <div className="h-px w-24 bg-[#D9D2C5]" />

            <AnimatePresence mode="wait">
              {!isSubscribed ? (
                <motion.button
                  key="subscribe-btn"
                  onClick={() => setIsSubscribed(true)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-[#707571] font-['Montserrat',_sans-serif] text-xs font-bold uppercase tracking-widest hover:text-[#4A7C59] transition-colors group"
                >
                  <Mail className="w-4 h-4 group-hover:animate-bounce" />
                  <span>Notify me of new screenings</span>
                  <ArrowRight className="w-4 h-4 translate-x-0 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              ) : (
                <motion.p
                  key="success-msg"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-['Quicksand',_sans-serif] text-[#4A7C59] font-semibold"
                >
                  You're on the list! We'll send the magic your way soon.
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Asymmetric Artistic Elements */}
      <div className="absolute bottom-10 right-10 opacity-20 hidden lg:block">
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M50 150C80 120 120 180 150 150C180 120 120 80 150 50"
            stroke="#4A7C59"
            strokeWidth="2"
            strokeLinecap="round"
            className="animate-[drift_10s_ease-in-out_infinite]"
          />
        </svg>
      </div>

      <div className="absolute top-20 left-10 opacity-10 hidden lg:block">
        <div className="w-32 h-32 border-2 border-[#7DB9B6] rounded-full rotate-45 transform -translate-x-1/2" />
        <div className="w-32 h-32 border-2 border-[#E9806E] rounded-full -rotate-12 transform translate-x-4 -translate-y-8" />
      </div>

      <style jsx global>{`
        @keyframes float {
          0% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-15px) rotate(2deg);
          }
          100% {
            transform: translateY(0px) rotate(0deg);
          }
        }
        @keyframes drift {
          0% {
            stroke-dashoffset: 0;
            opacity: 0.2;
          }
          50% {
            stroke-dashoffset: 50;
            opacity: 0.5;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 0.2;
          }
        }
      `}</style>
    </section>
  );
}
