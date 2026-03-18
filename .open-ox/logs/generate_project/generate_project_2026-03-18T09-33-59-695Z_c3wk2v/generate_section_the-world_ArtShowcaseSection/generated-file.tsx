"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Maximize2, ChevronLeft, ChevronRight, Info } from "lucide-react";

/**
 * ArtShowcaseSection
 *
 * A high-impact visual gallery designed to showcase the background art and
 * concept stills of the film. Implements a scrapbook-style asymmetric grid
 * with a fully accessible lightbox.
 */

const ART_GALLERY = [
  {
    id: 1,
    title: "The Emerald Canopy",
    description:
      "Hand-painted watercolor study of the primary forest setting, focusing on light filtration through ancient leaves.",
    src: "https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?q=80&w=2074&auto=format&fit=crop",
    category: "Background Art",
    span: "md:col-span-2 md:row-span-2",
  },
  {
    id: 2,
    title: "Merchant's Rest",
    description:
      "Interior concept for the village tea house, featuring warm wood textures and steam effects.",
    src: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=2070&auto=format&fit=crop",
    category: "Concept Still",
    span: "md:col-span-1 md:row-span-1",
  },
  {
    id: 3,
    title: "Misty Ridges",
    description:
      "Atmospheric perspective test for the mountain sequence during the rainy season.",
    src: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2070&auto=format&fit=crop",
    category: "Environment",
    span: "md:col-span-1 md:row-span-1",
  },
  {
    id: 4,
    title: "The Spirit Gate",
    description:
      "A pivotal location where the physical and spiritual worlds converge at twilight.",
    src: "https://images.unsplash.com/photo-1528164344705-47542687000d?q=80&w=2092&auto=format&fit=crop",
    category: "Key Visual",
    span: "md:col-span-1 md:row-span-2",
  },
  {
    id: 5,
    title: "Village Life",
    description:
      "Detailed layout of the central marketplace, showing daily life and architectural details.",
    src: "https://images.unsplash.com/photo-1524396309943-e03f5ee0563b?q=80&w=2070&auto=format&fit=crop",
    category: "Background Art",
    span: "md:col-span-2 md:row-span-1",
  },
  {
    id: 6,
    title: "Hidden Pond",
    description:
      "A secret location in the deep woods where the protagonist encounters the first spirit.",
    src: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=2071&auto=format&fit=crop",
    category: "Environment",
    span: "md:col-span-1 md:row-span-1",
  },
];

