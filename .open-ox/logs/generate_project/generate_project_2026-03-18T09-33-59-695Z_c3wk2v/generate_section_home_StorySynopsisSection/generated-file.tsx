"use client";

import React from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Wind, Leaf } from "lucide-react";

/**
 * StorySynopsisSection
 *
 * An editorial-style narrative bridge designed to introduce the heart of the film.
 * Uses a warm, parchment-like aesthetic with poetic typography and floating
 * watercolor-inspired decorative elements.
 */
export default function StorySynopsisSection() {
  const containerRef = React.useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex items-center justify-center py-24 md:py-40 bg-[#FDFBF7] overflow-hidden"
    >
      {/* Paper Grain Overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-50 opacity-40 mix-blend-multiply"
        style={{
          backgroundImage: `url("https://www.transparenttextures.com/patterns/natural-paper.png")`,
        }}
      />

      {/* Decorative Watercolor Blobs */}
      <motion.div
        style={{ y: y1 }}
        className="absolute top-[10%] -left-[5%] w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] bg-[#4A7C59]/10 rounded-full blur-[100px] pointer-events-none"
      />
      <motion.div
        style={{ y: y2 }}
        className="absolute bottom-[5%] -right-[5%] w-[35vw] h-[35vw] max-w-[500px] max-h-[500px] bg-[#E9806E]/10 rounded-full blur-[80px] pointer-events-none"
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle,_rgba(245,240,230,0.4)_0%,_transparent_70%)] pointer-events-none" />

      {/* Floating Elements (Drift Animation) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ x: -100, y: Math.random() * 1000, opacity: 0 }}
            animate={{
              x: "120vw",
              y: Math.random() * 1000 - 200,
              opacity: [0, 0.4, 0.4, 0],
              rotate: [0, 180, 360],
            }}
            transition={{
              duration: 15 + Math.random() * 10,
              repeat: Infinity,
              delay: i * 3,
              ease: "linear",
            }}
            className="absolute text-[#4A7C59]/20"
          >
            {i % 2 === 0 ? (
              <Leaf size={24 + i * 4} />
            ) : (
              <Wind size={20 + i * 4} />
            )}
          </motion.div>
        ))}
      </div>

      <div className="container relative z-20 mx-auto px-6 max-w-4xl">
        <motion.div
          style={{ opacity }}
          className="flex flex-col items-center text-center space-y-8 md:space-y-12"
        >
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
            viewport={{ once: true }}
          >
            <span className="font-label text-xs md:text-sm font-bold tracking-[0.3em] uppercase text-[#4A7C59] block mb-4">
              A Journey Beyond the Horizon
            </span>
            <div className="w-12 h-[1px] bg-[#D9D2C5] mx-auto" />
          </motion.div>

          {/* Main Headline */}
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{
              duration: 1.2,
              delay: 0.2,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            viewport={{ once: true }}
            className="font-display text-5xl md:text-7xl font-light italic text-[#2D302E] leading-[1.1] tracking-tight"
          >
            Where the Forest <br className="hidden md:block" />
            <span className="text-[#4A7C59]">Breathes in Color</span>
          </motion.h2>

          {/* Poetic Body Text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{
              duration: 1.2,
              delay: 0.4,
              ease: [0.25, 0.1, 0.25, 1],
            }}
            viewport={{ once: true }}
            className="font-body text-lg md:text-2xl text-[#2D302E]/80 leading-relaxed md:leading-loose space-y-6 md:space-y-10"
          >
            <p className="first-letter:text-6xl first-letter:font-display first-letter:mr-3 first-letter:float-left first-letter:text-[#4A7C59] first-letter:leading-none">
              In a valley tucked between the folds of time, where the clouds
              rest at noon and the rivers hum ancient melodies, lives a young
              weaver named Elara. Her life was measured by the rhythm of the
              loom until the day she discovered a thread that glowed with the
              light of forgotten stars.
            </p>

            <p>
              As the boundaries between the mundane and the mystical begin to
              dissolve, Elara must venture deep into the Whispering Woods—a
              place where the trees remember the first song of creation and the
              shadows possess a language of their own.
            </p>

            <p className="italic font-header text-[#707571] text-xl md:text-3xl pt-4">
              "To find the heart of the forest, one must first learn to listen
              with the soul."
            </p>
          </motion.div>

          {/* Call to Action / Decorative Break */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, delay: 0.6 }}
            viewport={{ once: true }}
            className="pt-12"
          >
            <button className="group relative px-10 py-4 bg-[#4A7C59] text-[#FDFBF7] rounded-full font-label text-xs md:text-sm tracking-[0.2em] uppercase transition-all duration-500 hover:bg-[#3E674A] hover:-translate-y-1 shadow-[0_10px_30px_-10px_rgba(74,124,89,0.3)] hover:shadow-[0_15px_35px_-10px_rgba(74,124,89,0.5)]">
              <span className="relative z-10">Discover the Lore</span>
              <div className="absolute inset-0 rounded-full bg-white/10 scale-0 group-hover:scale-100 transition-transform duration-500 ease-out" />
            </button>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom Masking for Smooth Section Transition */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#F5F0E6] to-transparent pointer-events-none" />

      {/* Decorative Corner Elements */}
      <div className="absolute top-12 left-12 opacity-20 hidden lg:block">
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-[#4A7C59]"
        >
          <path
            d="M0 120C0 53.7258 53.7258 0 120 0"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <circle cx="0" cy="120" r="4" fill="currentColor" />
        </svg>
      </div>
      <div className="absolute bottom-12 right-12 opacity-20 hidden lg:block rotate-180">
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-[#7DB9B6]"
        >
          <path
            d="M0 120C0 53.7258 53.7258 0 120 0"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <circle cx="0" cy="120" r="4" fill="currentColor" />
        </svg>
      </div>
    </section>
  );
}
