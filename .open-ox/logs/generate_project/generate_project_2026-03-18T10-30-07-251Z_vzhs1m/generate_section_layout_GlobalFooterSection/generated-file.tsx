import React from "react";
import Link from "next/link";
import {
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  ExternalLink,
  ShieldCheck,
  Globe,
  Info,
} from "lucide-react";

export default function GlobalFooterSection() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-[#050505] border-t border-[#27272A] overflow-hidden">
      {/* Halftone Overlay Pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 0)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Top Accent Bar */}
      <div className="h-1 w-full bg-[#ED1D24] shadow-[var(--shadow-glow-red)] relative z-10" />

      <div className="max-w-7xl mx-auto px-6 pt-16 pb-8 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-16">
          {/* Brand Column */}
          <div className="md:col-span-4 space-y-6">
            <div className="inline-block">
              <div className="bg-[#ED1D24] px-2 py-1 transform -skew-x-12">
                <span className="font-display text-4xl text-white tracking-tighter uppercase block transform skew-x-12">
                  Marvel Studios
                </span>
              </div>
            </div>
            <p className="font-body text-[#A1A1AA] text-sm leading-relaxed max-w-xs">
              Pushing the boundaries of storytelling across the multiverse.
              Experience the next chapter of the Marvel Cinematic Universe.
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="https://twitter.com/marvel"
                className="text-[#A1A1AA] hover:text-[#ED1D24] transition-colors duration-300"
              >
                <Twitter size={20} />
              </Link>
              <Link
                href="https://instagram.com/marvel"
                className="text-[#A1A1AA] hover:text-[#ED1D24] transition-colors duration-300"
              >
                <Instagram size={20} />
              </Link>
              <Link
                href="https://youtube.com/marvel"
                className="text-[#A1A1AA] hover:text-[#ED1D24] transition-colors duration-300"
              >
                <Youtube size={20} />
              </Link>
              <Link
                href="https://facebook.com/marvel"
                className="text-[#A1A1AA] hover:text-[#ED1D24] transition-colors duration-300"
              >
                <Facebook size={20} />
              </Link>
            </div>
          </div>

          {/* Navigation Columns */}
          <div className="md:col-span-2 space-y-6">
            <h4 className="font-header text-sm uppercase tracking-[0.2em] text-white border-l-2 border-[#ED1D24] pl-3">
              Universe
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/"
                  className="font-label text-xs text-[#A1A1AA] hover:text-white transition-colors uppercase tracking-widest flex items-center group"
                >
                  Home{" "}
                  <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all ml-1 text-[#ED1D24]">
                    ›
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="/characters"
                  className="font-label text-xs text-[#A1A1AA] hover:text-white transition-colors uppercase tracking-widest flex items-center group"
                >
                  Characters{" "}
                  <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all ml-1 text-[#ED1D24]">
                    ›
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="font-label text-xs text-[#A1A1AA] hover:text-white transition-colors uppercase tracking-widest flex items-center group"
                >
                  Movies{" "}
                  <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all ml-1 text-[#ED1D24]">
                    ›
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="font-label text-xs text-[#A1A1AA] hover:text-white transition-colors uppercase tracking-widest flex items-center group"
                >
                  Comics{" "}
                  <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all ml-1 text-[#ED1D24]">
                    ›
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-6">
            <h4 className="font-header text-sm uppercase tracking-[0.2em] text-white border-l-2 border-[#00D4FF] pl-3">
              Resources
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="#"
                  className="font-label text-xs text-[#A1A1AA] hover:text-white transition-colors uppercase tracking-widest flex items-center group"
                >
                  Help Center{" "}
                  <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all ml-1 text-[#00D4FF]">
                    ›
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="font-label text-xs text-[#A1A1AA] hover:text-white transition-colors uppercase tracking-widest flex items-center group"
                >
                  Press Room{" "}
                  <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all ml-1 text-[#00D4FF]">
                    ›
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="font-label text-xs text-[#A1A1AA] hover:text-white transition-colors uppercase tracking-widest flex items-center group"
                >
                  Showtimes{" "}
                  <ExternalLink size={10} className="ml-1 opacity-50" />
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="font-label text-xs text-[#A1A1AA] hover:text-white transition-colors uppercase tracking-widest flex items-center group"
                >
                  Newsletter{" "}
                  <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all ml-1 text-[#00D4FF]">
                    ›
                  </span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Call to Action Column */}
          <div className="md:col-span-4 space-y-6">
            <div className="bg-[#121212] p-6 border border-white/5 relative overflow-hidden group">
              {/* Scanline Effect */}
              <div className="absolute inset-0 bg-scanline opacity-5 pointer-events-none" />

              <h4 className="font-header text-lg uppercase text-white mb-4 italic tracking-tight">
                Join the Hero Initiative
              </h4>
              <p className="font-body text-[#A1A1AA] text-xs mb-6 leading-relaxed">
                Get classified updates on upcoming releases, exclusive trailers,
                and early access to ticket sales.
              </p>

              <div className="relative">
                <input
                  type="email"
                  placeholder="AGENT_EMAIL@STARK.COM"
                  className="w-full bg-[#1A1A1A] border border-white/10 text-white font-label text-[10px] px-4 py-3 focus:outline-none focus:border-[#ED1D24] transition-colors placeholder:text-zinc-700"
                />
                <button
                  className="mt-3 w-full bg-[#ED1D24] text-white font-display uppercase py-3 tracking-widest text-sm hover:bg-red-500 transition-colors shadow-[var(--shadow-glow-red)] active:scale-[0.98]"
                  style={{
                    clipPath:
                      "polygon(5% 0, 100% 0, 100% 70%, 95% 100%, 0 100%, 0% 30%)",
                  }}
                >
                  Authorize Access
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-wrap justify-center md:justify-start gap-x-8 gap-y-2">
            <span className="font-label text-[10px] text-[#A1A1AA] tracking-[0.2em]">
              © {currentYear} MARVEL
            </span>
            <Link
              href="#"
              className="font-label text-[10px] text-[#A1A1AA] hover:text-[#ED1D24] transition-colors tracking-[0.2em] flex items-center gap-1"
            >
              <ShieldCheck size={12} /> Privacy Policy
            </Link>
            <Link
              href="#"
              className="font-label text-[10px] text-[#A1A1AA] hover:text-[#ED1D24] transition-colors tracking-[0.2em] flex items-center gap-1"
            >
              <Info size={12} /> Terms of Use
            </Link>
            <Link
              href="#"
              className="font-label text-[10px] text-[#A1A1AA] hover:text-[#ED1D24] transition-colors tracking-[0.2em] flex items-center gap-1"
            >
              <Globe size={12} /> Interest-Based Ads
            </Link>
          </div>

          <div className="flex items-center gap-6 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
            {/* Mock Partner Logos */}
            <div className="font-display text-lg text-white tracking-widest">
              DISNEY+
            </div>
            <div className="font-display text-lg text-white tracking-widest">
              IMAX
            </div>
            <div className="font-display text-lg text-white tracking-widest">
              DOLBY
            </div>
          </div>
        </div>

        {/* Dossier ID Decorative element */}
        <div className="mt-8 text-center">
          <span className="font-label text-[9px] text-zinc-800 tracking-[0.5em] uppercase">
            System Status: Online // Node: MCU-WEB-LNC-04 // Encryption:
            AES-256-MARVEL
          </span>
        </div>
      </div>

      {/* Decorative Corner Slash */}
      <div
        className="absolute bottom-0 right-0 w-32 h-32 bg-gradient-to-tl from-[#ED1D24]/10 to-transparent pointer-events-none"
        style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
      />
    </footer>
  );
}
