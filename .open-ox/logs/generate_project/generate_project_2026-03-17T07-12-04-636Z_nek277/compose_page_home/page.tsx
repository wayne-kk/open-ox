import type { Metadata } from "next";
import HeroSection from "@/components/sections/home_HeroSection";
import UrgencySection from "@/components/sections/home_UrgencySection";
import LineupSection from "@/components/sections/home_LineupSection";
import ConversionSection from "@/components/sections/home_ConversionSection";

export const metadata: Metadata = {
  title: "Acid Halloween Experience",
  description: "The main immersive landing page for the Halloween event.",
};

/**
 * ACID HALLOWEEN 2024 - MAIN LANDING PAGE
 *
 * Journey Stage: Entry
 * Primary Role: Event Seeker / Visitor
 *
 * Composition Strategy:
 * 1. Orientation: High-impact Hero establishing the 'Acid' aesthetic.
 * 2. Persuasion: Immediate Urgency to drive psychological momentum.
 * 3. Proof: Detailed Lineup using neo-brutalist grid structures.
 * 4. Conversion: High-contrast CTA block to close the loop.
 */
export default function Page() {
  return (
    <>
      {/* 
          Global Page-Level Overlays 
          Provides the persistent 'Digital Decay' and 'CRT' texture across all sections.
      */}
      <div
        className="pointer-events-none fixed inset-0 z-[100] opacity-[0.05] bg-grain mix-blend-overlay"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0 z-[90] bg-scanlines opacity-10"
        aria-hidden="true"
      />

      <main className="relative min-h-screen bg-[#050505] selection:bg-[#CCFF00] selection:text-[#050505]">
        {/* 
            SECTION 1: HERO 
            Establishes the visual narrative and primary value prop.
        */}
        <section className="relative z-10">
          <HeroSection />
        </section>

        {/* 
            SECTION 2: URGENCY 
            Positioned with a slight negative margin or overlap to break the grid 
            and maintain high-velocity energy.
        */}
        <section className="relative z-20 -mt-8 md:-mt-16">
          <UrgencySection />
        </section>

        {/* 
            SECTION 3: LINEUP 
            The information layer. Uses standard section spacing to allow 
            the complex grid content to breathe.
        */}
        <section className="relative z-10 py-16 md:py-32">
          <LineupSection />
        </section>

        {/* 
            SECTION 4: CONVERSION 
            The final destination. High-contrast transition to Hot Pink 
            to signal the end of the journey and the point of action.
        */}
        <section className="relative z-10 pb-20 md:pb-40">
          <div className="container mx-auto px-4">
            <div className="relative overflow-hidden border-4 border-[#050505] shadow-[8px_8px_0px_0px_#BF00FF]">
              <ConversionSection />
            </div>
          </div>
        </section>

        {/* Decorative Page Bottom Element */}
        <div
          className="h-1 w-full bg-gradient-to-r from-[#CCFF00] via-[#FF007F] to-[#BF00FF]"
          aria-hidden="true"
        />
      </main>
    </>
  );
}
