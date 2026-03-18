"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Leaf,
  Wind,
  Trees,
  Instagram,
  Twitter,
  Youtube,
  Mail,
  ArrowRight,
  Sparkles,
} from "lucide-react";

/**
 * GlobalFooterSection
 *
 * A Ghibli-inspired footer that serves as a grounding anchor for the site.
 * Features a hand-painted "rolling hills" top border, a thematic newsletter
 * signup, and studio-focused navigation.
 */
export default function GlobalFooterSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    // Simulate a gentle Ghibli-style transition
    setTimeout(() => setStatus("success"), 1500);
  };

  return (
    <footer className="relative w-full overflow-hidden bg-[#FDFBF7] pt-24">
      {/* Hand-painted Hill Border Decoration */}
      <div className="absolute top-0 left-0 w-full overflow-hidden leading-[0] translate-y-[-95%] pointer-events-none">
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="relative block w-[calc(130%+1.3px)] h-[120px] fill-[#4A7C59]"
        >
          <path d="M0,0 C150,90 400,10 600,70 C800,130 1050,40 1200,100 L1200,120 L0,120 Z"></path>
        </svg>
      </div>

      {/* Main Footer Body with Forest Canopy background */}
      <div className="relative bg-[#4A7C59] text-[#FDFBF7] pb-12 px-6 md:px-12 lg:px-24">
        {/* Paper Grain Overlay */}
        <div className="absolute inset-0 bg-paper-grain opacity-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 relative z-10">
          {/* Column 1: Studio Identity */}
          <div className="lg:col-span-4 space-y-8">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Trees className="w-10 h-10 text-[#7DB9B6]" />
                <motion.div
                  animate={{
                    rotate: [0, 10, 0],
                    y: [0, -2, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute -top-1 -right-1"
                >
                  <Sparkles className="w-4 h-4 text-[#E9806E]" />
                </motion.div>
              </div>
              <div>
                <span className="block font-header text-2xl tracking-wide">
                  Studio Komorebi
                </span>
                <span className="block font-label text-[10px] tracking-[0.3em] opacity-80">
                  EST. 1994 • TOKYO
                </span>
              </div>
            </div>

            <p className="font-body text-lg leading-relaxed opacity-90 max-w-sm">
              Crafting hand-painted worlds where the wind whispers secrets and
              every shadow tells a story. Join us on our journey through the
              meadow.
            </p>

            <div className="flex gap-5">
              {[
                { icon: Instagram, label: "Instagram" },
                { icon: Twitter, label: "Twitter" },
                { icon: Youtube, label: "Youtube" },
                { icon: Wind, label: "Newsletter" },
              ].map((social, idx) => (
                <Link
                  key={idx}
                  href="#"
                  className="group relative p-2 transition-all duration-500 hover:text-[#7DB9B6]"
                  aria-label={social.label}
                >
                  <social.icon className="w-6 h-6 relative z-10" />
                  <motion.div className="absolute inset-0 bg-[#FDFBF7]/10 rounded-full scale-0 group-hover:scale-100 transition-transform duration-500" />
                </Link>
              ))}
            </div>
          </div>

          {/* Column 2: Navigation Links */}
          <div className="lg:col-span-3 grid grid-cols-2 gap-8 lg:block lg:space-y-12">
            <div>
              <h4 className="font-label text-xs mb-6 opacity-60 tracking-[0.2em]">
                EXPLORE
              </h4>
              <ul className="space-y-4 font-body text-base">
                <li>
                  <Link
                    href="/"
                    className="hover:text-[#7DB9B6] transition-colors duration-300"
                  >
                    The Home Page
                  </Link>
                </li>
                <li>
                  <Link
                    href="/the-world"
                    className="hover:text-[#7DB9B6] transition-colors duration-300"
                  >
                    World Lore
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-[#7DB9B6] transition-colors duration-300"
                  >
                    Character Gallery
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-[#7DB9B6] transition-colors duration-300"
                  >
                    Filmography
                  </Link>
                </li>
              </ul>
            </div>
            <div className="lg:mt-12">
              <h4 className="font-label text-xs mb-6 opacity-60 tracking-[0.2em]">
                JOURNAL
              </h4>
              <ul className="space-y-4 font-body text-base">
                <li>
                  <Link
                    href="#"
                    className="hover:text-[#7DB9B6] transition-colors duration-300"
                  >
                    Process Art
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-[#7DB9B6] transition-colors duration-300"
                  >
                    Studio News
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-[#7DB9B6] transition-colors duration-300"
                  >
                    Merchandise
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Column 3: Newsletter Signup */}
          <div className="lg:col-span-5">
            <div className="bg-[#F5F0E6] p-8 md:p-10 rounded-lg shadow-paper relative overflow-hidden group">
              {/* Decorative Leaf in background of card */}
              <Leaf className="absolute -bottom-4 -right-4 w-32 h-32 text-[#4A7C59]/5 rotate-45 pointer-events-none group-hover:rotate-[60deg] transition-transform duration-1000" />

              <h3 className="font-header text-2xl md:text-3xl text-[#2D302E] mb-4">
                Join the Wind's Whisper
              </h3>
              <p className="font-body text-[#707571] mb-8 leading-relaxed">
                Receive hand-drawn updates, exclusive behind-the-scenes
                sketches, and first notice on ticket releases.
              </p>

              {status === "success" ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center py-4 text-center"
                >
                  <div className="w-12 h-12 bg-[#4A7C59] rounded-full flex items-center justify-center mb-4">
                    <Sparkles className="text-[#FDFBF7] w-6 h-6" />
                  </div>
                  <p className="font-header text-[#4A7C59] text-xl">
                    Thank you for joining us!
                  </p>
                  <p className="font-body text-[#707571] text-sm mt-1">
                    Check your inbox for a small gift.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <label
                      htmlFor="email"
                      className="font-label text-[10px] text-[#707571] block mb-2"
                    >
                      YOUR EMAIL ADDRESS
                    </label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#707571] group-focus-within:text-[#7DB9B6] transition-colors" />
                      <input
                        type="email"
                        id="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="spirited@away.com"
                        className="w-full bg-[#F0EDE5] border-b-2 border-[#D9D2C5] py-4 pl-12 pr-4 font-body text-[#2D302E] focus:outline-none focus:border-[#7DB9B6] transition-all"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="w-full bg-[#4A7C59] hover:bg-[#3E674A] active:bg-[#E9806E] text-[#FDFBF7] py-4 rounded-full font-label tracking-widest text-sm transition-all duration-500 shadow-watercolor flex items-center justify-center gap-2 group"
                  >
                    {status === "loading" ? (
                      <span className="flex items-center gap-2">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                        >
                          <Wind className="w-4 h-4" />
                        </motion.div>
                        SENDING...
                      </span>
                    ) : (
                      <>
                        SUBSCRIBE TO UPDATES
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="max-w-7xl mx-auto mt-24 pt-8 border-t border-[#FDFBF7]/10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <p className="font-label text-[10px] opacity-60 tracking-wider">
              © {new Date().getFullYear()} STUDIO KOMOREBI. ALL RIGHTS RESERVED.
            </p>
            <p className="font-body text-xs italic opacity-40">
              Hand-painted with love in the heart of the forest.
            </p>
          </div>

          <div className="flex gap-8 font-label text-[10px] tracking-widest opacity-60">
            <Link href="#" className="hover:text-[#E9806E] transition-colors">
              PRIVACY POLICY
            </Link>
            <Link href="#" className="hover:text-[#E9806E] transition-colors">
              TERMS OF SERVICE
            </Link>
            <Link href="#" className="hover:text-[#E9806E] transition-colors">
              COOKIES
            </Link>
          </div>
        </div>
      </div>

      {/* Drifting Petals/Leaves Decoration (Visual Only) */}
      <div className="absolute bottom-0 left-0 w-full h-full pointer-events-none overflow-hidden z-20">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              x: -100,
              y: Math.random() * 1000,
              opacity: 0,
              rotate: 0,
            }}
            animate={{
              x: "110vw",
              y: Math.random() * 1000 - 200,
              opacity: [0, 0.4, 0],
              rotate: 360,
            }}
            transition={{
              duration: 15 + Math.random() * 10,
              repeat: Infinity,
              delay: i * 3,
              ease: "linear",
            }}
            className="absolute"
          >
            <Leaf className="w-4 h-4 text-[#7DB9B6]/20 fill-current" />
          </motion.div>
        ))}
      </div>
    </footer>
  );
}