export default function ArtShowcaseSection() {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  const closeLightbox = useCallback(() => setSelectedImage(null), []);

  const nextImage = useCallback(() => {
    if (selectedImage !== null) {
      setSelectedImage((selectedImage + 1) % ART_GALLERY.length);
    }
  }, [selectedImage]);

  const prevImage = useCallback(() => {
    if (selectedImage !== null) {
      setSelectedImage(
        (selectedImage - 1 + ART_GALLERY.length) % ART_GALLERY.length,
      );
    }
  }, [selectedImage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImage === null) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImage, closeLightbox, nextImage, prevImage]);

  const currentItem =
    selectedImage !== null ? ART_GALLERY[selectedImage] : null;

  return (
    <section className="relative min-h-screen bg-[#FDFBF7] py-16 md:py-32 overflow-hidden">
      {/* Paper Grain Overlay */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/natural-paper.png')] bg-repeat" />

      {/* Decorative Background Blobs */}
      <div className="absolute top-20 -left-20 w-96 h-96 bg-[#4A7C59] opacity-[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-40 -right-20 w-[500px] h-[500px] bg-[#7DB9B6] opacity-[0.05] rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        {/* Header Section */}
        <div className="max-w-3xl mb-16 md:mb-24">
          <span className="font-label text-xs md:text-sm font-bold tracking-[0.2em] uppercase text-[#4A7C59] block mb-4">
            Production Archives
          </span>
          <h2 className="font-header text-3xl md:text-5xl font-medium tracking-normal text-[#2D302E] leading-tight mb-6">
            The Art of <span className="italic">Whispers of the Valley</span>
          </h2>
          <p className="font-body text-base md:text-lg leading-relaxed text-[#707571] max-w-2xl">
            Explore the hand-painted environments that bring our world to life.
            Each frame is a labor of love, blending traditional watercolor
            techniques with modern digital craftsmanship to create a timeless
            cinematic experience.
          </p>
        </div>

        {/* Asymmetric Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-8">
          {ART_GALLERY.map((item, index) => (
            <motion.div
              key={item.id}
              layoutId={`card-${item.id}`}
              onClick={() => setSelectedImage(index)}
              className={`group relative cursor-pointer overflow-hidden rounded-[12px] bg-[#F5F0E6] border border-[#D9D2C5] shadow-[var(--shadow-paper)] ${item.span}`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              {/* Image Container */}
              <div className="relative w-full h-full min-h-[300px] overflow-hidden">
                <Image
                  src={item.src}
                  alt={item.title}
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-[#2D302E]/0 group-hover:bg-[#2D302E]/20 transition-colors duration-500" />

                {/* Corner Label */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-[#FDFBF7]/90 backdrop-blur-sm p-2 rounded-full shadow-sm">
                    <Maximize2 className="w-4 h-4 text-[#4A7C59]" />
                  </div>
                </div>

                {/* Bottom Info Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-full group-hover:translate-y-0 transition-transform duration-500 bg-gradient-to-t from-[#2D302E]/80 to-transparent">
                  <span className="font-label text-[10px] text-[#FDFBF7] tracking-widest uppercase mb-1 block">
                    {item.category}
                  </span>
                  <h3 className="font-header text-lg text-[#FDFBF7] font-medium">
                    {item.title}
                  </h3>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA / Link */}
        <div className="mt-20 flex justify-center">
          <button className="group flex items-center gap-3 font-label text-sm font-bold tracking-[0.2em] uppercase text-[#4A7C59] hover:text-[#7DB9B6] transition-colors duration-300">
            <span>View Full Collection</span>
            <div className="w-8 h-[1px] bg-[#4A7C59] group-hover:bg-[#7DB9B6] group-hover:w-12 transition-all duration-300" />
          </button>
        </div>
      </div>

      {/* Lightbox / Modal */}
      <AnimatePresence>
        {selectedImage !== null && currentItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeLightbox}
              className="absolute inset-0 bg-[#2D302E]/95 backdrop-blur-md"
            />

            {/* Content Container */}
            <motion.div
              layoutId={`card-${currentItem.id}`}
              className="relative w-full max-w-6xl max-h-full flex flex-col md:flex-row bg-[#FDFBF7] rounded-[24px] overflow-hidden shadow-2xl"
            >
              {/* Close Button */}
              <button
                onClick={closeLightbox}
                className="absolute top-6 right-6 z-[110] p-2 bg-[#FDFBF7] rounded-full text-[#2D302E] hover:text-[#C84C4C] transition-colors shadow-lg"
                aria-label="Close lightbox"
              >
                <X className="w-6 h-6" />
              </button>

              {/* Navigation Buttons */}
              <div className="absolute inset-y-0 left-0 flex items-center z-[105]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    prevImage();
                  }}
                  className="ml-4 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all transform hover:scale-110"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center z-[105]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
                  className="mr-4 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all transform hover:scale-110"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>

              {/* Main Image Area */}
              <div className="relative flex-1 min-h-[40vh] md:min-h-[60vh] bg-black/5">
                <Image
                  src={currentItem.src}
                  alt={currentItem.title}
                  fill
                  priority
                  className="object-contain"
                  sizes="100vw"
                />
              </div>

              {/* Info Sidebar */}
              <div className="w-full md:w-80 p-8 md:p-10 flex flex-col justify-center border-t md:border-t-0 md:border-l border-[#D9D2C5]">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-4 h-4 text-[#7DB9B6]" />
                  <span className="font-label text-xs font-bold tracking-[0.15em] uppercase text-[#707571]">
                    {currentItem.category}
                  </span>
                </div>
                <h3 className="font-header text-2xl md:text-3xl font-medium text-[#2D302E] mb-4">
                  {currentItem.title}
                </h3>
                <div className="w-12 h-1 bg-[#4A7C59] mb-6 rounded-full" />
                <p className="font-body text-sm md:text-base text-[#707571] leading-relaxed mb-8">
                  {currentItem.description}
                </p>

                <div className="mt-auto pt-6 border-t border-[#D9D2C5]/50">
                  <div className="flex items-center justify-between text-[10px] font-label uppercase tracking-widest text-[#707571]/60">
                    <span>Archive ID: 00{currentItem.id}</span>
                    <span>100% Cotton Paper</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        :root {
          --shadow-paper:
            0 2px 5px rgba(0, 0, 0, 0.05), 0 10px 20px rgba(0, 0, 0, 0.02);
          --shadow-watercolor: 0 10px 30px -10px rgba(74, 124, 89, 0.15);
        }
      `}</style>
    </section>
  );
}
