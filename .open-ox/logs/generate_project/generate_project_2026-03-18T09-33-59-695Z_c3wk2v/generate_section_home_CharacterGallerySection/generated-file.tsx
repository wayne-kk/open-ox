"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

interface Character {
  id: number;
  name: string;
  role: string;
  description: string;
  quote: string;
  image: string;
  color: string;
}

const characters: Character[] = [
  {
    id: 1,
    name: "Elara",
    role: "The Star-Seeker",
    description:
      "A young cartographer who dreams of mapping the constellations that only appear during the Great Eclipse. Her journey begins when a fallen star lands in her backyard.",
    quote:
      "The maps don't show the way home, they show the way to who we are meant to be.",
    image:
      "https://images.unsplash.com/photo-1580128660010-fd027e1e587a?q=80&w=800&auto=format&fit=crop",
    color: "#4A7C59",
  },
  {
    id: 2,
    name: "Finley",
    role: "Forest Guardian",
    description:
      "A spirit bound to the Whispering Woods. Finley takes the form of a giant, moss-covered fox and guides lost travelers—for the price of a shared secret.",
    quote:
      "Nature doesn't speak in words, it speaks in the rustle of leaves and the silence between heartbeats.",
    image:
      "https://images.unsplash.com/photo-1516233979677-dd4260919984?q=80&w=800&auto=format&fit=crop",
    color: "#7DB9B6",
  },
  {
    id: 3,
    name: "Master Kaito",
    role: "The Clockmaker",
    description:
      "An eccentric inventor living in the Iron City. He spends his days repairing the 'Heart of Time,' a massive clockwork mechanism that keeps the world in balance.",
    quote:
      "Every second is a gear in the machine of destiny. Don't let yours get rusty.",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800&auto=format&fit=crop",
    color: "#E9806E",
  },
  {
    id: 4,
    name: "Sora",
    role: "Sky Merchant",
    description:
      "Captain of the 'Cloud-Dancer,' Sora sails the winds between floating islands, trading bottled sunlight for memories of the ocean.",
    quote:
      "The horizon isn't an end, it's just the place where the sky decides to touch the earth.",
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800&auto=format&fit=crop",
    color: "#4A7C59",
  },
  {
    id: 5,
    name: "The Weaver",
    role: "Keeper of Fate",
    description:
      "A mysterious figure who dwells in the Nebula Caves, spinning the threads of every living creature's story into a cosmic tapestry.",
    quote:
      "Even the smallest thread can change the entire pattern of the world.",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=800&auto=format&fit=crop",
    color: "#7DB9B6",
  },
];

export default function CharacterGallerySection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (containerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
      setCanScrollLeft(scrollLeft > 20);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 20);
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll);
      checkScroll();
      return () => el.removeEventListener("scroll", checkScroll);
    }
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (containerRef.current) {
      const scrollAmount = window.innerWidth * 0.8;
      containerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="relative min-h-screen py-24 overflow-hidden bg-[#FDFBF7]">
      {/* Texture Overlays */}
      <div className="absolute inset-0 bg-paper-grain z-10 pointer-events-none" />

      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#7DB9B6]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#4A7C59]/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

      <div className="container mx-auto px-6 relative z-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-label text-xs md:text-sm font-bold tracking-[0.2em] uppercase text-[#4A7C59] block mb-4"
            >
              Meet the Souls of the Journey
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-6xl font-medium tracking-normal font-header text-[#2D302E]"
            >
              A World Defined by{" "}
              <span className="italic font-light">Character</span>
            </motion.h2>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              className={`p-4 rounded-full border border-[#D9D2C5] transition-all duration-500 ${
                canScrollLeft
                  ? "hover:bg-[#4A7C59] hover:text-[#FDFBF7] text-[#4A7C59]"
                  : "text-[#D9D2C5] cursor-not-allowed"
              }`}
              aria-label="Scroll Left"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              className={`p-4 rounded-full border border-[#D9D2C5] transition-all duration-500 ${
                canScrollRight
                  ? "hover:bg-[#4A7C59] hover:text-[#FDFBF7] text-[#4A7C59]"
                  : "text-[#D9D2C5] cursor-not-allowed"
              }`}
              aria-label="Scroll Right"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        {/* Horizontal Carousel */}
        <div
          ref={containerRef}
          className="flex overflow-x-auto gap-8 pb-12 no-scrollbar snap-x snap-mandatory cursor-grab active:cursor-grabbing"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {characters.map((char, index) => (
            <motion.div
              key={char.id}
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{
                delay: index * 0.1,
                duration: 0.8,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className="flex-shrink-0 w-[85vw] md:w-[450px] snap-center"
            >
              <div className="group relative bg-[#F5F0E6] border border-[#D9D2C5] rounded-xl p-6 md:p-8 h-full shadow-[var(--shadow-paper)] transition-all duration-700 hover:shadow-[var(--shadow-watercolor)] hover:-translate-y-2">
                {/* Image Container with Watercolor Mask */}
                <div className="relative aspect-[4/5] mb-8 overflow-hidden rounded-lg">
                  <div className="absolute inset-0 bg-paper-grain z-10 opacity-30 pointer-events-none" />
                  <motion.img
                    src={char.image}
                    alt={char.name}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    style={{ filter: "sepia(10%) contrast(95%)" }}
                  />
                  {/* Decorative corner accents */}
                  <div className="absolute top-4 right-4 z-20">
                    <div className="w-8 h-8 border-t-2 border-r-2 border-[#FDFBF7]/50" />
                  </div>
                  <div className="absolute bottom-4 left-4 z-20">
                    <div className="w-8 h-8 border-b-2 border-l-2 border-[#FDFBF7]/50" />
                  </div>
                </div>

                {/* Character Details */}
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-label text-[10px] tracking-[0.2em] uppercase text-[#707571] mb-1 block">
                        {char.role}
                      </span>
                      <h3 className="text-3xl font-semibold tracking-wide font-header text-[#2D302E]">
                        {char.name}
                      </h3>
                    </div>
                    <div className="text-[#E9806E] opacity-20">
                      <Quote size={32} fill="currentColor" />
                    </div>
                  </div>

                  <p className="font-body text-[#2D302E]/80 text-base leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all duration-500">
                    {char.description}
                  </p>

                  <div className="pt-4 border-t border-[#D9D2C5]">
                    <p className="italic font-header text-lg text-[#4A7C59]">
                      &ldquo;{char.quote}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Decorative blob behind text on hover */}
                <div
                  className="absolute -bottom-4 -right-4 w-32 h-32 rounded-full opacity-0 group-hover:opacity-10 transition-opacity duration-700 blur-2xl pointer-events-none"
                  style={{ backgroundColor: char.color }}
                />
              </div>
            </motion.div>
          ))}

          {/* Spacer for ending the scroll nicely */}
          <div className="flex-shrink-0 w-12 md:w-24" />
        </div>
      </div>

      {/* Aesthetic Accents */}
      <div className="container mx-auto px-6 mt-12 flex items-center gap-4">
        <div className="h-px flex-grow bg-[#D9D2C5]" />
        <div className="font-label text-[10px] tracking-widest text-[#707571] uppercase">
          Drag to explore
        </div>
        <div className="h-px w-12 bg-[#D9D2C5]" />
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </section>
  );
}
