"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Camera,
  Share2,
} from "lucide-react";

const MEDIA_ITEMS = [
  {
    id: 1,
    type: "image",
    title: "THE AWAKENING",
    category: "STILL",
    src: "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?q=80&w=2070&auto=format&fit=crop",
    description: "First look at the cosmic rift opening over the skyline.",
    span: "col-span-12 md:col-span-8 row-span-2",
  },
  {
    id: 2,
    type: "video",
    title: "PRODUCTION LOG 04",
    category: "BEHIND THE SCENES",
    src: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=2070&auto=format&fit=crop",
    description: "Choreographing the final showdown sequence.",
    span: "col-span-12 md:col-span-4 row-span-1",
  },
  {
    id: 3,
    type: "image",
    title: "NEW RECRUITS",
    category: "STILL",
    src: "https://images.unsplash.com/photo-1534809027769-b00d750a6bac?q=80&w=1974&auto=format&fit=crop",
    description: "The team assembles at the hidden headquarters.",
    span: "col-span-12 md:col-span-4 row-span-1",
  },
  {
    id: 4,
    type: "image",
    title: "QUANTUM TECH",
    category: "CONCEPT ART",
    src: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop",
    description: "Early design iterations for the phase-shifter gauntlets.",
    span: "col-span-12 md:col-span-4 row-span-1",
  },
  {
    id: 5,
    type: "image",
    title: "NEON NIGHTS",
    category: "STILL",
    src: "https://images.unsplash.com/photo-1605810230434-7631ac76ec81?q=80&w=2070&auto=format&fit=crop",
    description:
      "Cinematography study for the high-speed chase through Neo-Tokyo.",
    span: "col-span-12 md:col-span-4 row-span-1",
  },
  {
    id: 6,
    type: "image",
    title: "THE ANTAGONIST",
    category: "STILL",
    src: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=2074&auto=format&fit=crop",
    description: "The first silhouette reveal of the Void-Walker.",
    span: "col-span-12 md:col-span-4 row-span-1",
  },
];

