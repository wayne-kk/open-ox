"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Cpu,
  Fingerprint,
  Zap,
  ChevronRight,
  AlertCircle,
  Loader2,
  Terminal,
} from "lucide-react";

/**
 * RegistrationSection
 * Final conversion point for the Cyber-Night Halloween 2024 landing page.
 * Features a "Data-Pad" aesthetic, neon interactions, and glitch-inspired motion.
 */
export default function RegistrationSection() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success">(
    "idle",
  );
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    alias: "",
    neuralClass: "infiltrator",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    // Simulate network latency for "System Uplink"
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setStatus("success");
  };

  const inputClasses = `
    w-full bg-[#121214] border border-[#2A2A2F] px-4 py-3 
    font-label text-[#E0E0E0] placeholder-[#4A4A4F] 
    focus:outline-none focus:border-[#00F3FF] focus:ring-1 focus:ring-[#00F3FF]
    transition-all duration-200 uppercase tracking-wider text-sm
  `;

  const labelClasses =
    "block font-label text-[10px] text-[#88888F] mb-1 tracking-[0.2em] uppercase";

  return (
    <section className="relative py-24 bg-[#050505] overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-cyber-grid opacity-20 pointer-events-none" />
      <div className="absolute inset-0 bg-scanlines opacity-5 pointer-events-none" />

      {/* Decorative Glows */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-96 h-96 bg-[#FF00FF]/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#00F3FF]/5 blur-[150px] rounded-full" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className="mb-12 text-center md:text-left">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1 border border-[#00F3FF]/30 bg-[#00F3FF]/5 mb-4"
            >
              <Terminal className="w-4 h-4 text-[#00F3FF]" />
              <span className="font-label text-xs text-[#00F3FF] tracking-[0.3em] uppercase">
                Protocol: Secure_Registration
              </span>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-header text-4xl md:text-6xl text-[#E0E0E0] uppercase tracking-widest mb-4"
            >
              Secure Your <span className="text-[#FF00FF]">Access</span>
            </motion.h2>
            <p className="font-body text-[#88888F] max-w-xl text-lg">
              The grid is closing. Register your neural signature to bypass the
              Halloween blackout and join the underground elite.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Form Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="lg:col-span-7 relative group"
            >
              {/* Card Decoration: Top Left Line */}
              <div className="absolute -top-1 -left-1 w-12 h-[2px] bg-[#00F3FF] z-20" />
              <div className="absolute -top-1 -left-1 w-[2px] h-12 bg-[#00F3FF] z-20" />

              <div
                className="bg-[#0D0D0F] border border-[#2A2A2F] p-8 md:p-10 shadow-card-glow relative overflow-hidden"
                style={{
                  clipPath:
                    "polygon(0% 0%, 100% 0%, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0% 100%)",
                }}
              >
                <AnimatePresence mode="wait">
                  {status !== "success" ? (
                    <motion.form
                      key="registration-form"
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, y: -20 }}
                      onSubmit={handleSubmit}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="fullName" className={labelClasses}>
                            Full Identity
                          </label>
                          <input
                            required
                            type="text"
                            id="fullName"
                            placeholder="J. DOE"
                            className={inputClasses}
                            value={formData.fullName}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                fullName: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <label htmlFor="alias" className={labelClasses}>
                            Cyber-Alias (Optional)
                          </label>
                          <input
                            type="text"
                            id="alias"
                            placeholder="GHOST_RUNNER"
                            className={inputClasses}
                            value={formData.alias}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                alias: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="email" className={labelClasses}>
                          Neural Link (Email)
                        </label>
                        <input
                          required
                          type="email"
                          id="email"
                          placeholder="UPLINK@CYBER-NIGHT.COM"
                          className={inputClasses}
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                        />
                      </div>

                      <div>
                        <label className={labelClasses}>
                          Neural Class Selection
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {["Infiltrator", "Netrunner", "Enforcer"].map(
                            (cls) => (
                              <button
                                key={cls}
                                type="button"
                                onClick={() =>
                                  setFormData({
                                    ...formData,
                                    neuralClass: cls.toLowerCase(),
                                  })
                                }
                                className={`
                                py-2 text-[10px] font-label border transition-all duration-200 uppercase tracking-tighter
                                ${
                                  formData.neuralClass === cls.toLowerCase()
                                    ? "bg-[#00F3FF]/10 border-[#00F3FF] text-[#00F3FF]"
                                    : "bg-[#121214] border-[#2A2A2F] text-[#88888F] hover:border-[#88888F]"
                                }
                              `}
                              >
                                {cls}
                              </button>
                            ),
                          )}
                        </div>
                      </div>

                      <div className="pt-4">
                        <button
                          disabled={status === "submitting"}
                          type="submit"
                          className="group relative w-full bg-[#FF00FF] py-4 font-label text-[#050505] font-bold uppercase tracking-[0.3em] overflow-hidden transition-transform active:scale-95 disabled:opacity-70"
                          style={{
                            clipPath:
                              "polygon(0% 0%, 100% 0%, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0% 100%)",
                          }}
                        >
                          <span className="relative z-10 flex items-center justify-center gap-2">
                            {status === "submitting" ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Transmitting...
                              </>
                            ) : (
                              <>
                                Initialize Uplink
                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                              </>
                            )}
                          </span>

                          {/* Glitch Overlay Effect */}
                          <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 justify-center mt-4">
                        <ShieldCheck className="w-3 h-3 text-[#BCFF00]" />
                        <span className="font-label text-[9px] text-[#4A4A4F] uppercase tracking-widest">
                          Encrypted Connection Established // 256-bit AES
                        </span>
                      </div>
                    </motion.form>
                  ) : (
                    <motion.div
                      key="success-message"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center justify-center py-12 text-center"
                    >
                      <div className="w-20 h-20 bg-[#BCFF00]/10 rounded-full flex items-center justify-center mb-6 border border-[#BCFF00]/30">
                        <Zap className="w-10 h-10 text-[#BCFF00] fill-[#BCFF00]" />
                      </div>
                      <h3 className="font-display text-3xl text-[#E0E0E0] italic uppercase mb-2">
                        Access Granted
                      </h3>
                      <p className="font-label text-[#BCFF00] text-sm tracking-widest mb-6">
                        REGISTRATION_COMPLETE // ID:{" "}
                        {Math.random().toString(36).substr(2, 9).toUpperCase()}
                      </p>
                      <p className="font-body text-[#88888F] max-w-xs mb-8">
                        Your neural link has been established. Check your
                        terminal for the entry coordinates.
                      </p>
                      <button
                        onClick={() => setStatus("idle")}
                        className="font-label text-xs text-[#00F3FF] border-b border-[#00F3FF] pb-1 hover:text-[#FF00FF] hover:border-[#FF00FF] transition-colors"
                      >
                        REGISTER ANOTHER OPERATIVE
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Sidebar Info */}
            <div className="lg:col-span-5 space-y-6">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="p-6 border border-[#2A2A2F] bg-[#0D0D0F]/50 backdrop-blur-sm"
              >
                <div className="flex items-start gap-4 mb-4">
                  <Fingerprint className="w-8 h-8 text-[#00F3FF]" />
                  <div>
                    <h4 className="font-header text-[#E0E0E0] text-lg uppercase tracking-wide">
                      Identity Verification
                    </h4>
                    <p className="font-body text-xs text-[#88888F] leading-relaxed">
                      All attendees must provide a valid cyber-alias for the
                      event leaderboards and internal communication networks.
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="p-6 border border-[#2A2A2F] bg-[#0D0D0F]/50 backdrop-blur-sm"
              >
                <div className="flex items-start gap-4 mb-4">
                  <Cpu className="w-8 h-8 text-[#FF00FF]" />
                  <div>
                    <h4 className="font-header text-[#E0E0E0] text-lg uppercase tracking-wide">
                      Hardware Requirements
                    </h4>
                    <p className="font-body text-xs text-[#88888F] leading-relaxed">
                      Bring your own deck. Minimum specs: Neural-Link v4.2 or
                      equivalent physical interface. No legacy tech allowed.
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="p-6 border border-[#FF3131]/20 bg-[#FF3131]/5"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-[#FF3131] shrink-0" />
                  <p className="font-label text-[10px] text-[#FF3131] uppercase tracking-widest leading-normal">
                    Warning: Capacity is at 88%. Registration window closes in
                    48 hours or upon full grid saturation.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Side Data Lines */}
      <div className="hidden xl:block absolute left-8 top-1/4 bottom-1/4 w-[1px] bg-gradient-to-b from-transparent via-[#2A2A2F] to-transparent">
        <div className="absolute top-1/4 -left-1 w-2 h-2 bg-[#00F3FF]" />
        <div className="absolute top-1/2 -left-1 w-2 h-2 bg-[#FF00FF]" />
      </div>
      <div className="hidden xl:block absolute right-8 top-1/4 bottom-1/4 w-[1px] bg-gradient-to-b from-transparent via-[#2A2A2F] to-transparent">
        <div className="absolute bottom-1/4 -right-1 w-2 h-2 bg-[#BCFF00]" />
      </div>
    </section>
  );
}
/* 
Note: Ensure Orbitron, Rajdhani, and JetBrains Mono fonts are loaded in your layout. 
Tailwind classes like bg-cyber-grid, bg-scanlines, and shadow-card-glow are assumed to be defined in globals.css per design system.
*/
