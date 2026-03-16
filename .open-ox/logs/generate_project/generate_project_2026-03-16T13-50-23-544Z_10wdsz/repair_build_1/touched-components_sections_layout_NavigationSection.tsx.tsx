"use client";

import React, { useState, useEffect } from "react";
import { Skull, Menu, X, Ghost } from "lucide-react";

const NavigationSection = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { name: "Attractions", href: "#attractions" },
    { name: "Tickets", href: "#tickets" },
    { name: "FAQ", href: "#faq" },
  ];

  const chamferedStyle = {
    clipPath: "polygon(10% 0, 100% 0, 100% 80%, 90% 100%, 0 100%, 0 20%)",
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-[50] transition-all duration-500 border-b ${
        isScrolled
          ? "bg-[#0A090C]/90 backdrop-blur-xl border-border py-3 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.5)]"
          : "bg-transparent border-transparent py-6"
      }`}
    >
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, #3D3945 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />

      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between relative z-10">
        <a
          href="#"
          className="flex items-center gap-3 group focus-visible:ring-2 focus-visible:ring-[#32FF7E] outline-none"
        >
          <div className="relative">
            <Skull className="w-8 h-8 text-[#FF6200] transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
            <div className="absolute inset-0 bg-[#FF6200] blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
          </div>
          <span className="font-['Creepster'] text-2xl md:text-3xl text-[#F2F2F7] tracking-wider animate-[flicker_5s_infinite] drop-shadow-[0_0_8px_rgba(255,98,0,0.3)]">
            SPOOKTACULAR
          </span>
        </a>

        <div className="hidden md:flex items-center gap-12">
          <ul className="flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link.name}>
                <a
                  href={link.href}
                  className="font-['Syne'] text-sm font-bold uppercase tracking-[0.2em] text-[#A19DA8] hover:text-[#FF6200] transition-colors duration-300 relative group"
                >
                  {link.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-[#FF6200] transition-all duration-300 group-hover:w-full shadow-[0_0_8px_#FF6200]" />
                </a>
              </li>
            ))}
          </ul>

          <a
            href="#tickets"
            style={chamferedStyle}
            className="group relative bg-[#FF6200] px-8 py-3 font-['JetBrains_Mono'] text-sm font-extrabold uppercase tracking-widest text-[#0A090C] hover:bg-white transition-all duration-300 shadow-[0_0_15px_rgba(255,98,0,0.4)] hover:shadow-[0_0_25px_rgba(255,98,0,0.6)] hover:scale-105 active:scale-95"
          >
            <span className="relative z-10 flex items-center gap-2">
              Book Now
              <Ghost className="w-4 h-4 transition-transform group-hover:-translate-y-1" />
            </span>
          </a>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-[#F2F2F7] hover:text-[#32FF7E] transition-colors"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className="w-8 h-8" />
          ) : (
            <Menu className="w-8 h-8" />
          )}
        </button>
      </div>

      <div
        className={`fixed inset-0 bg-[#0A090C] z-[40] transition-transform duration-500 ease-in-out md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full pt-32 px-10 gap-12">
          <div
            className="absolute inset-0 opacity-5 pointer-events-none mix-blend-overlay"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />

          <ul className="flex flex-col gap-8">
            {navLinks.map((link, idx) => (
              <li
                key={link.name}
                style={{ transitionDelay: `${idx * 100}ms` }}
                className={`${mobileMenuOpen ? "translate-x-0 opacity-100" : "translate-x-10 opacity-0"} transition-all duration-500`}
              >
                <a
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="font-['Syne'] text-4xl font-bold uppercase tracking-tighter text-[#F2F2F7] hover:text-[#32FF7E] transition-colors"
                >
                  {link.name}
                </a>
              </li>
            ))}
          </ul>

          <div
            className={`mt-auto mb-20 transition-all duration-700 delay-300 ${mobileMenuOpen ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
          >
            <a
              href="#tickets"
              onClick={() => setMobileMenuOpen(false)}
              style={chamferedStyle}
              className="block w-full text-center bg-[#32FF7E] py-5 font-['JetBrains_Mono'] text-lg font-extrabold uppercase tracking-widest text-[#0A090C] shadow-[0_0_20px_rgba(50,255,126,0.3)]"
            >
              Secure Tickets
            </a>
          </div>
        </div>
      </div>

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
            text-shadow: 0 0 8px rgba(255, 98, 0, 0.4);
          }
          20%,
          21.999%,
          63%,
          63.999%,
          65%,
          69.999% {
            opacity: 0.6;
            text-shadow: none;
          }
        }

        @font-face {
          font-family: "Creepster";
          font-style: normal;
          font-weight: 400;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/creepster/v13/Alm0nL616D86iWX679_S5S8.woff2)
            format("woff2");
        }

        @font-face {
          font-family: "Syne";
          font-style: normal;
          font-weight: 700;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/syne/v22/8vIX7wU97_7969_p1v-f.woff2)
            format("woff2");
        }

        @font-face {
          font-family: "JetBrains Mono";
          font-style: normal;
          font-weight: 800;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/jetbrainsmono/v18/t6nu43P6u8p7qx_n-W4O8U0.woff2)
            format("woff2");
        }
      `}</style>
    </nav>
  );
};

export default NavigationSection;
