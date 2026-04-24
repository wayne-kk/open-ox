# Component Skill: Hero — Screen-Blend Orbs (CSS / DOM)

Use this skill when `generateSection` should deliver a **hero-only** block: a near-black void lit by a few **large, heavily blurred circular color masses** that **add** light using `mix-blend-mode: screen` (or equivalent additive read), plus a **dense, fluid-scale headline** with a short eyebrow and muted subcopy. **Scroll-agnostic section variants** of this pattern use **IntersectionObserver** to reveal lines with stagger; do **not** require WebGL or canvas.

**Scope — hero only:** Output **only** the first-screen hero: orbs + headline stack — **no** site navigation, header bar, or top chrome (those live in the app shell, not in this section). **Do not** include equalizer / spectrum demos, satellite orbit diagrams, full-page “chapter” grids, download bands, or the **bottom timeline** strip—those belong to other sections. If a brief only supplies this hero, keep **orbs in the initial “hero” layout** (two prominent masses + optional third hidden or at zero opacity); do not wire a multi-section orb state machine unless another contract explicitly extends it.

## Core Effect

- **Additively lit void** — 2+ oversized circles (`rounded-full`) with a **very strong blur** and **screen** blend; they sit in a `fixed` inset layer and read as soft colored light pools, not hard shapes.
- **Asymmetric layout** — Orbs are positioned in different quadrants; sizes differ (e.g. 50–60vh class range) to avoid symmetry that feels like a loading spinner.
- **Type stack** — Condensed **display** wordmark line(s), optional line break; eyebrow in **all-caps, widetrack, muted**; body in a **muted-foreground** role from the theme.
- **Entrance** — Staggered opacity + translateY on scroll-into-view (or on mount) for eyebrow, title, and paragraph.

## Visual Language

- **Atmosphere** — “Studio dark” with **punchy accent pools**; map orb hues to **semantic roles** (e.g. primary, secondary, success/tertiary) from the brief, **not** the sample’s system-palette hex values.
- **Figure / ground** — Orbs are decorative; the headline is the main figure. Keep **contrast** high enough for WCAG on the `foreground` + `background` used under the orbs.
- **Texture** — All softness comes from **CSS blur** + screen blend, not from noise images.

## Structure Requirements

1. **Z-order** (bottom → top): (a) page/surface `background` from tokens; (b) **fixed** orb container `inset-0` `overflow-hidden` `pointer-events-none` `z-0`; (c) **relative** hero section `z-10` (min viewport height) with padding from brief (e.g. `px` using `vw` or token spacing). **Do not** add a fixed header or `<nav>` in this section.
2. **Orbs** — Each orb is a single `div` (no SVG required); use **token-based** `background-color`; apply **filter blur** via Tailwind or CSS; `mix-blend-mode: screen`; opacity in the **~0.5–0.7** range unless the brief specifies calmer.
3. **No interaction capture** on background layers.

## Motion Direction

- **Fade-in** — Use `transition` on `opacity` + `transform` (e.g. `translateY(20px)`) and toggle a `visible` class (or `data-state`) when the section intersects, with **staggered `transition-delay`** on the title lines vs paragraph (e.g. 0s / 0.1s / 0.2s scale).
- **Easing** — Prefer a custom **cubic ease-out** (e.g. `cubic-bezier(0.16, 1, 0.3, 1)`) for reveal and any orb `transform` if motion is required.
- **Reduced motion** — If `prefers-reduced-motion: reduce`, set hero copy to **visible** without off-axis motion; orbs may stay static; **do not** depend on section-scroll choreographed orb moves for the hero to read as complete for this `id`.
- **Hero-only** — Do **not** require the **section-indexed** orb repositioning or **timeline tick** script from a multi-page source; the hero is valid with **static** orb positions and **one** intersection target.

## CSS / DOM Background (no WebGL)

- **Screen blend** — `mix-blend-mode: screen` (or `plus-lighter` if the stack supports and the brief allows) to keep the effect additive and luminous.
- **Blur** — Use large blur (Tailwind `blur-3xl` / ~80px) so edges disappear into the void; optional long `transition` on `transform`/`opacity` only if the spec calls for state changes—default hero may be static.

## Required Implementation Blueprint (Do Not Skip)

