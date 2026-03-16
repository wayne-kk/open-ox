import React from "react";
import { Ghost, Sparkles, ChevronRight } from "lucide-react";

/**
 * HeroSection Component
 *
 * A high-impact, centered hero section for the Halloween Spooktacular landing page.
 * Implements the "Neon Gothic" aesthetic with ambient mist, neon flickers,
 * and chamfered-edge UI elements.
 */
const HeroSection = () => {
  return (
    <section className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-[#0A090C] px-4 py-24 selection:bg-[#32FF7E] selection:text-[#0A090C]">
      {/* 1. Midnight Grain & Texture Overlays */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-10">
        <svg
          viewBox="0 0 200 200"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          <filter id="noiseFilter">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#noiseFilter)" />
        </svg>
      </div>

      {/* 2. Gothic Grid Background */}
      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, #3D3945 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* 3. Ambient Mist Layers */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -bottom-1/4 -left-1/4 w-full h-full bg-gradient-to-tr from-[#9D50BB]/20 to-transparent blur-[120px] animate-pulse" />
        <div className="absolute -top-1/4 -right-1/4 w-full h-full bg-gradient-to-bl from-[#FF6200]/10 to-transparent blur-[120px] animate-pulse delay-700" />

        {/* Animated Mist Clouds */}
        <div className="absolute bottom-0 left-0 right-0 h-96 bg-gradient-to-t from-[#0A090C] via-transparent to-transparent z-10" />
        <div className="absolute bottom-10 left-[-10%] w-[120%] h-64 bg-[#32FF7E]/5 blur-[80px] animate-[mist_20s_linear_infinite]" />
      </div>

      {/* 4. Content Stack */}
      <div className="relative z-20 max-w-5xl mx-auto text-center flex flex-col items-center">
        {/* Thematic Label */}
        <div className="mb-8 flex items-center gap-3 px-4 py-1 border border-[#3D3945] bg-[#16141A]/80 backdrop-blur-sm animate-[float_4s_ease-in-out_infinite]">
          <Ghost className="w-4 h-4 text-[#32FF7E] drop-shadow-[0_0_8px_#32FF7E]" />
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-[#A19DA8]">
            The Witching Hour Approaches
          </span>
          <Sparkles className="w-4 h-4 text-[#32FF7E] drop-shadow-[0_0_8px_#32FF7E]" />
        </div>

        {/* Main Title: Displacement Typography Concept */}
        <h1 className="mb-6 flex flex-col items-center">
          <span className="block text-[#F2F2F7] font-bold uppercase tracking-tighter text-5xl md:text-7xl lg:text-8xl leading-none font-['Syne']">
            The Ultimate
          </span>
          <span className="block mt-2 relative">
            <span className="inline-block font-['Creepster'] text-[#FF6200] text-6xl md:text-8xl lg:text-9xl drop-shadow-[0_0_15px_rgba(255,98,0,0.6)] animate-[flicker_5s_linear_infinite]">
              S
            </span>
            <span className="inline-block font-['Syne'] font-extrabold uppercase tracking-tighter text-6xl md:text-8xl lg:text-9xl text-[#F2F2F7]">
              pooktacular
            </span>
          </span>
        </h1>

        {/* Sub-headline */}
        <p className="max-w-2xl mb-12 text-[#A19DA8] font-['Outfit'] text-lg md:text-2xl leading-relaxed">
          Step into a{" "}
          <span className="text-[#32FF7E] font-semibold">Neon Gothic</span>{" "}
          realm where Victorian horror meets digital rave. High-energy,
          hauntingly immersive, and strictly after dark.
        </p>

        {/* Primary CTA: Pumpkin Neon with Chamfered Edges */}
        <div className="flex flex-col sm:flex-row gap-6 items-center justify-center">
          <button
            className="group relative px-10 py-5 bg-[#FF6200] text-[#0A090C] font-bold uppercase tracking-widest transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,98,0,0.4)] hover:shadow-[0_0_40px_rgba(255,98,0,0.6)] focus:ring-2 focus:ring-[#32FF7E] outline-none"
            style={{
              clipPath:
                "polygon(10% 0, 100% 0, 100% 75%, 90% 100%, 0 100%, 0 25%)",
            }}
          >
            <span className="relative z-10 flex items-center gap-2">
              Claim Your Soul-Ticket
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
          </button>

          <button
            className="group px-10 py-5 border-2 border-[#32FF7E] text-[#32FF7E] font-bold uppercase tracking-widest bg-transparent hover:bg-[#32FF7E] hover:text-[#0A090C] transition-all duration-300 shadow-[0_0_15px_rgba(50,255,126,0.2)]"
            style={{
              clipPath:
                "polygon(10% 0, 100% 0, 100% 75%, 90% 100%, 0 100%, 0 25%)",
            }}
          >
            Explore The Void
          </button>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
          <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#A19DA8]">
            Scroll
          </span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-[#32FF7E] to-transparent" />
        </div>
      </div>

      {/* Decorative Floating Elements (Parallax feel) */}
      <div className="absolute top-1/4 left-10 md:left-20 pointer-events-none animate-[float_6s_ease-in-out_infinite] opacity-30">
        <Ghost className="w-12 h-12 text-[#9D50BB]" />
      </div>
      <div className="absolute bottom-1/4 right-10 md:right-20 pointer-events-none animate-[float_8s_ease-in-out_infinite_reverse] opacity-20">
        <div className="w-16 h-16 border-2 border-[#FF6200] rotate-45" />
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes flicker {
          0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100% { opacity: 1; filter: drop-shadow(0 0 15px rgba(255,98,0,0.6)); }
          20%, 21.999%, 63%, 63.999%, 65%, 69.999% { opacity: 0.4; filter: none; }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        @keyframes mist {
          0% { transform: translateX(-20%) skewX(0deg); }
          50% { transform: translateX(10%) skewX(5deg); }
          100% { transform: translateX(-20%) skewX(0deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-pulse, .animate-bounce, .animate-float, .animate-flicker, .animate-mist {
            animation: none !important;
          }
        }
      `,
        }}
      />
    </section>
  );
};

export default HeroSection;