export default function MediaGallerySection() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedItem = MEDIA_ITEMS.find((item) => item.id === selectedId);

  const handleNext = () => {
    if (selectedId === null) return;
    const currentIndex = MEDIA_ITEMS.findIndex(
      (item) => item.id === selectedId,
    );
    const nextIndex = (currentIndex + 1) % MEDIA_ITEMS.length;
    setSelectedId(MEDIA_ITEMS[nextIndex].id);
  };

  const handlePrev = () => {
    if (selectedId === null) return;
    const currentIndex = MEDIA_ITEMS.findIndex(
      (item) => item.id === selectedId,
    );
    const prevIndex =
      (currentIndex - 1 + MEDIA_ITEMS.length) % MEDIA_ITEMS.length;
    setSelectedId(MEDIA_ITEMS[prevIndex].id);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    if (selectedId !== null) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [selectedId]);

  return (
    <section className="relative py-24 md:py-32 bg-[#050505] overflow-hidden">
      {/* Background Texture Overlays */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_0)] bg-[size:20px_20px]" />
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,255,0,0.06))] bg-[size:100%_2px,3px_100%]" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="max-w-2xl">
            <span className="font-label text-xs md:text-sm tracking-[0.3em] text-[#00D4FF] mb-4 block">
              // CLASSIFIED ARCHIVES
            </span>
            <h2 className="font-display text-5xl md:text-7xl uppercase tracking-tighter text-white leading-none">
              Visual{" "}
              <span className="text-[#ED1D24] drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
                Intelligence
              </span>
            </h2>
            <div className="h-1 w-24 bg-[#ED1D24] mt-6" />
          </div>
          <div className="hidden md:block">
            <p className="font-body text-mutedForeground max-w-xs text-sm leading-relaxed border-l border-white/10 pl-6">
              Access high-resolution field imagery and decrypted surveillance
              footage from Project: Origins.
            </p>
          </div>
        </div>

        {/* Media Grid */}
        <div className="grid grid-cols-12 gap-4 auto-rows-fr">
          {MEDIA_ITEMS.map((item) => (
            <motion.div
              key={item.id}
              layoutId={`media-${item.id}`}
              onClick={() => setSelectedId(item.id)}
              className={`${item.span} group relative overflow-hidden bg-[#121212] cursor-pointer border border-white/5 hover:border-[#00D4FF]/50 transition-colors duration-500`}
            >
              {/* Image Container */}
              <div className="relative w-full h-full aspect-video md:aspect-auto">
                <Image
                  src={item.src}
                  alt={item.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-110 group-hover:rotate-1 grayscale-[0.5] group-hover:grayscale-0"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />

                {/* Overlay UI */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                {/* Tech Corner Accents */}
                <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-[#00D4FF]/0 group-hover:border-[#00D4FF]/50 transition-all duration-300 m-4" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-[#00D4FF]/0 group-hover:border-[#00D4FF]/50 transition-all duration-300 m-4" />

                {/* Content Overlay */}
                <div className="absolute inset-0 p-6 flex flex-col justify-end">
                  <div className="flex items-center gap-3 mb-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <span className="font-label text-[10px] bg-[#ED1D24] text-white px-2 py-0.5">
                      {item.category}
                    </span>
                    {item.type === "video" && (
                      <span className="bg-white/10 backdrop-blur-md p-1 rounded-full">
                        <Play size={12} className="text-white fill-white" />
                      </span>
                    )}
                  </div>
                  <h3 className="font-header text-xl md:text-2xl text-white uppercase italic tracking-tight opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-75">
                    {item.title}
                  </h3>
                </div>

                {/* Center Icon on Hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-[#ED1D24] p-4 shadow-[var(--shadow-glow-red)] translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                    <Maximize2 className="text-white w-6 h-6" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer Action */}
        <div className="mt-16 flex flex-col items-center">
          <button className="group relative px-12 py-5 font-display text-xl uppercase tracking-widest text-white transition-all duration-300 active:scale-95">
            <div
              className="absolute inset-0 bg-[#ED1D24] transition-transform group-hover:skew-x-[-12deg]"
              style={{
                clipPath:
                  "polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0% 30%)",
              }}
            />
            <span className="relative z-10 flex items-center gap-3">
              Download Full Dossier <Camera size={20} />
            </span>
          </button>
          <p className="mt-6 font-label text-[10px] text-mutedForeground tracking-widest uppercase">
            Restricted Access // Level 7 Clearance Required
          </p>
        </div>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {selectedId && selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-12"
          >
            {/* Lightbox Controls */}
            <div className="absolute top-6 right-6 z-[110] flex items-center gap-4">
              <button className="p-3 bg-white/5 hover:bg-white/10 text-white rounded-full transition-colors">
                <Share2 size={20} />
              </button>
              <button
                onClick={() => setSelectedId(null)}
                className="p-3 bg-[#ED1D24] hover:bg-red-500 text-white rounded-full transition-colors shadow-[var(--shadow-glow-red)]"
              >
                <X size={24} />
              </button>
            </div>

            <button
              onClick={handlePrev}
              className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-[110] p-4 text-white/50 hover:text-white transition-colors"
            >
              <ChevronLeft size={48} />
            </button>

            <button
              onClick={handleNext}
              className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-[110] p-4 text-white/50 hover:text-white transition-colors"
            >
              <ChevronRight size={48} />
            </button>

            {/* Main Lightbox Content */}
            <div className="relative w-full max-w-6xl aspect-video md:aspect-[21/9] flex flex-col">
              <motion.div
                layoutId={`media-${selectedId}`}
                className="relative flex-1 w-full overflow-hidden border border-white/10"
              >
                <Image
                  src={selectedItem.src}
                  alt={selectedItem.title}
                  fill
                  className="object-contain"
                  priority
                />

                {/* Technical HUD Overlay */}
                <div className="absolute inset-0 pointer-events-none border-[20px] border-transparent">
                  <div className="absolute top-0 left-0 w-12 h-0.5 bg-[#00D4FF]" />
                  <div className="absolute top-0 left-0 w-0.5 h-12 bg-[#00D4FF]" />
                  <div className="absolute bottom-0 right-0 w-12 h-0.5 bg-[#00D4FF]" />
                  <div className="absolute bottom-0 right-0 w-0.5 h-12 bg-[#00D4FF]" />
                </div>
              </motion.div>

              {/* Lightbox Meta */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                  <div className="flex items-center gap-4 mb-2">
                    <span className="font-label text-xs text-[#ED1D24] tracking-widest">
                      FILE_ID: {selectedItem.id.toString().padStart(4, "0")}
                    </span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                  <h2 className="font-display text-4xl md:text-5xl text-white uppercase mb-4">
                    {selectedItem.title}
                  </h2>
                  <p className="font-body text-mutedForeground text-lg">
                    {selectedItem.description}
                  </p>
                </div>
                <div className="bg-white/5 p-6 border-l-2 border-[#00D4FF]">
                  <h4 className="font-label text-[10px] text-[#00D4FF] mb-4 tracking-widest">
                    METADATA
                  </h4>
                  <ul className="space-y-3 font-label text-[11px] text-white/70">
                    <li className="flex justify-between border-b border-white/5 pb-1">
                      <span>RESOLUTION:</span>
                      <span className="text-white">8192 X 4320</span>
                    </li>
                    <li className="flex justify-between border-b border-white/5 pb-1">
                      <span>ISO_SPEED:</span>
                      <span className="text-white">400</span>
                    </li>
                    <li className="flex justify-between border-b border-white/5 pb-1">
                      <span>LENS_TYPE:</span>
                      <span className="text-white">35MM ANAMORPHIC</span>
                    </li>
                    <li className="flex justify-between">
                      <span>STATUS:</span>
                      <span className="text-[#00D4FF] animate-pulse">
                        DECRYPTED
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
