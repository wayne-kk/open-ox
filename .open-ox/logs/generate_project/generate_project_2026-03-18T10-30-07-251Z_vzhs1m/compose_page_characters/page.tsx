import type { Metadata } from "next";
import CharacterDetailSection from "@/components/sections/characters_CharacterDetailSection";

export const metadata: Metadata = {
  title: "Character Dossier | MCU Experience",
  description:
    "Deep dive into individual character lore and cinematic history.",
};

/**
 * Character Dossier Page
 *
 * This page serves the 'evaluation' stage of the user journey, focusing on
 * 'immersive-storytelling' to deepen the connection between the visitor and the cast.
 *
 * Design Strategy:
 * - Editorial-style composition that treats character data as high-end digital collectibles.
 * - High-contrast visuals using the 'Marvel Red' accent and cinematic black backgrounds.
 * - Global tech overlays (scanlines and halftone) to reinforce the 'Stark-era' HUD aesthetic.
 */
export default function Page() {
  return (
    <>
      {/* Global Page-Level Overlays */}

      {/* 1. Redline Scroll Progress (Visual Only - Logic usually in a client wrapper if dynamic) */}
      <div
        className="fixed top-0 left-0 h-1 bg-[#ED1D24] z-[60] shadow-[0_0_15px_rgba(237,29,36,0.8)] transition-all duration-300"
        style={{ width: "0%" }} // Initial state, logic handled by global scroll listener if present
        aria-hidden="true"
      />

      {/* 2. Scanline Tech Overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.03] mix-blend-overlay"
        style={{
          background: `linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))`,
          backgroundSize: "100% 2px, 3px 100%",
        }}
        aria-hidden="true"
      />

      {/* 3. Halftone Dot Pattern */}
      <div
        className="pointer-events-none fixed inset-0 z-40 opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.2) 1px, transparent 0)`,
          backgroundSize: "24px 24px",
        }}
        aria-hidden="true"
      />

      {/* 4. Cinematic Letterboxing (Top/Bottom subtle vignettes) */}
      <div
        className="pointer-events-none fixed inset-0 z-30 bg-gradient-to-b from-[#050505] via-transparent to-[#050505] opacity-60"
        aria-hidden="true"
      />

      <main className="relative min-h-screen bg-[#050505] overflow-x-hidden">
        {/* 
            CharacterDetailSection:
            The primary focus of this route. It handles the high-res character renders,
            heroic typography, and animated power stats.
        */}
        <div className="relative z-10">
          <CharacterDetailSection />
        </div>

        {/* Decorative Background Element: The "Hero" Angle Slash */}
        <div
          className="pointer-events-none absolute top-1/4 -right-20 w-full h-[500px] bg-[#ED1D24]/5 -rotate-12 skew-x-12 blur-3xl"
          aria-hidden="true"
        />
      </main>
    </>
  );
}
