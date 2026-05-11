# Component Skill: Hero — Editorial Blinds + Scroll Parallax (CSS / DOM)

Use this skill when the brief calls for a **heritage / magazine / outdoor editorial** first screen: **desaturated full-bleed photography** sliced into **vertical blinds (slats)** that **offset on scroll** for a subtle parallax “slit” reading, optional **paper / film grain** overlay, and **centered or offset editorial typography** — **pure HTML/CSS + one full-viewport image**, **no WebGL**, **no canvas shaders**, **no Three.js**.

**Scope — hero only:** Implement **only** the first-screen block: blind layers + copy/CTAs. **Do not** add site `<nav>`, logo rows, or duplicate global header chrome — **layout owns shell navigation**. **Do not** bundle follow-on sections (feature grids, galleries) unless the page plan explicitly asks for them below this block.

## Core Effect

- **Root section**: `w-full`, `min-h-screen` (or `min-h-[100dvh]`), `relative`, `isolate`, `overflow-hidden`.
- **Photographic ground**: one **hero still** (expedition, landscape, film aesthetic) **`absolute inset-0`**, **`object-cover`**, **desaturated** via CSS (`saturate` / grayscale token-friendly) unless the brief demands color — **prefer high-contrast monochrome** for “heritage / editorial”.
- **Blinds**: the same visual (or duplicated `Image`/`img` layer reading the same **`src`**) split into **`N` vertical strips** (**8–14** strips typical) as **narrow columns** in a **`grid`** or **`flex`** row spanning **full width/height**. Each strip **`overflow-hidden`** shows a **narrow crop** of the photo (different **`object-position`** per column or **`background-position`**) so strips **do not read as duplicated rectangles** — they tile the full image seamlessly when **idle**.
- **Scroll parallax**: on vertical scroll **while this section is relevant**, apply **distinct `translateY` per strip** with **small coefficients** (e.g. alternating **±2px–8px per 100px scroll**, scaled by strip index) so the breaks **feel like mechanical blinds / parallax slit** — **clamp** cumulative offset; **cleanup** listeners on unmount.
- **Optional grain**: **`pointer-events-none`** overlay — **CSS noise** (SVG filter, `feTurbulence`, or subtle repeating **radial-gradient** speckle) at **very low opacity** (~3–8%) — **map opacity to a token** or CSS variable; **no** large DOM tile grids for noise.

## Visual Language

- **Palette**: map **foreground / background / muted / border** from the project theme. Type on imagery **must** keep **readable contrast**: add **`linear-gradient` scrim** (bottom-heavy or vignette) if the photo fights legibility — **never** rely on **`text-white/40`** alone for headings.
- **Typography**: **display serif or editorial sans** per design system; restrained **tracking**; headline can be **two lines** with optional **divider** hairline aligned to blinds rhythm.
- **Texture**: tactile / print — blinds motion + grain; avoid neon, gamified blobs, or WebGL orbs (**route away from `*-webgl` skills**).

## Structure Requirements

1. **Z-order**: (a) base image or per-strip stacks; (b) optional scrim; (c) blinds grid with parallax transforms; (d) grain overlay `pointer-events-none`; (e) content column `relative z-10`.
2. **Zero navigation chrome** inside `<section>`: **no** `<nav>`, **no** hamburger — global chrome is **`layout`**.
3. **`prefers-reduced-motion`**: disable **scroll-driven strip offsets**; keep **static** aligned blinds / single full image fallback acceptable if motion is reduced.

## Motion Direction

- **Entrance**: short stagger — eyebrow → headline → lead → CTAs (**opacity + small translateY**), compatible with **`framer-motion`** or CSS; respect **reduced motion**.
- **Scroll**: single **`requestAnimationFrame` or throttled scroll** updating CSS variables `--blind-shift-*` **or** per-strip **`style.transform`** — **passive** `scroll` listener on `window` or **`IntersectionObserver`**-gated when section visible; **cap** deltas.

## Required Implementation Blueprint (Do Not Skip)

When this skill is selected, output **must** include:

