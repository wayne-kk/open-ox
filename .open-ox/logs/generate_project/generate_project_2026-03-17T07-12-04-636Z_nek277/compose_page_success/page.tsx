import type { Metadata } from "next";
import SuccessMessageSection from "@/components/sections/success_SuccessMessageSection";

export const metadata: Metadata = {
  title: "You're In | Acid Halloween 2024",
  description: "Confirmation page for users who have registered or purchased.",
};

/**
 * SUCCESS PAGE
 *
 * Journey Stage: Action
 * Role: Event Seeker
 * Strategy: Establish immediate value (Confirmation), provide utility (QR/Calendar),
 * and reinforce the action (Sharing/Next Steps).
 */
export default function Page() {
  return (
    <>
      {/* Global Design System Overlays */}
      <div
        className="pointer-events-none fixed inset-0 z-[100] opacity-30 mix-blend-overlay bg-grain"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed inset-0 z-[101] bg-scanlines opacity-20"
        aria-hidden="true"
      />

      {/* Page-level strobe/flash effect container (optional, handled by sections usually) */}
      <div className="relative min-h-screen bg-[#050505] selection:bg-[#CCFF00] selection:text-[#050505]">
        <main className="relative z-10 flex flex-col items-center justify-center">
          {/* 
            SuccessMessageSection acts as the primary conversion-engine hub.
            It handles the narrative arc from "Confirmed" (Value) to "QR/Calendar" (Trust/Utility)
            to "Share" (Friction reduction/Action reinforcement).
          */}
          <SuccessMessageSection />
        </main>

        {/* Decorative background elements consistent with Acid Aesthetic */}
        <div className="pointer-events-none fixed bottom-0 left-0 h-64 w-full bg-gradient-to-t from-[#CCFF00]/5 to-transparent" />
        <div className="pointer-events-none fixed top-0 right-0 h-96 w-96 bg-[#BF00FF]/10 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
      </div>
    </>
  );
}
