"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  MapPin,
  Calendar,
  ChevronRight,
  Info,
  Ticket,
  Clock,
} from "lucide-react";

const DATES = [
  { day: "FRI", date: "15", month: "NOV" },
  { day: "SAT", date: "16", month: "NOV" },
  { day: "SUN", date: "17", month: "NOV" },
  { day: "MON", date: "18", month: "NOV" },
  { day: "TUE", date: "19", month: "NOV" },
  { day: "WED", date: "20", month: "NOV" },
  { day: "THU", date: "21", month: "NOV" },
];

const THEATERS = [
  {
    id: 1,
    name: "Stark Expo IMAX Theater",
    distance: "0.8 miles",
    address: "700 Flushing Ave, Brooklyn, NY",
    formats: ["IMAX 3D", "Dolby Cinema", "70MM"],
    times: ["10:30 AM", "1:45 PM", "5:00 PM", "8:15 PM", "11:30 PM"],
    soldOut: ["10:30 AM"],
  },
  {
    id: 2,
    name: "Daily Bugle Cinemas",
    distance: "1.2 miles",
    address: "175th St & Broadway, Manhattan, NY",
    formats: ["Standard", "RealD 3D"],
    times: ["11:00 AM", "12:30 PM", "3:45 PM", "7:00 PM", "10:15 PM"],
    soldOut: [],
  },
  {
    id: 3,
    name: "Baxter Building Multiplex",
    distance: "2.5 miles",
    address: "42nd St & Madison Ave, Manhattan, NY",
    formats: ["Dolby Cinema", "Standard"],
    times: ["12:00 PM", "3:15 PM", "6:30 PM", "9:45 PM"],
    soldOut: ["6:30 PM", "9:45 PM"],
  },
];

