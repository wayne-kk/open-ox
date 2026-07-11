import { Suspense } from "react";
import { PricingPageClient } from "./PricingPageClient";

export const metadata = {
  title: "Pricing · Open-OX",
  description: "Credits, Pro plans, and top-up packs for Open-OX.",
};

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#07080c] text-white/50">
          Loading pricing…
        </div>
      }
    >
      <PricingPageClient />
    </Suspense>
  );
}
