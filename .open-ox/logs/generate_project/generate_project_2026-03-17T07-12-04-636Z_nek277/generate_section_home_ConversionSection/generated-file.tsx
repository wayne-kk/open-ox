"use client";

import React from "react";
import {
  Check,
  Zap,
  Skull,
  Ghost,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export default function ConversionSection() {
  return (
    <section className="relative py-24 bg-[#050505] overflow-hidden">
      {/* Background Texture Overlays */}
      <div className="absolute inset-0 bg-grain opacity-30 pointer-events-none" />
      <div className="absolute inset-0 bg-scanlines opacity-10 pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="max-w-4xl mx-auto text-center mb-16 md:mb-24 -rotate-[1deg]">
          <span className="font-label text-[#CCFF00] tracking-[0.3em] text-sm mb-4 block animate-pulse">
            // FINAL PHASE ENTRANCE
          </span>
          <h2 className="font-header text-5xl md:text-8xl text-[#F5F5F5] uppercase leading-none tracking-tighter mb-6">
            SECURE <span className="text-[#FF007F] italic">ACCESS</span>
          </h2>
          <p className="font-body text-[#A1A1AA] text-lg md:text-xl max-w-2xl mx-auto">
            The portal closes at midnight. Choose your tier of immersion. No
            refunds. No turning back.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 items-end max-w-7xl mx-auto">
          {/* Tier 1: Standard */}
          <div className="relative group bg-[#0A0A0A] border border-[#333333] p-8 md:p-10 transition-all duration-300 hover:border-[#CCFF00] lg:h-[90%]">
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity">
              <Ghost className="w-8 h-8 text-[#A1A1AA]" />
            </div>
            <div className="mb-8">
              <h3 className="font-header text-2xl text-[#F5F5F5] mb-2 uppercase tracking-tight">
                The Ghost
              </h3>
              <p className="font-body text-[#A1A1AA] text-sm">
                Standard entry for those who prefer the shadows.
              </p>
            </div>
            <div className="mb-8">
              <div className="flex items-baseline gap-1">
                <span className="font-label text-[#CCFF00] text-xl">$</span>
                <span className="font-header text-6xl text-[#F5F5F5]">45</span>
              </div>
              <span className="font-label text-xs text-[#A1A1AA] uppercase tracking-widest">
                Early Bird Rate
              </span>
            </div>
            <ul className="space-y-4 mb-10">
              {[
                "General Admission",
                "Main Stage Access",
                "Digital After-Movie",
                "Standard RFID Band",
              ].map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 font-body text-sm text-[#F5F5F5]"
                >
                  <Check className="w-4 h-4 text-[#CCFF00]" />
                  {feature}
                </li>
              ))}
            </ul>
            <button className="w-full py-4 bg-transparent border-2 border-[#CCFF00] text-[#CCFF00] font-label font-bold uppercase tracking-widest transition-all duration-200 hover:bg-[#CCFF00] hover:text-[#050505] active:scale-95 [clip-path:polygon(10%_0,100%_0,100%_90%,90%_100%,0_100%,0_10%)]">
              Get Started
            </button>
          </div>

          {/* Tier 2: VIP (Emphasized) */}
          <div className="relative z-20 bg-[#CCFF00] p-1 md:p-1.5 shadow-[0_0_40px_rgba(204,255,0,0.3)] transform lg:scale-105">
            <div className="bg-[#050505] p-8 md:p-12 relative overflow-hidden">
              {/* Highlight Badge */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-[#FF007F] text-[#F5F5F5] font-label text-[10px] py-1 px-4 uppercase tracking-[0.2em] font-bold">
                Most Corrupted
              </div>

              <div className="absolute top-6 right-6">
                <Skull className="w-10 h-10 text-[#CCFF00] animate-bounce" />
              </div>

              <div className="mb-8">
                <h3 className="font-header text-3xl text-[#CCFF00] mb-2 uppercase tracking-tight">
                  Acid Lord
                </h3>
                <p className="font-body text-[#A1A1AA] text-sm">
                  The definitive experience for the true disciples.
                </p>
              </div>

              <div className="mb-8">
                <div className="flex items-baseline gap-1">
                  <span className="font-label text-[#FF007F] text-2xl">$</span>
                  <span className="font-header text-8xl text-[#F5F5F5] tracking-tighter">
                    88
                  </span>
                </div>
                <span className="font-label text-xs text-[#CCFF00] uppercase tracking-widest font-bold">
                  Limited Availability
                </span>
              </div>

              <ul className="space-y-5 mb-12">
                {[
                  "Priority Fast-Track Entry",
                  "Exclusive VIP Acid Lounge",
                  "3 Complementary Elixirs",
                  "Limited Edition 2024 Tee",
                  "Backstage Access (Phase 1)",
                ].map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-3 font-body text-base text-[#F5F5F5]"
                  >
                    <Zap className="w-5 h-5 text-[#FF007F] fill-[#FF007F]" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button className="group relative w-full py-6 bg-[#CCFF00] text-[#050505] font-label font-black text-lg uppercase tracking-widest transition-all duration-200 hover:shadow-[6px_6px_0px_#BF00FF] active:scale-95 [clip-path:polygon(10%_0,100%_0,100%_90%,90%_100%,0_100%,0_10%)]">
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Secure Access Now{" "}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </div>
          </div>

          {/* Tier 3: Ultra */}
          <div className="relative group bg-[#0A0A0A] border border-[#333333] p-8 md:p-10 transition-all duration-300 hover:border-[#BF00FF] lg:h-[90%]">
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity">
              <ShieldCheck className="w-8 h-8 text-[#BF00FF]" />
            </div>
            <div className="mb-8">
              <h3 className="font-header text-2xl text-[#F5F5F5] mb-2 uppercase tracking-tight">
                The Entity
              </h3>
              <p className="font-body text-[#A1A1AA] text-sm">
                Full transcendence. No boundaries remaining.
              </p>
            </div>
            <div className="mb-8">
              <div className="flex items-baseline gap-1">
                <span className="font-label text-[#BF00FF] text-xl">$</span>
                <span className="font-header text-6xl text-[#F5F5F5]">150</span>
              </div>
              <span className="font-label text-xs text-[#A1A1AA] uppercase tracking-widest">
                Ultimate Access
              </span>
            </div>
            <ul className="space-y-4 mb-10">
              {[
                "All VIP Perks Included",
                "Private Booth Selection",
                "Personal Ritual Guide",
                "Lifetime Event Access",
                "NFT Commemorative Piece",
              ].map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 font-body text-sm text-[#F5F5F5]"
                >
                  <Check className="w-4 h-4 text-[#BF00FF]" />
                  {feature}
                </li>
              ))}
            </ul>
            <button className="w-full py-4 bg-transparent border-2 border-[#BF00FF] text-[#BF00FF] font-label font-bold uppercase tracking-widest transition-all duration-200 hover:bg-[#BF00FF] hover:text-[#F5F5F5] active:scale-95 [clip-path:polygon(10%_0,100%_0,100%_90%,90%_100%,0_100%,0_10%)]">
              Ascend Now
            </button>
          </div>
        </div>

        {/* Trust/Footer Info */}
        <div className="mt-20 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 border-t border-[#333333] pt-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center border border-[#333333]">
              <ShieldCheck className="text-[#CCFF00] w-6 h-6" />
            </div>
            <div>
              <p className="font-label text-[10px] text-[#A1A1AA] uppercase tracking-widest">
                Secure Checkout
              </p>
              <p className="font-body text-sm text-[#F5F5F5]">
                256-bit Encrypted Ritual
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center border border-[#333333]">
              <Ghost className="text-[#FF007F] w-6 h-6" />
            </div>
            <div>
              <p className="font-label text-[10px] text-[#A1A1AA] uppercase tracking-widest">
                Instant Delivery
              </p>
              <p className="font-body text-sm text-[#F5F5F5]">
                Digital Sigil via Email
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center border border-[#333333]">
              <Zap className="text-[#BF00FF] w-6 h-6" />
            </div>
            <div>
              <p className="font-label text-[10px] text-[#A1A1AA] uppercase tracking-widest">
                Support Line
              </p>
              <p className="font-body text-sm text-[#F5F5F5]">
                24/7 Void Assistance
              </p>
            </div>
          </div>
        </div>

        {/* Marquee-style Disclaimer */}
        <div className="mt-16 overflow-hidden whitespace-nowrap border-y border-[#333333] py-4 opacity-30 select-none">
          <div className="inline-block animate-[marquee_20s_linear_infinite] font-label text-xs uppercase tracking-[0.5em] text-[#F5F5F5]">
            NO REFUNDS • ENTER AT YOUR OWN RISK • ACID HALLOWEEN 2024 • THE VOID
            IS CALLING • NO REFUNDS • ENTER AT YOUR OWN RISK • ACID HALLOWEEN
            2024 • THE VOID IS CALLING • NO REFUNDS • ENTER AT YOUR OWN RISK •
            ACID HALLOWEEN 2024 • THE VOID IS CALLING •
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  );
}
