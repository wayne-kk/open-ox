# Component Skill: Hero - Adaptive V-Bars

Use this skill when generating a hero section that combines dynamic V-shaped luminous background bars and GSAP-driven headline reveals — **without** a Three.js mesh or central 3D object. **No** site `<nav>`, header bar, or glass pill navigation — frame rails + typography + CTAs only; global chrome belongs in the app shell.

## Core Effect

Build a full-viewport hero with:

- dark technical base and subtle grid texture.
- animated V-shaped vertical gradient bars in the background.
- masked headline reveal using GSAP + ScrollTrigger.
- restrained bracket / rail framing (decorative lines only — not a nav strip).

Keep the implementation self-contained in a single section component.

## Visual Language

1. Base atmosphere: near-black (`#030303`-like) with low-opacity structural lines.
2. Accent palette: emerald + cyan highlights over white-neutral typography.
3. Frame vocabulary: rails, corner brackets, micro alignment marks.
4. Rhythm: minimal but alive — micro motion in the V-bars only.

## Structure Requirements

- **Frame Layer**
  - centered max-width rails with border-x.
  - corner dots/brackets and tiny alignment markers.
- **Hero Core Layer**
  - dynamic V-bar background container (full-bleed, behind typography).
  - reveal headline + support copy + CTA group centered or aligned per layout brief.

## Motion Direction

Use two motion systems:

1. GSAP masked reveal:
  - animate `.reveal-word` from `translateY(110%)` to `0%`.
  - slight stagger and `power4.out` easing.
2. Runtime ambient motion:
  - V-bars vertical oscillation with phase offset (single `requestAnimationFrame` loop or equivalent).

Do **not** add a WebGL canvas, Three.js scene, or faceted geometry — visual interest comes from the bar field and typography motion.

## Required Implementation Blueprint (Do Not Skip)

When this skill is selected, generated output MUST include all of the following:

1. dynamic V-bar background with center-lower trough (V profile), not generic gradient strips.
2. GSAP masked word reveal on title.
3. frame language (rails + corner bracket/dot accents).
4. smooth bar animation loop with typed cleanup (`cancelAnimationFrame`, teardown of dynamically created bar nodes).
5. **MUST NOT** include top navigation, `<nav>`, logo+links rows, or floating pill menus inside this section.
6. no CDN scripts, no `iconify-icon`, no `<style jsx>`.

If any item above is missing, this is NOT a valid `adaptive-vbars-webgl` implementation.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function HeroSection() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const barsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!rootRef.current || !barsRef.current) return;
    gsap.registerPlugin(ScrollTrigger);

    // ---- Dynamic V-bars ----
    const barsHost = barsRef.current;
    const numBars = window.innerWidth > 768 ? 41 : 21;
    const centerIndex = Math.floor(numBars / 2);
    const bars: Array<{ el: HTMLDivElement; baseTop: number; phase: number }> = [];

    for (let i = 0; i < numBars; i += 1) {
      const wrap = document.createElement("div");
      wrap.className = "flex-1 h-full relative border-r border-white/5 last:border-0 overflow-hidden";

      const glow = document.createElement("div");
      glow.className = "absolute left-0 right-0 w-full";
      glow.style.height = "150vh";

      const distance = Math.abs(i - centerIndex);
      const baseTop = 30 + distance * (window.innerWidth > 768 ? 2.5 : 4);
      glow.style.top = `${baseTop}%`;
      glow.style.filter = "blur(4px)";
      glow.style.background =
        "linear-gradient(to bottom, rgba(3,3,3,1) 0%, rgba(16,185,129,0.7) 10%, rgba(255,255,255,0.9) 15%, rgba(6,182,212,0.8) 25%, rgba(3,3,3,1) 45%)";

      wrap.appendChild(glow);
      barsHost.appendChild(wrap);
      bars.push({ el: glow, baseTop, phase: distance * 0.2 });
    }

    let rafId: number | null = null;
    let t = 0;
    const animate = () => {
      t += 0.02;
      for (const bar of bars) {
        const wave = Math.sin(t + bar.phase) * 3;
        bar.el.style.top = `${bar.baseTop + wave}%`;
      }
      rafId = window.requestAnimationFrame(animate);
    };
    animate();

    gsap.fromTo(
      ".reveal-word",
      { y: "110%", rotation: 2, opacity: 0 },
      {
        y: "0%",
        rotation: 0,
        opacity: 1,
        duration: 1.2,
        ease: "power4.out",
        stagger: 0.1,
        scrollTrigger: { trigger: "#reveal-title", start: "top 85%" },
      }
    );

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      while (barsHost.firstChild) barsHost.removeChild(barsHost.firstChild);
    };
  }, []);

  return <section ref={rootRef} className="relative min-h-screen">{/* ... */}</section>;
}
```

## Layout Details

- use `min-h-screen` and center-focused composition.
- preserve frame shell and corner accents at low opacity.
- keep bar motion behind content with mask fade at top/bottom.
- maintain clear text readability over moving background.

## Content Rules

- headline should express adaptive intelligence in concise terms.
- support copy should emphasize practical value, not generic hype.
- CTA labels should be specific and action-oriented.

## Implementation Constraints

- output raw TSX only.
- must be client component (`"use client"`).
- no Three.js / WebGL canvas for this skill variant.
- no CDN script injection.
- no `iconify-icon`; use project icon system (for example `lucide-react`) or inline SVG.
- no `<style jsx>`; use Tailwind utilities and project globals.

## Accessibility + Performance

- support reduced-motion fallback for bar motion and title reveal.
- keep decorative layers `pointer-events-none`.
- tune bar count / blur strength for stable frame rate on low-end devices.
