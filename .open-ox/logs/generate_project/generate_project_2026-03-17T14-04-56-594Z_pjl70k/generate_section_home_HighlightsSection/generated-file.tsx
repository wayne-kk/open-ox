import React from "react";
import {
  ShieldCheck,
  Ghost,
  Music,
  Zap,
  Camera,
  Cpu,
  ChevronRight,
} from "lucide-react";

const highlights = [
  {
    title: "NEON COSTUME CONTEST",
    description:
      "Upgrade your skin. Compete for the ultimate prize in our high-fidelity cosplay showdown. Neural-link synchronization required.",
    icon: ShieldCheck,
    color: "accent", // Magenta
    label: "PRIZE: 5000 CREDITS",
    tag: "LIVE EVENT",
  },
  {
    title: "VR GHOST HUNT",
    description:
      "Enter the spectral realm. Track and neutralize digital entities in a multi-sensory arena. Don't let the malware touch you.",
    icon: Ghost,
    color: "accentSecondary", // Cyan
    label: "SENSORY LEVEL: HIGH",
    tag: "EXPERIMENTAL",
  },
  {
    title: "SYNTHWAVE DJ SET",
    description:
      "Lose yourself in the grid. Pulse to the rhythm of the underground with live hardware sets from Neo-Tokyo's finest.",
    icon: Music,
    color: "accentTertiary", // Acid Green
    label: "140 BPM AVG",
    tag: "MAIN STAGE",
  },
  {
    title: "CYBER-COCKTAIL BAR",
    description:
      "Refuel your systems. Custom-mixed elixirs designed for maximum neural stimulation and hydration for the long night ahead.",
    icon: Zap,
    color: "accent",
    label: "ALCOHOL + NANO",
    tag: "LOUNGE",
  },
  {
    title: "NEURAL-LINK PHOTO BOOTH",
    description:
      "Capture the glitch. High-speed data-capture of your physical form in our light-bending booth. Instant digital download.",
    icon: Camera,
    color: "accentSecondary",
    label: "4K DATA DUMP",
    tag: "INTERACTIVE",
  },
  {
    title: "BLACK MARKET TECH",
    description:
      "Rare hardware and exclusive event merch. Browse limited-edition cyber-gear that won't be found on the public net.",
    icon: Cpu,
    color: "accentTertiary",
    label: "LIMITED STOCK",
    tag: "VENDORS",
  },
];

export default function HighlightsSection() {
  return (
    <section className="relative py-24 bg-[#050505] overflow-hidden">
      {/* Background Textures */}
      <div className="absolute inset-0 bg-cyber-grid pointer-events-none opacity-40" />
      <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-20" />

      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#2A2A2F] to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#2A2A2F] to-transparent" />

      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header - Asymmetrical Alignment */}
        <div className="mb-20 max-w-2xl ml-0 md:ml-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-12 h-[2px] bg-[#FF00FF]" />
            <span className="font-label text-xs tracking-[0.3em] text-[#FF00FF] uppercase">
              Operational Parameters
            </span>
          </div>
          <h2 className="font-display text-4xl md:text-6xl text-[#E0E0E0] italic uppercase tracking-tighter mb-6">
            The Night{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF00FF] to-[#00F3FF]">
              Decoded
            </span>
          </h2>
          <p className="font-body text-[#88888F] text-lg max-w-lg leading-relaxed">
            Experience the convergence of supernatural horror and high-tech
            dystopia. Six sectors of immersion await your arrival.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {highlights.map((item, index) => (
            <div
              key={index}
              className="group relative flex flex-col bg-[#0D0D0F] border border-[#2A2A2F] p-8 clip-cyber transition-all duration-300 hover:border-[#FF00FF]/50 hover:translate-y-[-4px]"
              style={{
                boxShadow: "var(--shadow-card-glow)",
              }}
            >
              {/* Corner Accent Line */}
              <div className="absolute top-0 left-0 w-10 h-[2px] bg-[#00F3FF]" />

              {/* Icon & Tag */}
              <div className="flex justify-between items-start mb-8">
                <div
                  className={`p-3 bg-[#1A1A1D] border border-[#2A2A2F] rounded-sm group-hover:scale-110 transition-transform duration-300`}
                >
                  <item.icon
                    className={`w-6 h-6 ${
                      item.color === "accent"
                        ? "text-[#FF00FF]"
                        : item.color === "accentSecondary"
                          ? "text-[#00F3FF]"
                          : "text-[#BCFF00]"
                    }`}
                  />
                </div>
                <span className="font-label text-[10px] tracking-widest text-[#88888F] border border-[#2A2A2F] px-2 py-1">
                  {item.tag}
                </span>
              </div>

              {/* Content */}
              <h3 className="font-header text-2xl text-[#E0E0E0] tracking-widest uppercase mb-4 group-hover:text-[#00F3FF] transition-colors">
                {item.title}
              </h3>
              <p className="font-body text-[#88888F] text-sm leading-relaxed mb-8 flex-grow">
                {item.description}
              </p>

              {/* Footer / Label */}
              <div className="pt-6 border-t border-[#2A2A2F] flex items-center justify-between">
                <span className="font-label text-[11px] text-[#4A4A4F] tracking-widest uppercase">
                  {item.label}
                </span>
                <ChevronRight className="w-4 h-4 text-[#4A4A4F] group-hover:text-[#FF00FF] group-hover:translate-x-1 transition-all" />
              </div>

              {/* Hover Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#FF00FF]/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </div>
          ))}
        </div>

        {/* Bottom CTA / Decorative Line */}
        <div className="mt-20 flex flex-col md:flex-row items-center justify-between gap-8 border-t border-[#2A2A2F] pt-12">
          <div className="flex gap-4">
            <div className="w-2 h-2 bg-[#FF00FF] animate-pulse" />
            <div className="w-2 h-2 bg-[#00F3FF] animate-pulse delay-75" />
            <div className="w-2 h-2 bg-[#BCFF00] animate-pulse delay-150" />
          </div>
          <div className="font-label text-xs text-[#4A4A4F] tracking-[0.4em] uppercase">
            System Status:{" "}
            <span className="text-[#BCFF00]">Fully Operational</span>
          </div>
          <div className="hidden md:block h-px flex-grow mx-12 bg-gradient-to-r from-[#2A2A2F] to-transparent" />
        </div>
      </div>

      {/* Side Data Lines */}
      <div className="absolute top-0 right-12 bottom-0 w-px bg-gradient-to-b from-transparent via-[#2A2A2F] to-transparent hidden xl:block" />
      <div className="absolute top-0 left-4 bottom-0 w-px bg-gradient-to-b from-transparent via-[#2A2A2F] to-transparent hidden xl:block" />
    </section>
  );
}
/* 
Note: This component assumes the following classes are defined in your globals.css:
- .clip-cyber: clip-path: polygon(0% 0%, 100% 0%, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0% 100%);
- .bg-cyber-grid: grid pattern background
- .bg-scanlines: horizontal scanline overlay
- Design tokens for font-display (Orbitron), font-header (Rajdhani), font-body (Inter), and font-label (JetBrains Mono)
*/
