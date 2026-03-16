import React, { useState } from "react";
import {
  Ghost,
  Instagram,
  Twitter,
  Youtube,
  Mail,
  MapPin,
  Phone,
  Send,
} from "lucide-react";

const FooterSection = () => {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle newsletter logic
    alert("You've been added to the coven.");
    setEmail("");
  };

  return (
    <footer className="relative bg-[#0A090C] text-[#F2F2F7] overflow-hidden border-t border-[#3D3945]">
      {/* Texture Overlays */}
      <div className="absolute inset-0 pointer-events-none opacity-5 mix-blend-overlay">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
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

      {/* Vignette effect */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(10,9,12,0.8)_100%)]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-24 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-8">
          {/* Brand & Newsletter Column */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-4">
              <h2 className="font-['Syne'] text-4xl md:text-5xl font-extrabold tracking-tighter uppercase leading-none">
                Stay{" "}
                <span className="text-[#FF6200] animate-[flicker_3s_infinite] drop-shadow-[0_0_10px_rgba(255,98,0,0.5)]">
                  Haunted
                </span>
              </h2>
              <p className="font-['Outfit'] text-[#A19DA8] max-w-md text-lg">
                Join our nocturnal inner circle. Get exclusive access to
                midnight rituals, secret events, and early-bird tickets before
                they vanish into the mist.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="relative group max-w-md">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-grow">
                  <input
                    type="email"
                    required
                    placeholder="ENTER YOUR EMAIL IF YOU DARE..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#1F1D24] border border-[#3D3945] text-[#F2F2F7] px-4 py-4 font-['JetBrains_Mono'] text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-[#32FF7E] focus:border-transparent transition-all placeholder:text-[#2C2833]"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-[#32FF7E] text-[#0A090C] font-bold uppercase tracking-widest px-8 py-4 transition-all duration-300 hover:bg-white hover:shadow-[0_0_20px_rgba(50,255,126,0.6)] active:scale-95 flex items-center justify-center gap-2 group"
                  style={{
                    clipPath:
                      "polygon(10% 0, 100% 0, 100% 80%, 90% 100%, 0 100%, 0 20%)",
                  }}
                >
                  Summon
                  <Send className="w-4 h-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                </button>
              </div>
            </form>
          </div>

          {/* Quick Links Column */}
          <div className="lg:col-span-3 space-y-8">
            <h3 className="font-['Syne'] text-xl font-bold uppercase tracking-widest text-[#FF6200]">
              The Lair
            </h3>
            <ul className="space-y-4 font-['Outfit']">
              {[
                "Attractions",
                "Tickets",
                "Schedule",
                "Merchandise",
                "Safety Guide",
              ].map((link) => (
                <li key={link}>
                  <a
                    href={`#${link.toLowerCase()}`}
                    className="text-[#A19DA8] hover:text-[#32FF7E] transition-colors flex items-center gap-2 group"
                  >
                    <span className="w-1.5 h-1.5 bg-[#3D3945] group-hover:bg-[#32FF7E] transition-colors" />
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Social Column */}
          <div className="lg:col-span-4 space-y-8">
            <h3 className="font-['Syne'] text-xl font-bold uppercase tracking-widest text-[#FF6200]">
              Contact The Coven
            </h3>
            <div className="space-y-6 font-['Outfit']">
              <div className="flex items-start gap-4 text-[#A19DA8]">
                <MapPin className="w-6 h-6 text-[#32FF7E] shrink-0" />
                <p>
                  1313 Shadow Lane, Nocturne Valley, <br />
                  The Great Beyond, 66600
                </p>
              </div>
              <div className="flex items-center gap-4 text-[#A19DA8]">
                <Phone className="w-6 h-6 text-[#32FF7E] shrink-0" />
                <p>+1 (800) SPOOKY-0</p>
              </div>
              <div className="flex items-center gap-4 text-[#A19DA8]">
                <Mail className="w-6 h-6 text-[#32FF7E] shrink-0" />
                <p>omens@spooktacular.com</p>
              </div>
            </div>

            <div className="pt-4">
              <div className="flex gap-4">
                {[
                  { icon: Twitter, label: "Twitter" },
                  { icon: Instagram, label: "Instagram" },
                  { icon: Youtube, label: "Youtube" },
                  { icon: Ghost, label: "Ghostly" },
                ].map((social, idx) => (
                  <a
                    key={idx}
                    href="#"
                    aria-label={social.label}
                    className="p-3 bg-[#16141A] border border-[#3D3945] text-[#F2F2F7] hover:text-[#32FF7E] hover:border-[#32FF7E] transition-all hover:-translate-y-1 shadow-[4px_4px_0px_0px_rgba(50,255,126,0.1)]"
                    style={{
                      clipPath:
                        "polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%)",
                    }}
                  >
                    <social.icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="mt-24 pt-8 border-t border-[#3D3945]/50 flex flex-col md:flex-row justify-between items-center gap-6 text-[#2C2833] font-['JetBrains_Mono'] text-xs tracking-widest uppercase">
          <p>© 2024 HALLOWEEN SPOOKTACULAR. ALL SOULS RESERVED.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-[#A19DA8] transition-colors">
              Privacy Rituals
            </a>
            <a href="#" className="hover:text-[#A19DA8] transition-colors">
              Terms of Torment
            </a>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes flicker {
          0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100% { 
            opacity: 1; 
            text-shadow: 0 0 12px rgba(255, 98, 0, 0.8);
          }
          20%, 21.999%, 63%, 63.999%, 65%, 69.999% { 
            opacity: 0.4; 
            text-shadow: none; 
          }
        }

        @font-face {
          font-family: 'Syne';
          font-style: normal;
          font-weight: 800;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/syne/v22/8vIJ7wUr7m_h_XwXvX_Y.woff2) format('woff2');
        }

        @font-face {
          font-family: 'Outfit';
          font-style: normal;
          font-weight: 400;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/outfit/v11/QGYsz_ic7ZTeqKnH5S7S.woff2) format('woff2');
        }

        @font-face {
          font-family: 'JetBrains Mono';
          font-style: normal;
          font-weight: 400;
          font-display: swap;
          src: url(https://fonts.gstatic.com/s/jetbrainsmono/v18/t6nu43064NGu-uWg0LpL_23Wv-qF.woff2) format('woff2');
        }
      `,
        }}
      />
    </footer>
  );
};

export default FooterSection;
