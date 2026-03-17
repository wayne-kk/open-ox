import React from "react";
import Link from "next/link";
import {
  Twitter,
  Instagram,
  Github,
  Disc as Discord,
  MapPin,
  Mail,
  ShieldAlert,
  Zap,
} from "lucide-react";

export default function FooterSection() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative w-full bg-[#050505] border-t border-[#2A2A2F] overflow-hidden">
      {/* Texture Overlays */}
      <div className="absolute inset-0 bg-cyber-grid opacity-20 pointer-events-none" />
      <div className="absolute inset-0 bg-scanlines opacity-10 pointer-events-none" />

      {/* Decorative Top Accent */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#FF00FF] to-transparent opacity-50" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-8">
          {/* Brand Column */}
          <div className="md:col-span-4 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FF00FF] clip-cyber flex items-center justify-center shadow-[0_0_15px_rgba(255,0,255,0.4)]">
                <Zap className="text-[#050505] w-6 h-6 fill-current" />
              </div>
              <span className="font-display text-2xl tracking-tighter italic text-[#E0E0E0]">
                CYBER<span className="text-[#FF00FF]">-</span>NIGHT
              </span>
            </div>

            <p className="font-body text-[#88888F] text-sm leading-relaxed max-w-xs">
              The definitive underground Halloween experience. Fusing high-tech
              aesthetics with low-life thrills in the heart of the Industrial
              District.
            </p>

            <div className="flex items-center gap-4">
              <Link
                href="#"
                className="p-2 border border-[#2A2A2F] hover:border-[#00F3FF] hover:text-[#00F3FF] transition-all duration-200 group"
              >
                <Twitter className="w-5 h-5 group-hover:drop-shadow-[0_0_8px_rgba(0,243,255,0.8)]" />
              </Link>
              <Link
                href="#"
                className="p-2 border border-[#2A2A2F] hover:border-[#FF00FF] hover:text-[#FF00FF] transition-all duration-200 group"
              >
                <Discord className="w-5 h-5 group-hover:drop-shadow-[0_0_8px_rgba(255,0,255,0.8)]" />
              </Link>
              <Link
                href="#"
                className="p-2 border border-[#2A2A2F] hover:border-[#BCFF00] hover:text-[#BCFF00] transition-all duration-200 group"
              >
                <Instagram className="w-5 h-5 group-hover:drop-shadow-[0_0_8px_rgba(188,255,0,0.8)]" />
              </Link>
              <Link
                href="#"
                className="p-2 border border-[#2A2A2F] hover:border-[#E0E0E0] hover:text-[#E0E0E0] transition-all duration-200 group"
              >
                <Github className="w-5 h-5 group-hover:drop-shadow-[0_0_8px_rgba(224,224,224,0.5)]" />
              </Link>
            </div>
          </div>

          {/* Navigation Column */}
          <div className="md:col-span-2 space-y-6">
            <h4 className="font-header text-[#00F3FF] text-sm tracking-widest uppercase">
              Navigation
            </h4>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/"
                  className="font-label text-xs text-[#88888F] hover:text-[#E0E0E0] transition-colors uppercase tracking-wider block"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="#schedule"
                  className="font-label text-xs text-[#88888F] hover:text-[#E0E0E0] transition-colors uppercase tracking-wider block"
                >
                  Schedule
                </Link>
              </li>
              <li>
                <Link
                  href="#features"
                  className="font-label text-xs text-[#88888F] hover:text-[#E0E0E0] transition-colors uppercase tracking-wider block"
                >
                  Highlights
                </Link>
              </li>
              <li>
                <Link
                  href="#register"
                  className="font-label text-xs text-[#88888F] hover:text-[#E0E0E0] transition-colors uppercase tracking-wider block"
                >
                  Registration
                </Link>
              </li>
            </ul>
          </div>

          {/* Information Column */}
          <div className="md:col-span-3 space-y-6">
            <h4 className="font-header text-[#00F3FF] text-sm tracking-widest uppercase">
              Information
            </h4>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#FF00FF] mt-1 shrink-0" />
                <div className="font-label text-xs text-[#88888F] uppercase leading-relaxed">
                  Sector 7-G, Warehouse 404
                  <br />
                  Industrial District, Neo-City
                  <br />
                  NC 2024-H
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[#FF00FF] shrink-0" />
                <span className="font-label text-xs text-[#88888F] uppercase tracking-wider">
                  contact@cyber-night.io
                </span>
              </div>
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-4 h-4 text-[#BCFF00] shrink-0" />
                <span className="font-label text-xs text-[#88888F] uppercase tracking-wider">
                  Safety Protocol Active
                </span>
              </div>
            </div>
          </div>

          {/* Status Column */}
          <div className="md:col-span-3">
            <div className="bg-[#0D0D0F] border border-[#2A2A2F] p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-12 h-[1px] bg-[#00F3FF]" />
              <div className="absolute top-0 right-0 w-[1px] h-12 bg-[#00F3FF]" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-label text-[10px] text-[#88888F] uppercase tracking-widest">
                    System Status
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#BCFF00] animate-pulse" />
                    <span className="font-label text-[10px] text-[#BCFF00] uppercase">
                      Online
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="h-1 w-full bg-[#1A1A1D]">
                    <div className="h-full w-[84%] bg-[#FF00FF]" />
                  </div>
                  <div className="flex justify-between font-label text-[9px] text-[#88888F] uppercase">
                    <span>Capacity Load</span>
                    <span className="text-[#E0E0E0]">84% Filled</span>
                  </div>
                </div>

                <div className="pt-2">
                  <p className="font-label text-[10px] text-[#88888F] italic leading-tight">
                    "The future is already here — it's just not very evenly
                    distributed."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-20 pt-8 border-t border-[#2A2A2F] flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="order-2 md:order-1">
            <p className="font-label text-[10px] text-[#4A4A4F] uppercase tracking-widest">
              &copy; {currentYear} Cyber-Night Events. All Rights Reserved. //
              Unauthorized cloning will be prosecuted.
            </p>
          </div>

          <div className="order-1 md:order-2 flex flex-wrap justify-center gap-6">
            <Link
              href="#"
              className="font-label text-[10px] text-[#88888F] hover:text-[#00F3FF] transition-colors uppercase tracking-widest"
            >
              Terms of Engagement
            </Link>
            <Link
              href="#"
              className="font-label text-[10px] text-[#88888F] hover:text-[#00F3FF] transition-colors uppercase tracking-widest"
            >
              Privacy Protocol
            </Link>
            <Link
              href="#"
              className="font-label text-[10px] text-[#88888F] hover:text-[#00F3FF] transition-colors uppercase tracking-widest"
            >
              Cookie Cache
            </Link>
          </div>
        </div>
      </div>

      {/* Visual Glitch Decorative Element */}
      <div className="absolute bottom-0 right-0 w-32 h-32 opacity-5 pointer-events-none overflow-hidden">
        <div className="text-[120px] font-display text-[#FF00FF] leading-none select-none translate-x-10 translate-y-10">
          24
        </div>
      </div>
    </footer>
  );
}
