import type { Metadata } from "next";
import HeroSection from "@/components/sections/home_HeroSection";
import StorySynopsisSection from "@/components/sections/home_StorySynopsisSection";
import CharacterGallerySection from "@/components/sections/home_CharacterGallerySection";
import TicketingCTASection from "@/components/sections/home_TicketingCTASection";

export const metadata: Metadata = {
  title: "Home",
  description: "The main promotional gateway for the film.",
};

/**
 * Home Page
 *
 * Journey Stage: entry
 * Primary Roles: visitor
 *
 * This page assembles the core promotional narrative of the film, moving from
 * immersive atmosphere (Hero) to emotional context (Synopsis), personal
 * connection (Characters), and finally conversion (Ticketing).
 */
export default function Page() {
  return (
    <>
      {/* 
          Global Design System Overlays 
          - Paper Grain: Provides the tactile, toothy watercolor paper texture.
          - Vignette: A soft, warm radial gradient to focus the eye and add cinematic depth.
      */}
      <div
        className="bg-paper-grain fixed inset-0 z-50 pointer-events-none opacity-40 mix-blend-multiply"
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-40 pointer-events-none bg-[radial-gradient(circle,transparent_40%,rgba(217,210,197,0.15)_100%)]"
        aria-hidden="true"
      />

      <main className="relative flex flex-col min-h-screen bg-[#FDFBF7] selection:bg-[#7DB9B6]/30">
        {/* 
            1. Hero Section 
            Establishes the 'Immersive Visual Experience'. 
            Centered editorial layout with living painting background.
        */}
        <section className="relative z-10">
          <HeroSection />
        </section>

        {/* 
            2. Story Synopsis Section 
            The narrative bridge. Uses editorial typography and parchment aesthetics.
            Spacing follows the design system's clamp-based rhythm.
        */}
        <section className="relative z-10 py-[clamp(4rem,10vh,10rem)]">
          <StorySynopsisSection />
        </section>

        {/* 
            3. Character Gallery Section 
            Personal connection point. Side-scrolling carousel to explore the cast.
            Asymmetric layout strategy to maintain the 'scrapbook' feel.
        */}
        <section className="relative z-10 pb-[clamp(4rem,10vh,10rem)]">
          <CharacterGallerySection />
        </section>

        {/* 
            4. Ticketing CTA Section 
            The conversion closer. High-contrast visual anchor with a sunset palette.
            Transitions from the airy paper feel to a warm, decisive finish.
        */}
        <section className="relative z-10">
          <TicketingCTASection />
        </section>

        {/* 
            Environmental Lighting (Komorebi)
            Subtle decorative glow that mimics sunlight filtering through leaves,
            placed behind content but above the base background.
        */}
        <div
          className="fixed top-[-10%] right-[-5%] w-[50%] h-[60%] rounded-full bg-[#7DB9B6]/5 blur-[120px] pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="fixed bottom-[-10%] left-[-5%] w-[40%] h-[50%] rounded-full bg-[#E9806E]/5 blur-[100px] pointer-events-none"
          aria-hidden="true"
        />
      </main>
    </>
  );
}
