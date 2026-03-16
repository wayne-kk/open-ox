import React from "react";
import {
  Ghost,
  Skull,
  Utensils,
  Music,
  Zap,
  Flame,
  Camera,
  Martini,
} from "lucide-react";

const attractions = [
  {
    title: "The Crypt of Whispers",
    description:
      "Navigate a labyrinth of Victorian horror where the walls have ears and the shadows have teeth.",
    icon: Ghost,
    color: "text-[#32FF7E]",
    borderColor: "border-[#32FF7E]/30",
    glowColor: "shadow-[0_0_15px_rgba(50,255,126,0.2)]",
  },
  {
    title: "Wicked Wardrobe",
    description:
      "Our legendary costume contest. Compete for the 'Soul Taker' trophy and $5,000 in cursed gold.",
    icon: Skull,
    color: "text-[#FF6200]",
    borderColor: "border-[#FF6200]/30",
    glowColor: "shadow-[0_0_15px_rgba(255,98,0,0.2)]",
  },
  {
    title: "The Midnight Feast",
    description:
      "A culinary journey through the macabre. Five courses of exquisite terror served in total darkness.",
    icon: Utensils,
    color: "text-[#9D50BB]",
    borderColor: "border-[#9D50BB]/30",
    glowColor: "shadow-[0_0_15px_rgba(157,80,187,0.2)]",
  },
  {
    title: "Neon Grave Rave",
    description:
      "Lose your soul to the frequency. High-voltage electronic sets from the underworld's finest DJs.",
    icon: Music,
    color: "text-[#32FF7E]",
    borderColor: "border-[#32FF7E]/30",
    glowColor: "shadow-[0_0_15px_rgba(50,255,126,0.2)]",
  },
  {
    title: "The Alchemist's Bar",
    description:
      "Sip on glowing elixirs and smoking concoctions designed to heighten your supernatural senses.",
    icon: Martini,
    color: "text-[#FF6200]",
    borderColor: "border-[#FF6200]/30",
    glowColor: "shadow-[0_0_15px_rgba(255,98,0,0.2)]",
  },
  {
    title: "Spectral Portraits",
    description:
      "Capture your transformation with our infrared spirit cameras. Guaranteed to see what's behind you.",
    icon: Camera,
    color: "text-[#9D50BB]",
    borderColor: "border-[#9D50BB]/30",
    glowColor: "shadow-[0_0_15px_rgba(157,80,187,0.2)]",
  },
];

const AttractionsSection = () => {
  return (
    <section className="relative py-24 bg-[#0A090C] overflow-hidden">
      {/* Gothic Grid Background Pattern */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, #3D3945 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Midnight Grain Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')]" />

      <div className="container relative mx-auto px-4">
        <div className="max-w-3xl mb-16">
          <h2 className="text-sm font-mono uppercase tracking-[0.3em] text-[#32FF7E] mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 animate-pulse" />
            Curated Experiences
          </h2>
          <h3 className="text-5xl md:text-7xl font-bold font-['Syne',sans-serif] text-[#F2F2F7] leading-none uppercase tracking-tighter mb-6">
            The Night's{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6200] to-[#9D50BB] animate-[flicker_3s_infinite]">
              Attractions
            </span>
          </h3>
          <p className="text-lg md:text-xl text-[#A19DA8] font-['Outfit',sans-serif] max-w-xl">
            Step into our immersive playground where high-end gothic luxury
            meets raw, electric terror. Choose your path through the darkness.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {attractions.map((item, index) => (
            <div
              key={index}
              className={`group relative transition-all duration-500 hover:-translate-y-2 ${
                index % 2 === 0 ? "md:rotate-1" : "md:-rotate-1"
              } hover:rotate-0`}
            >
              {/* Card Container with Chamfered Edges */}
              <div
                className="relative p-8 bg-[#16141A] border border-[#3D3945] h-full transition-colors duration-300 group-hover:border-[#32FF7E]/50 group-hover:shadow-[0_0_30px_rgba(50,255,126,0.1)]"
                style={{
                  clipPath:
                    "polygon(0 10%, 10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%)",
                }}
              >
                {/* Icon Frame */}
                <div className="mb-6 relative w-16 h-16 flex items-center justify-center">
                  <div className="absolute inset-0 bg-[#2C2833] rotate-45 border border-[#3D3945] group-hover:border-[#32FF7E] transition-colors duration-300" />
                  <item.icon
                    className={`w-8 h-8 relative z-10 transition-all duration-300 ${item.color} group-hover:scale-110`}
                  />
                </div>

                <h4 className="text-2xl font-bold font-['Syne',sans-serif] text-[#F2F2F7] mb-4 tracking-tight group-hover:text-[#32FF7E] transition-colors">
                  {item.title}
                </h4>

                <p className="text-[#A19DA8] font-['Outfit',sans-serif] leading-relaxed mb-6">
                  {item.description}
                </p>

                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-[#A19DA8] group-hover:text-[#FF6200] transition-colors">
                  <Flame className="w-3 h-3" />
                  High Intensity Event
                </div>
              </div>

              {/* Decorative Corner Glow */}
              <div
                className={`absolute -bottom-2 -right-2 w-12 h-12 rounded-full blur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-500 ${item.color.replace("text", "bg")}`}
              />
            </div>
          ))}
        </div>

        {/* Call to Action Anchor */}
        <div className="mt-20 flex justify-center">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#FF6200] to-[#32FF7E] blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <button
              className="relative px-12 py-5 bg-[#0A090C] border border-[#3D3945] text-[#F2F2F7] font-bold uppercase tracking-[0.2em] transition-all hover:text-[#32FF7E] hover:border-[#32FF7E]"
              style={{
                clipPath:
                  "polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)",
              }}
            >
              Secure Your Invitation
            </button>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes flicker {
          0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100% { opacity: 1; text-shadow: 0 0 12px currentColor; }
          20%, 21.999%, 63%, 63.999%, 65%, 69.999% { opacity: 0.4; text-shadow: none; }
        }
      `,
        }}
      />
    </section>
  );
};

export default AttractionsSection;
