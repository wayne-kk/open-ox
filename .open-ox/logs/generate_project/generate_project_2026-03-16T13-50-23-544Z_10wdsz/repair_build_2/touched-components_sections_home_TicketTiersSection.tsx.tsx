import React from "react";
import { Ghost, Skull, Crown, Zap } from "lucide-react";

/**
 * TicketTiersSection Component
 *
 * A high-immersion pricing section for the Halloween Spooktacular.
 * Features three themed tiers: Ghost, Vampire (Featured), and Overlord.
 * Uses the "Neon Gothic" design system with chamfered edges and neon glows.
 */

const TicketTiersSection = () => {
  const chamferedStyle = {
    clipPath: "polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)",
  };

  const tiers = [
    {
      name: "Ghost",
      slug: "ghost",
      price: "29",
      description: "For the casual haunter seeking a night of standard spooks.",
      icon: <Ghost className="w-8 h-8 text-foreground/50" />,
      color: "border-mutedForeground/30",
      accent: "text-mutedForeground",
      buttonVariant: "ghost",
      features: [
        "General Admission",
        "Standard Scare Zones",
        "Midnight Parade Access",
        "Digital Photo Pass",
      ],
    },
    {
      name: "Vampire",
      slug: "vampire",
      price: "66",
      description:
        "The ultimate balance of blood-curdling thrills and premium access.",
      icon: <Skull className="w-8 h-8 text-accent" />,
      color: "border-accent",
      accent: "text-accent",
      buttonVariant: "primary",
      featured: true,
      features: [
        "Priority Entry (Skip Lines)",
        "All Scare Zones + Secret Rooms",
        "VIP Lounge Access",
        "Commemorative Tech-Tee",
        "1 Complimentary 'Blood' Cocktail",
      ],
    },
    {
      name: "Overlord",
      slug: "overlord",
      price: "131",
      description: "Command the night with god-tier perks and total immersion.",
      icon: <Crown className="w-8 h-8 text-accentSecondary" />,
      color: "border-accentSecondary/50",
      accent: "text-accentSecondary",
      buttonVariant: "secondary",
      features: [
        "Instant 'Fast-Track' to all Rides",
        "Private Gothic Booth",
        "Behind-the-Scenes Ghoul Tour",
        "Unlimited Potions & Snacks",
        "Personal 'Shadow' Concierge",
      ],
    },
  ];

  return (
    <section className="relative py-24 bg-[#0A090C] overflow-hidden">
      {/* Background Textures */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundSize: "40px 40px",
          backgroundImage:
            "radial-gradient(circle, #3D3945 1px, transparent 1px)",
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-20 max-w-3xl mx-auto">
          <h2 className="mb-4">
            <span className="block text-accentSecondary font-mono text-sm tracking-[0.3em] uppercase mb-2 animate-pulse">
              Choose Your Fate
            </span>
            <span className="text-5xl md:text-7xl font-extrabold tracking-tighter uppercase font-['Syne'] text-foreground">
              <span className="font-['Creepster'] text-accent">T</span>icket
              <span className="font-['Creepster'] text-accent ml-4">T</span>iers
            </span>
          </h2>
          <p className="text-mutedForeground text-lg font-['Outfit']">
            Select the level of darkness you're willing to endure. Each tier
            unlocks new dimensions of the Midnight Rave.
          </p>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          {tiers.map((tier, index) => (
            <div
              key={tier.slug}
              className={`relative group transition-all duration-500 ${
                tier.featured ? "z-20 scale-105" : "z-10 scale-100"
              } ${index % 2 === 0 ? "md:rotate-1" : "md:-rotate-1"}`}
            >
              {/* Featured Badge */}
              {tier.featured && (
                <div
                  className="absolute -top-5 left-1/2 -translate-x-1/2 bg-accent text-background px-6 py-1 font-['JetBrains_Mono'] font-bold text-xs uppercase tracking-widest z-30 shadow-neon-orange"
                  style={{
                    clipPath:
                      "polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0 50%)",
                  }}
                >
                  Most Popular
                </div>
              )}

              {/* Card Body */}
              <div
                style={chamferedStyle}
                className={`bg-[#16141A] border-2 ${tier.color} p-8 flex flex-col h-full backdrop-blur-md shadow-inner-glow transition-all duration-300 group-hover:border-accentSecondary/50`}
              >
                <div className="mb-8 flex justify-between items-start">
                  <div>
                    <h3
                      className={`text-3xl font-bold font-['Syne'] uppercase tracking-tight ${tier.accent}`}
                    >
                      {tier.name}
                    </h3>
                    <p className="text-mutedForeground text-sm mt-2 font-['Outfit'] leading-tight">
                      {tier.description}
                    </p>
                  </div>
                  <div className="p-3 bg-[#2C2833] rounded-none border border-border">
                    {tier.icon}
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-mutedForeground font-['JetBrains_Mono'] text-xl">
                      $
                    </span>
                    <span className="text-6xl font-extrabold font-['Syne'] tracking-tighter text-foreground">
                      {tier.price}
                    </span>
                    <span className="text-mutedForeground font-['JetBrains_Mono'] text-sm uppercase">
                      / Soul
                    </span>
                  </div>
                </div>

                <ul className="space-y-4 mb-10 flex-grow">
                  {tier.features.map((feature, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm font-['Outfit'] text-foreground/80 group-hover:text-foreground transition-colors"
                    >
                      <Zap
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${tier.accent}`}
                        fill="currentColor"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  style={chamferedStyle}
                  className={`w-full py-4 px-6 font-bold uppercase tracking-widest transition-all duration-300 relative overflow-hidden group/btn
                    ${tier.buttonVariant === "primary" ? "bg-accent text-background hover:bg-white shadow-[0_0_15px_rgba(255,98,0,0.4)] hover:scale-105" : ""}
                    ${tier.buttonVariant === "secondary" ? "border-2 border-accentSecondary text-accentSecondary bg-transparent hover:bg-accentSecondary hover:text-background shadow-[0_0_15px_rgba(50,255,126,0.3)]" : ""}
                    ${tier.buttonVariant === "ghost" ? "bg-[#2C2833] text-foreground/70 hover:text-accent hover:bg-[#3D3945]" : ""}
                  `}
                >
                  <span className="relative z-10">Secure Passage</span>
                  {tier.featured && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite] pointer-events-none" />
                  )}
                </button>
              </div>

              {/* Card Decorative Shadow Glow */}
              {tier.featured && (
                <div className="absolute -inset-1 bg-accent/20 blur-2xl -z-10 rounded-full opacity-50" />
              )}
            </div>
          ))}
        </div>

        {/* Bottom Disclaimer */}
        <div className="mt-16 text-center">
          <p className="text-mutedForeground font-['JetBrains_Mono'] text-xs uppercase tracking-[0.2em]">
            * All tickets include digital waiver signing upon entry. No refunds
            for the faint of heart.
          </p>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
        }

        .shadow-neon-orange {
          box-shadow:
            0 0 15px rgba(255, 98, 0, 0.4),
            0 0 30px rgba(255, 98, 0, 0.2);
        }

        .shadow-inner-glow {
          box-shadow: inset 0 0 20px rgba(157, 80, 187, 0.1);
        }
      `,
        }}
      />
    </section>
  );
};

export default TicketTiersSection;