export default function TicketBookingSection() {
  const [selectedDate, setSelectedDate] = useState(0);
  const [zipCode, setZipCode] = useState("11206");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), 800);
  };

  return (
    <section className="relative min-h-screen bg-[#050505] py-24 md:py-32 overflow-hidden">
      {/* Background Textures */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.05) 1px, transparent 0)`,
          backgroundSize: "20px 20px",
        }}
      />

      {/* Decorative Asymmetric Slashes */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-[#ED1D24]/5 -skew-x-12 transform translate-x-1/4 pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-12 gap-8">
          <div className="max-w-2xl">
            <div className="inline-block bg-[#ED1D24] text-white font-label px-3 py-1 mb-4 tracking-widest text-xs">
              MISSION CRITICAL: SECURE ACCESS
            </div>
            <h2 className="text-5xl md:text-7xl font-display uppercase tracking-tight text-white mb-4">
              Get Your <span className="text-[#ED1D24]">Tickets</span>
            </h2>
            <p className="font-body text-mutedForeground text-lg max-w-xl">
              Witness the cinematic event of the decade. Select your theater,
              choose your experience, and prepare for assembly.
            </p>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="w-full lg:w-96">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#ED1D24] to-[#00D4FF] opacity-20 group-focus-within:opacity-100 transition duration-300 blur-[2px]" />
              <div className="relative flex bg-[#1A1A1A] border border-white/10">
                <div className="flex items-center pl-4 text-zinc-500">
                  <MapPin size={18} />
                </div>
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="ENTER ZIP CODE..."
                  className="w-full bg-transparent border-none text-white font-label px-4 py-4 focus:ring-0 placeholder:text-zinc-600 uppercase tracking-widest"
                />
                <button
                  type="submit"
                  className="bg-[#ED1D24] text-white px-6 flex items-center justify-center hover:bg-red-500 transition-colors"
                >
                  <Search size={20} />
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Date Selector */}
        <div className="flex overflow-x-auto pb-8 mb-12 no-scrollbar gap-4 snap-x">
          {DATES.map((date, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedDate(idx)}
              className={`flex-shrink-0 w-24 h-32 flex flex-col items-center justify-center transition-all duration-300 snap-start relative border-2 ${
                selectedDate === idx
                  ? "bg-[#ED1D24] border-[#ED1D24] text-white translate-y-[-4px] shadow-[var(--shadow-glow-red)]"
                  : "bg-[#121212] border-white/10 text-mutedForeground hover:border-white/30"
              }`}
              style={{
                clipPath:
                  "polygon(15% 0, 100% 0, 100% 85%, 85% 100%, 0 100%, 0% 15%)",
              }}
            >
              <span className="font-label text-xs mb-1 opacity-80">
                {date.day}
              </span>
              <span className="font-display text-3xl mb-1">{date.date}</span>
              <span className="font-label text-xs tracking-widest">
                {date.month}
              </span>
              {selectedDate === idx && (
                <div className="absolute bottom-1 w-8 h-1 bg-white/40 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Theater List */}
        <div className="grid grid-cols-1 gap-6">
          {isSearching ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
              <p className="font-label text-[#00D4FF] animate-pulse uppercase tracking-widest">
                Scanning Local Grid...
              </p>
            </div>
          ) : (
            THEATERS.map((theater) => (
              <div
                key={theater.id}
                className="bg-[#121212] border-l-4 border-[#ED1D24] p-6 md:p-8 flex flex-col lg:flex-row gap-8 relative overflow-hidden group hover:bg-[#1A1A1A] transition-colors"
              >
                {/* Scanline Texture Overlay */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,255,0,0.06))] bg-[length:100%_2px,3px_100%]" />

                {/* Theater Info */}
                <div className="lg:w-1/3">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-header text-2xl text-white uppercase italic tracking-tight group-hover:text-[#ED1D24] transition-colors">
                      {theater.name}
                    </h3>
                    <span className="font-label text-[#00D4FF] text-xs pt-1">
                      {theater.distance}
                    </span>
                  </div>
                  <p className="font-body text-mutedForeground text-sm mb-4">
                    {theater.address}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {theater.formats.map((f) => (
                      <span
                        key={f}
                        className="text-[10px] font-label border border-zinc-700 px-2 py-0.5 text-zinc-400 uppercase"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Showtimes Grid */}
                <div className="lg:w-2/3 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-4 text-zinc-500 font-label text-xs uppercase tracking-widest">
                    <Clock size={14} className="text-[#00D4FF]" />
                    <span>Select Showtime</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {theater.times.map((time) => {
                      const isSoldOut = theater.soldOut.includes(time);
                      return (
                        <button
                          key={time}
                          disabled={isSoldOut}
                          className={`relative group/btn py-3 px-2 font-label text-sm transition-all duration-300 border ${
                            isSoldOut
                              ? "bg-zinc-900/50 border-zinc-800 text-zinc-600 cursor-not-allowed"
                              : "bg-transparent border-[#00D4FF]/30 text-[#00D4FF] hover:bg-[#00D4FF]/10 hover:border-[#00D4FF] hover:shadow-[var(--shadow-glow-blue)]"
                          }`}
                        >
                          {time}
                          {isSoldOut && (
                            <span className="absolute -top-2 -right-1 bg-zinc-800 text-[8px] px-1 text-zinc-500 border border-zinc-700">
                              SOLD OUT
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action Button */}
                <div className="lg:border-l border-white/5 lg:pl-8 flex items-center justify-center">
                  <button
                    className="w-full lg:w-auto bg-[#ED1D24] text-white font-display text-xl uppercase px-8 py-4 flex items-center justify-center gap-3 transition-all duration-300 hover:scale-105 shadow-[var(--shadow-glow-red)] active:scale-95 border-b-4 border-red-900"
                    style={{
                      clipPath:
                        "polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0% 30%)",
                    }}
                  >
                    <Ticket size={20} />
                    BOOK NOW
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Support/Info Footer */}
        <div className="mt-16 flex flex-col md:flex-row items-center justify-between p-6 bg-[#1A1A1A] border border-white/5">
          <div className="flex items-center gap-4 mb-4 md:mb-0">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-[#00D4FF]">
              <Info size={20} />
            </div>
            <div>
              <p className="font-header text-white text-sm uppercase">
                Accessibility & Group Sales
              </p>
              <p className="font-body text-mutedForeground text-xs">
                For parties of 10+ or wheelchair seating, contact theater
                support.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <button className="font-label text-[10px] text-zinc-500 hover:text-white transition-colors underline underline-offset-4">
              REFUND POLICY
            </button>
            <button className="font-label text-[10px] text-zinc-500 hover:text-white transition-colors underline underline-offset-4">
              THEATER SAFETY
            </button>
          </div>
        </div>

        {/* Decorative Watermark */}
        <div className="mt-12 text-center opacity-20 select-none">
          <span
            className="font-display text-8xl md:text-[12rem] text-transparent stroke-text tracking-tighter uppercase"
            style={{
              WebkitTextStroke: "1px rgba(255,255,255,0.2)",
            }}
          >
            AVENGERS
          </span>
        </div>
      </div>
    </section>
  );
}
