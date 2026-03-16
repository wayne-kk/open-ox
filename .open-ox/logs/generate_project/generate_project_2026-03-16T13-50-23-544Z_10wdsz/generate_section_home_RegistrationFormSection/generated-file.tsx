import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import {
  Skull,
  Ghost,
  Zap,
  CheckCircle2,
  ChevronDown,
  Send,
} from "lucide-react";

const RegistrationFormSection = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log("Form Data:", data);
    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  const chamferedClipPath = {
    clipPath: "polygon(5% 0, 100% 0, 100% 90%, 95% 100%, 0 100%, 0 10%)",
  };

  const noiseOverlay = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
  };

  return (
    <section className="relative py-24 px-6 overflow-hidden bg-[#0A090C] font-['Outfit']">
      {/* Background Textures */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={noiseOverlay}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundSize: "40px 40px",
          backgroundImage:
            "radial-gradient(circle, #3D3945 1px, transparent 1px)",
        }}
      />

      {/* Decorative Floating Elements */}
      <motion.div
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-[10%] opacity-20 hidden lg:block"
      >
        <Ghost className="w-16 h-16 text-[#32FF7E]" />
      </motion.div>
      <motion.div
        animate={{ y: [0, 20, 0] }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
        className="absolute bottom-20 right-[10%] opacity-20 hidden lg:block"
      >
        <Skull className="w-20 h-20 text-[#FF6200]" />
      </motion.div>

      <div className="max-w-xl mx-auto relative z-10">
        <AnimatePresence mode="wait">
          {!isSubmitted ? (
            <motion.div
              key="form-container"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#16141A] border border-[#3D3945] p-8 md:p-12 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative"
              style={chamferedClipPath}
            >
              <div className="text-center mb-10">
                <h2 className="font-['Creepster'] text-4xl md:text-5xl text-[#FF6200] mb-4 tracking-wider animate-pulse">
                  Join the Ritual
                </h2>
                <p className="font-['Syne'] text-[#A19DA8] uppercase tracking-widest text-sm">
                  Limited spots available for the midnight gala
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Name Field */}
                <div className="space-y-2">
                  <label className="font-['JetBrains_Mono'] text-xs text-[#32FF7E] uppercase tracking-tighter flex items-center gap-2">
                    <Zap className="w-3 h-3" /> Mortal Name
                  </label>
                  <input
                    {...register("name", { required: "Name is required" })}
                    placeholder="Enter your alias..."
                    className={`w-full bg-[#1F1D24] border ${errors.name ? "border-[#FF3E3E]" : "border-[#3D3945]"} text-[#F2F2F7] p-4 outline-none focus:ring-2 focus:ring-[#32FF7E] transition-all placeholder:text-[#2C2833]`}
                  />
                  {errors.name && (
                    <span className="text-[#FF3E3E] text-xs font-mono">
                      {errors.name.message as string}
                    </span>
                  )}
                </div>

                {/* Email Field */}
                <div className="space-y-2">
                  <label className="font-['JetBrains_Mono'] text-xs text-[#32FF7E] uppercase tracking-tighter flex items-center gap-2">
                    <Send className="w-3 h-3" /> Digital Essence (Email)
                  </label>
                  <input
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^\S+@\S+$/i,
                        message: "Invalid spirit address",
                      },
                    })}
                    type="email"
                    placeholder="you@thevoid.com"
                    className={`w-full bg-[#1F1D24] border ${errors.email ? "border-[#FF3E3E]" : "border-[#3D3945]"} text-[#F2F2F7] p-4 outline-none focus:ring-2 focus:ring-[#32FF7E] transition-all placeholder:text-[#2C2833]`}
                  />
                  {errors.email && (
                    <span className="text-[#FF3E3E] text-xs font-mono">
                      {errors.email.message as string}
                    </span>
                  )}
                </div>

                {/* Dropdown Field */}
                <div className="space-y-2 relative">
                  <label className="font-['JetBrains_Mono'] text-xs text-[#32FF7E] uppercase tracking-tighter flex items-center gap-2">
                    <Skull className="w-3 h-3" /> Choose Your Poison
                  </label>
                  <div className="relative">
                    <select
                      {...register("ticketType", {
                        required: "Select your fate",
                      })}
                      className="w-full bg-[#1F1D24] border border-[#3D3945] text-[#F2F2F7] p-4 outline-none focus:ring-2 focus:ring-[#32FF7E] appearance-none transition-all cursor-pointer"
                    >
                      <option value="" disabled selected>
                        Select ticket type...
                      </option>
                      <option value="ghost">The Ghost (Standard)</option>
                      <option value="vampire">The Vampire (VIP Access)</option>
                      <option value="overlord">
                        The Overlord (All-Access)
                      </option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A19DA8] pointer-events-none" />
                  </div>
                  {errors.ticketType && (
                    <span className="text-[#FF3E3E] text-xs font-mono">
                      {errors.ticketType.message as string}
                    </span>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full group relative mt-4 overflow-hidden py-5 bg-[#FF6200] text-[#0A090C] font-bold uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={chamferedClipPath}
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    {isSubmitting ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      >
                        <Zap className="w-5 h-5" />
                      </motion.div>
                    ) : (
                      <>
                        Claim Your Spot <Zap className="w-5 h-5 fill-current" />
                      </>
                    )}
                  </span>
                </button>
              </form>

              {/* Bottom Decoration */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-[#32FF7E] to-transparent blur-sm" />
            </motion.div>
          ) : (
            <motion.div
              key="success-message"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center bg-[#16141A] border border-[#32FF7E] p-12 shadow-[0_0_60px_rgba(50,255,126,0.15)] relative"
              style={chamferedClipPath}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 10 }}
                className="w-24 h-24 bg-[#32FF7E] rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(50,255,126,0.5)]"
              >
                <CheckCircle2 className="w-12 h-12 text-[#0A090C]" />
              </motion.div>
              <h2 className="font-['Creepster'] text-5xl text-[#32FF7E] mb-4 tracking-widest">
                You're In!
              </h2>
              <p className="font-['Outfit'] text-[#F2F2F7] text-lg mb-8">
                Your soul has been successfully registered. Check your inbox for
                the secret coordinates.
              </p>
              <button
                onClick={() => setIsSubmitted(false)}
                className="font-['JetBrains_Mono'] text-xs text-[#A19DA8] uppercase tracking-[0.3em] hover:text-[#FF6200] transition-colors"
              >
                Register another mortal?
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Decorative Slime Drips (CSS only) */}
      <div className="absolute top-0 left-1/4 w-px h-24 bg-gradient-to-b from-[#32FF7E] to-transparent opacity-40" />
      <div className="absolute top-0 right-1/3 w-px h-40 bg-gradient-to-b from-[#32FF7E] to-transparent opacity-20" />

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
          }
          20%,
          21.999%,
          63%,
          63.999%,
          65%,
          69.999% {
            opacity: 0.4;
          }
        }
        .animate-flicker {
          animation: flicker 3s infinite;
        }
      `}</style>
    </section>
  );
};

export default RegistrationFormSection;
