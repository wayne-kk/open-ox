import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

/**
 * CountdownSection Component
 *
 * A high-urgency, thematic countdown timer for the Halloween Spooktacular.
 * Features:
 * - Real-time ticking logic
 * - Neon Gothic aesthetic (Midnight, Slime Green, Pumpkin Orange)
 * - Custom flicker animations and chamfered edge styling
 * - Glitchy monospace typography for timer units
 */

const CountdownSection = () => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    // Target: Halloween Night (October 31st)
    const currentYear = new Date().getFullYear();
    const targetDate = new Date(
      `October 31, ${currentYear} 00:00:00`,
    ).getTime();

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      // If Halloween has passed this year, target next year
      const adjustedTarget =
        difference < 0
          ? new Date(`October 31, ${currentYear + 1} 00:00:00`).getTime()
          : targetDate;

      const finalDiff = adjustedTarget - now;

      setTimeLeft({
        days: Math.floor(finalDiff / (1000 * 60 * 60 * 24)),
        hours: Math.floor(
          (finalDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
        ),
        minutes: Math.floor((finalDiff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((finalDiff % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative py-24 overflow-hidden bg-[#0A090C] border-y border-[#3D3945]">
      {/* Background Textures */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
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

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, #3D3945 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="container relative z-10 mx-auto px-4">
        <div className="flex flex-col items-center text-center space-y-12">
          {/* Header Area */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1 border border-[#32FF7E]/30 bg-[#32FF7E]/5 text-[#32FF7E] font-mono text-xs tracking-widest uppercase">
              <Clock className="w-4 h-4 animate-pulse" />
              Limited Time Haunting
            </div>
            <h2 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter uppercase text-[#FF6200] italic">
              <span
                className="animate-[flicker_3s_infinite] inline-block"
                style={{ fontFamily: "Creepster, system-ui" }}
              >
                The
              </span>{" "}
              <span style={{ fontFamily: "Syne, sans-serif" }}>
                Haunting Begins In
              </span>
            </h2>
          </div>

          {/* Countdown Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 w-full max-w-5xl">
            <TimeUnit value={timeLeft.days} label="Days" />
            <TimeUnit value={timeLeft.hours} label="Hours" />
            <TimeUnit value={timeLeft.minutes} label="Mins" />
            <TimeUnit value={timeLeft.seconds} label="Secs" isUrgent />
          </div>

          {/* Call to Action */}
          <div className="pt-8">
            <button
              className="group relative px-10 py-4 bg-[#FF6200] text-[#0A090C] font-bold uppercase tracking-widest transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(255,98,0,0.4)]"
              style={{
                clipPath:
                  "polygon(10% 0, 100% 0, 100% 85%, 90% 100%, 0 100%, 0 15%)",
              }}
            >
              Secure Your Spot Before It's Too Late
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out" />
            </button>
            <p className="mt-4 text-[#A19DA8] font-mono text-sm uppercase tracking-wider">
              Tickets are vanishing like ghosts in the mist.
            </p>
          </div>
        </div>
      </div>

      {/* Decorative Slime Drip */}
      <div className="absolute top-0 left-1/4 w-px h-24 bg-gradient-to-b from-[#32FF7E] to-transparent opacity-50" />
      <div className="absolute top-0 right-1/3 w-px h-40 bg-gradient-to-b from-[#32FF7E] to-transparent opacity-30" />

      <style jsx global>{`
        @keyframes flicker {
          0%,
          19.999%,
          22%,
          62.999%,
          64%,
          64.999%,
          70%,
          100% {
            opacity: 1;
            text-shadow: 0 0 12px #ff6200;
          }
          20%,
          21.999%,
          63%,
          63.999%,
          65%,
          69.999% {
            opacity: 0.4;
            text-shadow: none;
          }
        }
        @keyframes glitch-shift {
          0% {
            transform: translate(0);
          }
          20% {
            transform: translate(-2px, 1px);
          }
          40% {
            transform: translate(-2px, -1px);
          }
          60% {
            transform: translate(2px, 1px);
          }
          80% {
            transform: translate(2px, -1px);
          }
          100% {
            transform: translate(0);
          }
        }
      `}</style>
    </section>
  );
};

interface TimeUnitProps {
  value: number;
  label: string;
  isUrgent?: boolean;
}

const TimeUnit = ({ value, label, isUrgent }: TimeUnitProps) => {
  return (
    <div
      className="relative group p-6 md:p-10 bg-[#16141A] border border-[#3D3945] transition-colors hover:border-[#32FF7E]/50"
      style={{
        clipPath: "polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0 15%)",
      }}
    >
      {/* Inner Glow Overlay */}
      <div className="absolute inset-0 bg-[#9D50BB]/5 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center">
        <span
          className={`text-5xl md:text-7xl font-bold font-mono tracking-tighter mb-2 transition-all duration-300 ${
            isUrgent
              ? "text-[#32FF7E] [text-shadow:0_0_15px_rgba(50,255,126,0.6)]"
              : "text-[#F2F2F7]"
          } group-hover:scale-110`}
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          {value.toString().padStart(2, "0")}
        </span>
        <span className="text-xs md:text-sm font-mono uppercase tracking-[0.3em] text-[#A19DA8] font-semibold">
          {label}
        </span>
      </div>

      {/* Decorative corner accent */}
      <div className="absolute top-2 right-2 w-1 h-1 bg-[#32FF7E] opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute bottom-2 left-2 w-1 h-1 bg-[#32FF7E] opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
};

export default CountdownSection;
