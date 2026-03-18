import type { Metadata } from "next";
import ArtShowcaseSection from "@/components/sections/the-world_ArtShowcaseSection";

export const metadata: Metadata = {
  title: "The World",
  description: "Deep dive into the environmental art and lore.",
};

/**
 * The World Page
 *
 * This page serves as a deep-dive into the visual storytelling and environmental
 * lore of the film. It is designed for the 'evaluation' stage of the user journey,
 * focusing on high-impact visual immersion and a minimalist, gallery-like aesthetic.
 *
 * Design Strategy:
 * - Uses a Ghibli-inspired "Human Touch" philosophy.
 * - Features a global paper grain texture and vignette to evoke physical media.
 * - Centers on the ArtShowcaseSection to satisfy visitor curiosity and drive discovery.
 */
export default function Page() {
  return (
    <>
      {/* Global Paper Grain Texture Overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-40"
        style={{
          backgroundImage: `url("https://www.transparenttextures.com/patterns/natural-paper.png")`,
          backgroundRepeat: "repeat",
        }}
        aria-hidden="true"
      />

      {/* Warm Vignette Overlay to focus the eye */}
      <div
        className="pointer-events-none fixed inset-0 z-40"
        style={{
          background:
            "radial-gradient(circle, transparent 40%, rgba(45, 48, 46, 0.03) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Main Content Composition */}
      <main className="relative min-h-screen bg-[#FDFBF7] selection:bg-[#7DB9B6]/30">
        {/* 
          The ArtShowcaseSection is the centerpiece of this route.
          It handles the transition from discovery to deep lore through 
          a minimalist, high-contrast gallery layout.
        */}
        <div className="relative z-10">
          <ArtShowcaseSection />
        </div>

        {/* 
          Decorative Environmental Glow 
          Subtle light source mimicking 'Komorebi' (sunlight filtering through leaves)
        */}
        <div
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full h-[100vh] z-0 opacity-30"
          style={{
            background:
              "radial-gradient(50% 50% at 50% 0%, rgba(125, 185, 182, 0.15) 0%, transparent 100%)",
          }}
          aria-hidden="true"
        />
      </main>
    </>
  );
}