1. **MUST** place **at least two** large blurred, rounded orb elements in a **non-interactive** `fixed` full-viewport background layer, using `**mix-blend-mode: screen`** (or documented equivalent) and **semantic colors from the design system / section brief**—**not** hardcoded system accent hexes from a one-off reference.
2. **MUST** use `**pointer-events: none`** on the orb container and each orb, and keep **orb z-index** strictly **below** primary content.
3. **MUST** implement the **hero** as a `min-h-screen` (or equivalent) column with a width cap (e.g. `max-w-4xl` class of constraint), **eyebrow**, **multi-line `clamp` fluid headline** with **tight negative letter-spacing** at large sizes, and a **subcopy** paragraph in the **muted** role.
4. **MUST** run **staggered enter visibility** (IntersectionObserver, `useInView`, or `useEffect` + `ref`) and **remove / disconnect the observer** on unmount; **MUST** respect `**prefers-reduced-motion`** by skipping or minimizing translate on entrance.
5. **MUST** (hero-only) **not** output synthesis/context/download sections, **equalizer** bar columns, **orbiting** satellite UI, or a **scroll timeline** as part of this section.
6. **MUST** use the project’s **typography and spacing tokens** (or configured `font-sans` / display stack); **MUST NOT** add runtime **Google Fonts** `<link>` or **Tailwind CDN**—fonts come from the app’s pipeline.
7. **MUST NOT** include **any** site navigation: no `<nav>`, no header bar, no brand/version row, no `mix-blend-difference` top chrome — shell navigation is **outside** this section.
8. **MUST NOT** add `<script src="https://…">` for Tailwind, fonts, or libraries.

If any of the **MUST** items (and hero scope in item 5) is missing, the output is **not** valid for `screen-blend-orbs-hero`.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client";

import { useEffect, useRef } from "react";

const easeOut = "cubic-bezier(0.16, 1, 0.3, 1)";

export function ScreenBlendOrbsHero() {
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const reveal = () => {
      el.querySelectorAll("[data-hero-fade]").forEach((n) => {
        n.setAttribute("data-visible", "true");
      });
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reveal();
      return;
    }

    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) reveal();
      },
      { threshold: 0.35 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden
      >
        <div
          className="orb absolute w-[60vh] h-[60vh] rounded-full opacity-60 blur-3xl mix-blend-screen"
          style={{
            top: "20%",
            left: "20%",
            backgroundColor: "hsl(var(--primary))",
            transition: `transform 2s ${easeOut}, opacity 2s ease`,
          }}
        />
        <div
          className="orb absolute w-[50vh] h-[50vh] rounded-full opacity-60 blur-3xl mix-blend-screen"
          style={{
            top: "30%",
            right: "20%",
            backgroundColor: "hsl(var(--secondary))",
            transition: `transform 2s ${easeOut}, opacity 2s ease`,
          }}
        />
        <div
          className="orb absolute w-[40vh] h-[40vh] rounded-full opacity-0 blur-3xl mix-blend-screen"
          style={{
            bottom: "10%",
            left: "40%",
            backgroundColor: "hsl(var(--chart-2))",
          }}
        />
      </div>

      <section
        ref={sectionRef}
        className="relative z-10 flex min-h-screen flex-col justify-center px-[10vw]"
      >
        <div className="max-w-4xl">
          <span
            data-hero-fade
            className="mb-4 block translate-y-5 text-sm font-medium uppercase tracking-widest text-muted-foreground opacity-0 transition-[opacity,transform] duration-[800ms] [transition-timing-function:var(--ease-hero,inherit)] data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100"
          >
            Eyebrow
          </span>
          <h1
            data-hero-fade
            className="mb-6 translate-y-5 text-[clamp(3rem,8vw,8rem)] font-bold leading-[0.95] tracking-[-0.04em] opacity-0 transition-[opacity,transform] delay-100 duration-[800ms] [transition-timing-function:var(--ease-hero,inherit)] data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100"
          >
            Headline
            <br />
            Second line
          </h1>
          <p
            data-hero-fade
            className="max-w-[50ch] translate-y-5 text-lg leading-relaxed text-muted-foreground opacity-0 transition-[opacity,transform] delay-200 duration-[800ms] [transition-timing-function:var(--ease-hero,inherit)] data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100 md:text-xl"
          />
        </div>
      </section>
    </div>
  );
}
```

Wire `--ease-hero` in global CSS or `theme` to the same **cubic** as the brief; the example’s `hero-visible` utility may be a small module class or a `data-` + selector—match the project’s pattern. Prefer `aria-busy` / heading level semantics per layout.

## Layout Details

- Horizontal padding: generous (`vw` or `max` container) so the **clamp** headline can breathe; avoid orbs **directly** behind small body text—nudge content `max-w` or orb positions if legibility fails.
- **Third orb** is optional; default hidden keeps the first screen to two primary pools of light.

## Content Rules

- Eyebrow: **short signal** (category, product clause)—not a sentence. Headline: **imperative or declarative** with optional forced line break. Subcopy: **one paragraph**, concrete, no placeholder “lorem.”

## Implementation Constraints

- `"use client"` when using `IntersectionObserver` or DOM observation.
- No CDN scripts; Tailwind in build; no `<style jsx>`; icons not required for the minimal spec.

## Accessibility + Performance

- Decorative orbs: `aria-hidden` on the background wrapper.
- Single `IntersectionObserver` per instance; disconnect on unmount; **no** continuous `requestAnimationFrame` loop for orbs in the default hero path.

If the implementation adds **WebGL, Three.js, or a canvas-based** background, the output does **not** match this `id`—use a WebGL hero skill instead.