# Component Skill: Hero — Editorial Grayscale + Parallax “Blinds” (CSS / DOM)

Use this skill when `generateSection` should deliver a **print-meets-landscape** hero: a **soft neutral field** with a **full-bleed desaturated photo**, **layered scrims** for readability, an **optional paper-grain / noise** veil, a **right-aligned (or mirrored) block of stacked display words** with a small **inset label/badge**, a **serif or accent italic** supporting line, a **solid CTA**—and on the other side, a set of **vertical “blind” columns** that each reveal a **horizontal slice of the same wide image** (pano / strip composition), with **scroll-linked vertical parallax** on those slices. **No WebGL, canvas effects, or particle systems**—this is **CSS backgrounds + rAF-throttled scroll**.

**Scope — hero only:** Output **one** section (the first screen block) plus its inline asset hooks. **Do not** add unrelated page chrome beyond what is common for the hero: **no** footer, **no** “spacer” sections to pad scroll unless the product brief needs extra body height to feel parallax; the **parallax** script targets **blind layer transforms only** while the user scrolls through / past the hero.

## Core Effect

- **Photographic void** — Full-width background: `<img>` or `Image` with **`object-cover`**, **grayscale**, slight **scale** (e.g. 1.06) so edges never feel cropped flat; `absolute` inset under content.
- **Scrim stack** — At least: (a) a **tint** wash at **~50–60%** opacity in the page **surface/background** role; (b) a **left-to-right** gradient that lifts the **type side** and falls off toward the blinds. Map stops to `background` / `foreground` / `muted` **tokens**—not fixed sage hexes from a reference.
- **Optional grain** — A **fixed** full-viewport `div` with a **tiled SVG-based noise** (or a tiny `feTurbulence` data-URI), **`mix-blend-mode: multiply`**, **very low** opacity, **`pointer-events: none`**, `z` above the photo but not stealing focus.
- **Type column** — **Display / narrow sans** in **all-caps** for two or more **stacked lines** (huge `rem` with responsive steps); Tight line-height, **tighter** tracking. A **small rectangular badge** (e.g. “THE”) can sit on the block with **absolute** positioning, **inset border**, **filled or inverted** from **primary** or **ring** role.
- **Accent line** — **Italic** one-liner under the block (e.g. **Playfair**-class display font role from the design system) in a **primary** or **accent** ink role.
- **Blinds** — **N** vertical strips (e.g. **5**), each a column with `overflow: hidden` and a **taller inner** `div` using **`background-image`** of one **pano** asset, **`background-size: N*100% 100%`** and **`background-position: k/(N-1) * 100%`** (for equal slices) so each shows a sliver of the same scene. Vary **column width** (outer narrow, center **widest**), **height** (center tallest), **vertical offset** (`translate-y`), and **shadow** depth for a **ballet** of slats.
- **Entrance** — Staggered **custom keyframes**: opacity **0 → 1**, **translateY(30px) → 0**, **filter blur(8px) → 0** over ~1.2s on headline lines with **delay** cadence; shorter duration on badge and CTA. Respect **reduced motion** (see below).
- **Parallax** — `window` **scroll** with **`requestAnimationFrame`**, `passive: true`; per-blind `translate3d(0, y, 0)` with **staggered speed** by distance from center; **clamp** Y and optionally limit effect to a **scroll range** so the hero does not overdrive.

## Visual Language

- **Palette** — Muted, **pastel-to-sage** or **off-white** page ground; **ink** body; **cool slate** for accent lines and CTA hovers. **Always** map to **active brief / tokens**; the reference is **mood** (outdoor, editorial) not a hex sheet.
- **Texture** — Grain is **nearly invisible**; it only knocks down digital “plastic.”
- **Energy** — Static photography + **kinetic** blinds on scroll, not a video loop.

## Structure Requirements

1. **Z-order** (bottom → top): background image → scrim divs → **content row** (z-10) → optional **noise** (high z, still non-interactive and low opacity). Blinds and text share one **max-width** container; on **`lg`**, use **row** (text + blinds); on small screens, **reorder** so blinds or text lead per brief (source placed blinds first on `sm`).
2. **Text alignment** — The hero block uses **`items-end` + `text-right`** (or a logical mirror for RTL) for an **editorial** spine; ensure mirrored layouts remain accessible (`dir`, `text-start` overrides if needed per locale).
3. **Blind math** — For **5** slats, `background-size: 500% 100%`, positions `0%`, `25%`, `50%`, `75%`, `100%` (center the slice in each cell). If **N** changes, recompute: `width% = (N*100%)` and `x% = (i / (N-1)) * 100%` for `i` in `0..N-1`.

