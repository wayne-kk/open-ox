import type { Metadata } from "next";
import HeroSection from "@/components/sections/home_HeroSection";
import CountdownSection from "@/components/sections/home_CountdownSection";
import AttractionsSection from "@/components/sections/home_AttractionsSection";
import TicketTiersSection from "@/components/sections/home_TicketTiersSection";
import RegistrationFormSection from "@/components/sections/home_RegistrationFormSection";

export const metadata: Metadata = {
  title: "Halloween Promotion Home",
  description:
    "The main landing page designed to immerse users in the Halloween spirit and drive conversions.",
};

/**
 * Halloween Promotion Home Page
 *
 * Narrative Arc:
 * 1. Orientation (Hero)
 * 2. Urgency (Countdown)
 * 3. Persuasion (Attractions)
 * 4. Decision (Ticket Tiers)
 * 5. Conversion (Registration Form)
 *
 * Design Strategy:
 * - Immersive "Neon Gothic" aesthetic.
 * - High-contrast transitions between dark backgrounds and neon accents.
 * - Global grain and vignette overlays for thematic consistency.
 */
export default function Page() {
  return (
    <>
      {/* Global Page-Level Overlays */}
      <div
        className="pointer-events-none fixed inset-0 z-[60] opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none fixed inset-0 z-[55] bg-[radial-gradient(circle_at_center,transparent_0%,rgba(10,9,12,0.4)_70%,rgba(10,9,12,0.8)_100%)]"
        aria-hidden="true"
      />

      <main className="relative flex flex-col bg-[#0A090C] selection:bg-[#32FF7E] selection:text-[#0A090C]">
        {/* 1. Orientation & Value Proposition */}
        <section id="hero" className="relative z-10">
          <HeroSection />
        </section>

        {/* 2. Urgency Driver - Positioned to bridge Hero and Content */}
        <section id="urgency" className="relative z-20 -mt-12 md:-mt-16">
          <div className="container mx-auto px-4">
            <CountdownSection />
          </div>
        </section>

        {/* 3. Persuasion & Value Detail */}
        <section id="attractions" className="relative z-10 py-24">
          <AttractionsSection />
        </section>

        {/* 4. Decision Facilitation - High contrast shift */}
        <section
          id="tickets"
          className="relative z-10 py-24 bg-gradient-to-b from-transparent via-[#16141A] to-transparent"
        >
          <div className="container mx-auto px-4">
            <div className="mb-16 text-center">
              <h2 className="font-['Syne'] text-4xl md:text-6xl font-bold uppercase tracking-tight text-[#F2F2F7]">
                Choose Your <span className="text-[#FF6200]">Fate</span>
              </h2>
              <p className="mt-4 text-[#A19DA8] font-['Outfit'] text-lg max-w-2xl mx-auto">
                Select the experience that haunts you most. Limited spots
                available for the bravest souls.
              </p>
            </div>
            <TicketTiersSection />
          </div>
        </section>

        {/* 5. Conversion Close - Focused and frictionless */}
        <section id="register" className="relative z-10 py-24 pb-32">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto">
              <div className="mb-12 text-center">
                <h2 className="font-['Creepster'] text-5xl text-[#32FF7E] drop-shadow-[0_0_10px_rgba(50,255,126,0.5)]">
                  Secure Your Spot
                </h2>
                <p className="mt-4 text-[#F2F2F7] font-['Outfit']">
                  Complete the ritual below to join the Spooktacular.
                </p>
              </div>
              <RegistrationFormSection />
            </div>
          </div>
        </section>

        {/* Decorative Bottom Fog Element */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#0A090C] to-transparent z-20"
          aria-hidden="true"
        />
      </main>
    </>
  );
}
