import type { Metadata } from "next";
import CinematicHeroSection from "@/components/sections/home_CinematicHeroSection";
import StorySynopsisSection from "@/components/sections/home_StorySynopsisSection";
import CharacterRosterSection from "@/components/sections/home_CharacterRosterSection";
import MediaGallerySection from "@/components/sections/home_MediaGallerySection";
import TicketBookingSection from "@/components/sections/home_TicketBookingSection";

export const metadata: Metadata = {
  title: "Movie Home",
  description: "The main landing experience for the movie promotion.",
};

export default function Page() {
  return (
    <>
      {/* Global Design System Overlays */}
      <div
        className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
        aria-hidden="true"
      >
        {/* Halftone Dot Pattern Overlay */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `radial-gradient(rgba(255,255,255,0.1) 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />

        {/* Scanline Tech Overlay (Subtle) */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            background: `linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%)`,
            backgroundSize: "100% 4px",
          }}
        />

        {/* The "Redline" Brand Signature (Static Top Border) */}
        <div className="absolute top-0 left-0 h-1 w-full bg-[#ED1D24] shadow-[0_0_15px_rgba(237,29,36,0.8)]" />
      </div>

      <main className="relative min-h-screen bg-[#050505] text-white selection:bg-[#ED1D24] selection:text-white">
        {/* 1. ORIENTATION: Page opener and value proposition anchor */}
        <section id="hero" className="relative z-10">
          <CinematicHeroSection />
        </section>

        {/* 2. PERSUASION: Narrative context and emotional stakes */}
        <section
          id="synopsis"
          className="relative z-20 py-24 md:py-32 overflow-hidden"
        >
          {/* Decorative Background Slash */}
          <div className="absolute top-0 left-[-10%] w-[120%] h-full bg-muted/30 -rotate-[15deg] origin-top-left -z-10" />
          <StorySynopsisSection />
        </section>

        {/* 3. ENGAGEMENT: Deepening trust and character connection */}
        <section
          id="characters"
          className="relative z-10 py-24 md:py-32 bg-black/50 backdrop-blur-sm border-y border-white/5"
        >
          <div className="container mx-auto px-4 mb-12">
            <div className="h-px w-24 bg-[#ED1D24] mb-6" />
            <h2 className="font-display text-4xl md:text-6xl uppercase tracking-tight">
              The <span className="text-[#ED1D24]">Roster</span>
            </h2>
          </div>
          <CharacterRosterSection />
        </section>

        {/* 4. SOCIAL PROOF / HYPE: Visual scale and production quality */}
        <section id="gallery" className="relative z-10 py-24 md:py-32">
          {/* Cinematic Letterboxing Effect for Gallery */}
          <div className="absolute inset-0 border-y-[40px] md:border-y-[80px] border-black pointer-events-none z-20" />
          <MediaGallerySection />
        </section>

        {/* 5. CONVERSION: Frictionless ticketing and final call to action */}
        <section
          id="tickets"
          className="relative z-30 py-24 md:py-40 bg-gradient-to-b from-transparent to-black"
        >
          <div className="container mx-auto px-4">
            {/* Asymmetric Layout Wrapper for Ticketing */}
            <div className="max-w-5xl mx-auto">
              <TicketBookingSection />
            </div>
          </div>

          {/* Decorative Energy Flux (Bottom Page Glow) */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-[#ED1D24]/10 blur-[120px] -z-10" />
        </section>
      </main>
    </>
  );
}
