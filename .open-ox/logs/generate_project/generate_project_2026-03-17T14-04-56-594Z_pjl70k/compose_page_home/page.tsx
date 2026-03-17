import type { Metadata } from "next";
import HeroSection from "@/components/sections/home_HeroSection";
import IntroSection from "@/components/sections/home_IntroSection";
import HighlightsSection from "@/components/sections/home_HighlightsSection";
import ScheduleSection from "@/components/sections/home_ScheduleSection";
import RegistrationSection from "@/components/sections/home_RegistrationSection";

export const metadata: Metadata = {
  title: "Cyber-Night Halloween Home",
  description: "The main landing page for the cyberpunk Halloween event.",
};

/**
 * Cyber-Night Halloween 2024 - Home Page
 *
 * Journey Stage: Entry
 * Primary Role: Visitor
 *
 * This page assembles the immersive cyberpunk experience, moving from high-impact
 * visual orientation (Hero) to narrative engagement (Intro), value proof (Highlights),
 * logistical planning (Schedule), and finally conversion (Registration).
 */
export default function Page() {
  return (
    <>
      {/* Global Page-Level Overlays - Defined in Design System */}
      <div
        className="pointer-events-none fixed inset-0 z-[60] bg-scanlines opacity-[0.03]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cyber-grid opacity-[0.05]"
        aria-hidden="true"
      />

      {/* Chromatic Aberration / Noise Overlay (Global Page Effect) */}
      <div
        className="pointer-events-none fixed inset-0 z-[55] opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      <main className="relative min-h-screen bg-[#050505] text-[#E0E0E0] selection:bg-[#FF00FF] selection:text-[#050505]">
        {/* 1. Hero Section: Full-height entry trigger */}
        <HeroSection />

        {/* 
          Narrative & Information Flow 
          Using a wrapper to manage the "editorial" rhythm and decorative vertical lines 
          specified in the Layout Strategy.
        */}
        <div className="relative flex flex-col overflow-hidden">
          {/* Decorative Vertical Data-Lines */}
          <div className="absolute left-4 md:left-12 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#2A2A2F] to-transparent opacity-20 hidden lg:block" />
          <div className="absolute right-4 md:right-12 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[#2A2A2F] to-transparent opacity-20 hidden lg:block" />

          {/* 2. Intro Section: Narrative bridge with spacious editorial layout */}
          <section className="relative z-10 py-24 md:py-40">
            <IntroSection />
          </section>

          {/* 3. Highlights Section: Value proof in a structured grid */}
          <section className="relative z-10 py-24 md:py-32 bg-[#0D0D0F]/30 backdrop-blur-sm border-y border-[#2A2A2F]/50">
            <HighlightsSection />
          </section>

          {/* 4. Schedule Section: Logistical guide with chronological progression */}
          <section className="relative z-10 py-24 md:py-40">
            <ScheduleSection />
          </section>
        </div>

        {/* 5. Registration Section: Final conversion engine */}
        <section className="relative z-10 py-24 md:py-48 bg-gradient-to-b from-transparent to-[#0D0D0F]">
          {/* Decorative corner brackets for the final section to frame the form */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-px bg-gradient-to-r from-transparent via-[#FF00FF]/30 to-transparent" />

          <RegistrationSection />

          {/* System Metadata Footer (Visual Decoration) */}
          <div className="mt-24 flex flex-col items-center justify-center gap-2 opacity-20 font-mono text-[10px] tracking-[0.3em] uppercase">
            <div className="flex items-center gap-4">
              <span>[SEC_LEVEL: ALPHA]</span>
              <span className="w-1 h-1 rounded-full bg-[#BCFF00] animate-pulse" />
              <span>[SYSTEM_TIME: 2024.10.31]</span>
            </div>
            <div className="text-[#00F3FF]">
              Connection: Encrypted // Status: Online
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