1. **`min-h-screen`** hero **`section`** with **`relative`**, **`isolate`**, **`overflow-hidden`**.
2. **Full-bleed photographic treatment** (**desaturated** by default unless brief contradicts); **`alt`** and **`src` from brief** / props.
3. **Vertical blinds**: **multiple columns** (**≥ 8**) that together reconstruct one continuous image (**object-fit cover** crops or equivalent); **each column** **`overflow-hidden`**.
4. **Scroll-linked parallax** on strips (**non-zero differential motion** vs a static baseline when motion is OK) with **cleanup on unmount** and **clamp** ranges.
5. **Optional grain** overlay, **`pointer-events-none`**, **subtle**.
6. **Editorial headline + supporting copy + primary CTA** (secondary optional); **scrims** if needed for **WCAG-aligned** contrast.
7. **`prefers-reduced-motion`** path: **no** parallax jank — static strips or merged image OK.
8. **No WebGL**, **no** `<canvas>` for effect core, **no** site nav inside section.
9. **Icons**: **`lucide-react`** only if needed; **no** CDN Tailwind/scripts.

If the **multi-strip blind grid** or **scroll-differential strip motion** is missing (when motion allowed), output is **not** valid for `editorial-blinds-hero`.

## Reference TSX Skeleton (Adapt tokens and content from brief)

```tsx
"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

type EditorialBlindsHeroProps = {
  image: { src: string; alt: string; width: number; height: number };
  eyebrow?: string;
  headline: React.ReactNode;
  lead: string;
  primaryCta: { label: string; href: string };
};

const STRIPS = 10;

export function EditorialBlindsHero(props: EditorialBlindsHeroProps) {
  const { image, eyebrow, headline, lead, primaryCta } = props;
  const rootRef = useRef<HTMLElement | null>(null);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    reduceMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reduceMotionRef.current) return;

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const rects = root.querySelectorAll<HTMLElement>("[data-blind-strip]");
        const y = window.scrollY || 0;
        rects.forEach((el, i) => {
          const dir = i % 2 === 0 ? 1 : -1;
          const shift = Math.max(-24, Math.min(24, (y / 120) * 6 * dir));
          el.style.setProperty("--blind-y", `${shift}px`);
        });
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section ref={rootRef} className="relative isolate min-h-screen w-full overflow-hidden bg-background">
      <div className="absolute inset-0 z-0 grid" style={{ gridTemplateColumns: `repeat(${STRIPS}, minmax(0, 1fr))` }}>
        {Array.from({ length: STRIPS }).map((_, i) => (
          <div key={i} data-blind-strip className="relative overflow-hidden border-r border-border/20 last:border-r-0" style={{ transform: "translateY(var(--blind-y, 0px))", willChange: "transform" }}>
            <Image
              src={image.src}
              alt=""
              fill
              className="object-cover saturate-0"
              sizes="100vw"
              style={{ objectPosition: `${(i / (STRIPS - 1)) * 100}% center` }}
              aria-hidden
            />
          </div>
        ))}
      </div>

      {/* Legibility */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-background/90 via-background/40 to-transparent" />

      {/* Grain */}
      <div className="pointer-events-none absolute inset-0 z-[2] opacity-[0.06] mix-blend-overlay [background-image:radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:3px_3px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col justify-end px-6 pb-24 pt-32 md:pb-32">
        {eyebrow ? <p className="mb-4 text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">{eyebrow}</p> : null}
        <div className="font-serif text-4xl font-light tracking-tight text-foreground md:text-6xl">{headline}</div>
        <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">{lead}</p>
        <a href={primaryCta.href} className="mt-10 inline-flex w-fit rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground">
          {primaryCta.label}
        </a>
      </div>

      {/* Decorative real image alt for a11y: first strip could use alt prop — prefer one sr-only */}
      <span className="sr-only">{image.alt}</span>
    </section>
  );
}
```

Adapt **strip count**, **parallax amplitude**, **scrim strengths**, **typography utilities**, **image component usage**, and **token class names** to the active project conventions.