## Motion Direction

- **`@keyframes` entrance** (name can be `animationIn` or `heroEditorialIn` but **must** combine **Y move + opacity + blur clear**; stagger delays ~0.2s / 0.4s / 0.8s / 1.0s / 1.2s class of rhythm.
- **Scroll parallax** — Baseline speed × scrollY + per-index stagger; **clamp** to ±180px (or design token) so strips never drift out of the frame. **Disable** or replace with static offsets when **`prefers-reduced-motion: reduce`**.
- **Lifecycle** — One **rAF** loop flag (`ticking`) to coalesce scroll updates; **remove** the scroll listener and cancel pending frames in cleanup (if using `cancelAnimationFrame` for scheduled work, pair correctly).

## CSS / DOM (no WebGL)

- Blinds are **div** stacks only; the “wide” look is **one** raster used **five** times with **sliced** `background-position`.
- **Images** from **brief**: `Next/Image` with `fill` + `sizes`, or `object-cover` on an absolutely positioned `img`—**no** hardcoded public demo URLs in generated code; pass **`src` from props** or CMS.

## Required Implementation Blueprint (Do Not Skip)

1. **MUST** implement a **full-bleed** hero with a **grayscale** photographic layer (`grayscale` filter class or `style`), **`object-cover`**, and **at least two** **token-based** **overlays** (flat tint + directional gradient) so type and slats stay legible in all breakpoints.
2. **MUST** use **semantic colors** from the **design system** for `background`, `foreground`, `primary`, and borders—**not** the reference page’s fixed hex list.
3. **MUST** build the **blinds** as **≥3** vertical **columns** sharing **one** wide image; **MUST** set **`background-size`** to `stripCount * 100%` horizontal and `100%` vertical and **`background-position-x`** at equal steps so each slat shows a **distinct slice** of the same source.
4. **MUST** apply **staggered column design**: different **widths**, **heights** (e.g. center tallest), `translateY` offsets, and **z-index** so the set reads as **dimensional**—not five identical cards.
5. **MUST** run **parallax** on **scroll** for the **inner blind layers** with **`requestAnimationFrame`**, **`passive: true`**, a **throttle** pattern, and **Y clamping**; **MUST** remove the listener in `useEffect` cleanup (or equivalent) and **MUST** skip or static-fy motion when `prefers-reduced-motion: reduce`.
6. **MUST** add **staggered entrance** motion using **keyframe** animation (blur/translate/opacity) on the **headline stack**, **badge**, **accent line**, and **CTA**; **MUST** map animation to reduced-motion (instant opacity / no blur / no parallax) per platform convention.
7. **MAY** add a **fixed** **low-opacity** **noise** layer with `mix-blend-mode: multiply` (or documented alternative) and `pointer-events: none`.
8. **MUST** (hero section only) **not** import **WebGL, Three.js, or particle** engines for this `id`.
9. **MUST NOT** add **`<script src="https://…">` for Tailwind** or any **font CDN links**; fonts come from the **app’s** `next/font` or configured families.

If any of the **MUST** items is missing, the output is **not** valid for `editorial-blinds-hero`.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

const BLINDS = 5;
const bgStrip =
  (i: number) =>
    `${(i / Math.max(1, BLINDS - 1)) * 100}% 50%` as const;

export function EditorialBlindsHero({
  backgroundSrc,
  stripSrc,
}: {
  backgroundSrc: string;
  stripSrc: string;
}) {
  const blindRefs = useRef<(HTMLDivElement | null)[]>([]);
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduce) return;
    const nodes = blindRefs.current.filter(Boolean);
    if (nodes.length === 0) return;

    let ticking = false;
    let raf = 0;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      raf = window.requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y > 1200) {
          ticking = false;
          return;
        }
        nodes.forEach((el, index) => {
          const d = Math.abs(2 - index);
          const base = 0.028;
          const stagger = d * 0.02;
          const raw = y * (base + stagger);
          const yMove = Math.max(-180, Math.min(raw, 180));
          el.style.transform = `translate3d(0, ${yMove}px, 0)`;
        });
        ticking = false;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  return (
    <section className="relative w-full overflow-hidden py-20 lg:py-28">
      <div className="pointer-events-none absolute inset-0 z-0">
        <Image
          src={backgroundSrc}
          alt=""
          fill
          className="object-cover object-center grayscale scale-[1.06]"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-background/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-background/50" />
      </div>

      {/* Optional noise: set backgroundImage via style or global class from /public asset — see spec */}
      <div
        className="pointer-events-none fixed inset-0 z-[100] opacity-[0.035] mix-blend-multiply"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 lg:px-12">
        <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-16">
          <div className="relative order-2 flex w-full flex-col items-end py-16 text-right lg:order-1 lg:w-[45%]">
            <h1 className="relative flex w-full flex-col items-end">
              <span className="font-[family-name:var(--font-display)] text-[5.25rem] font-semibold uppercase leading-[0.85] tracking-tighter text-foreground [animation:heroEditorialIn_1.2s_ease-out_0.2s_both] md:text-[7.25rem] lg:text-[9.5rem]">
                LineA
              </span>
              <span className="font-[family-name:var(--font-display)] text-[5.75rem] font-semibold uppercase leading-[0.85] tracking-tighter text-foreground [animation:heroEditorialIn_1.2s_ease-out_0.4s_both] md:text-[7.75rem] lg:text-[10.5rem]">
                LineB
              </span>
              <span className="pointer-events-none absolute -right-2 top-1/2 -translate-y-[55%] border border-foreground/45 bg-primary px-2 py-1 text-sm font-semibold uppercase tracking-[0.35em] text-primary-foreground [animation:heroEditorialIn_0.8s_ease-out_0.8s_both] md:text-xs">
                Chip
              </span>
            </h1>
            <p className="font-serif mt-10 mb-4 pr-2 text-lg italic text-primary [animation:heroEditorialIn_0.8s_ease-out_1s_both] md:text-xl">
              Accent line
            </p>
            <button
              type="button"
              className="mt-12 mr-2 bg-foreground px-10 py-4 text-xs font-semibold uppercase tracking-widest text-background transition-colors hover:bg-primary [animation:heroEditorialIn_0.8s_ease-out_1.2s_both]"
            >
              CTA
            </button>
          </div>

          <div
            className="relative order-1 flex h-[500px] w-full items-center justify-center gap-1 overflow-visible lg:order-2 lg:h-[750px] lg:w-[115%] lg:translate-x-[3%] lg:gap-1.5"
          >
            {Array.from({ length: BLINDS }).map((_, i) => {
              const widths = ["w-[18%]", "w-[22%]", "w-[28%]", "w-[22%]", "w-[18%]"];
              const heights = [
                "h-[80%] -translate-y-4",
                "h-[95%] translate-y-1",
                "h-[110%] -translate-y-2",
                "h-[95%] translate-y-1",
                "h-[80%] -translate-y-4",
              ];
              const z = [10, 20, 30, 20, 10][i] ?? 10;
              return (
                <div
                  key={i}
                  className={`relative ${widths[i]} ${heights[i]} overflow-hidden rounded-[1px] bg-card shadow-lg`}
                  style={{ zIndex: z }}
                >
                  <div
                    ref={(el) => {
                      blindRefs.current[i] = el;
                    }}
                    className="absolute inset-x-0 -top-[30%] h-[160%] scale-[1.15] will-change-transform bg-no-repeat"
                    style={{
                      backgroundImage: `url(${stripSrc})`,
                      backgroundSize: `${BLINDS * 100}% 100%`,
                      backgroundPosition: bgStrip(i),
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
```

Register `@keyframes heroEditorialIn` in `globals.css` or the Tailwind `theme` extension (same motion as the source: **opacity, translateY, filter blur**). Fix arbitrary **text size** class names to valid Tailwind v4 / project tokens; wire **`--font-display`** via `next/font`. The noise `data-URI` placeholder should be replaced with a **file** in `/public` or a **one-line** tuned SVG to avoid giant inline strings in AI output.

## Layout Details

- **Max width** ~1400px; horizontal padding that breathes on `lg`.
- **Blinds** slightly **breaks out** to the right (`translate-x`) on large screens to feel immersive—ensure no horizontal overflow: **`overflow-x-hidden`** on a wrapping ancestor.
- The **center** slat is the **hero** of the set (tallest, strongest shadow).

## Content Rules

- Stacked **two-word** or **two-line** punch + **small** chip; accent line = **emotional** counterpoint to the cold caps; CTA = **imperative**, uppercase tracking.

## Implementation Constraints

- `"use client"` for scroll + rAF; images optimized per Next/Image rules; **no** `styled-jsx` in generated sites unless the project already uses it.
- Icons: **not** required; if added, `lucide-react` or project standard.

## Accessibility + Performance

- Background and blind images: `alt` empty only if **decorative**; if the image conveys meaning, provide **`alt` from the brief**.
- `prefers-reduced-motion` disables parallax and can simplify keyframes to opacity-only.
- Throttle scroll to **rAF** (already); avoid `transform` on the **outer** section container—only the **blind** inner nodes.

If the design replaces blinds with a **single** photo (no columns), the output is **out of scope** for this `id`.
