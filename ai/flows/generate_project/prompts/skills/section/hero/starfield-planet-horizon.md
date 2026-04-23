# Component Skill: Hero — Starfield + Planet Horizon (CSS / DOM)

Use this skill when `generateSection` should deliver a full-viewport, space-operatic hero: a dense micro-star field, a large soft “planet at the limb” or horizon glow hugging the bottom or corner, and foreground content in a glass/terminal-inspired layer. The motion is light scroll-driven parallax on the planet layer plus staggered content reveal—**no WebGL**—suitable for fintech, infra, or “autonomous system” briefs that ask for depth without 3D runtime cost.

## Core Effect

- **Starfield** — A tiled or layered field of 1–2px specular “stars” (radial or dot-like marks) on a very dark ground; low opacity, decorative, never steals contrast from type.
- **Planet / horizon** — A huge circular or elliptical disc (often bottom-right) built from **blurred** radial layers so it reads as atmosphere + limb light; it sits under content and can drift with scroll.
- **Foreground** — Expressive **display** headline, optional system-style eyebrow line, subcopy, primary + secondary actions; optional “telemetry” micro-labels (mono) for atmosphere.
- **Scroll behavior** — Vertical scroll nudges the planet (translate) and may subtly grow scale; must be throttled or passive-listener safe and **removed on unmount**.

## Visual Language

- **Atmosphere** — High contrast between near-black void and one warm “limb” accent band; cool neutrals in starfield. Map **all** concrete colors to the active brief: `background`, `foreground`, `primary` / `accent`, `muted`, `border` (or CSS variables that resolve from the theme), not fixed demo hexes.
- **Type** — Pair **serif or display** for the hero line with **monospace** for protocol labels, stats, and footer telemetry so the block reads as “console meets editorial.”
- **Glass** — Low-opacity fills, 1px hairline borders, light backdrop blur for panels and CTA affordances—tinted from surface tokens, not a pasted rgba from a one-off mock.

## Structure Requirements

1. **Z-order** (bottom → top): (a) root background color from tokens; (b) starfield layer `fixed` or `absolute` inset-0, `pointer-events-none`, lowest decorative z; (c) planet layer same—must not intercept clicks; (d) main section content `relative` with higher z and readable padding; (e) optional absolute footer telemetry inside the section.
2. **Viewport** — Hero section is at least one full viewport height for the primary message; overflow handled so horizontal scroll is not introduced by the planet blur (`overflow-x-hidden` on a wrapping ancestor if needed).

## Motion Direction

- **Staggered entrance** — Eyebrow, headline, subcopy, and CTAs appear in sequence (CSS `@keyframes` or `framer-motion`) with a short Y-translate + opacity; **stagger delays** ~0.2s / 0.5s / 0.8s / 1.1s class of rhythm (adapt to project motion tokens).
- **Scroll** — `transform: translateY(scrollY * k1) scale(1 + scrollY * k2)` (or `useWindowScroll` + `style`) on the planet only; cap `k2` so scale does not blow up on long pages. Prefer a single scroll handler with cleanup.
- **Reduced motion** — If `prefers-reduced-motion: reduce`, skip translate/scale parallax; use static planet placement and optional instant opacity (no off-screen slide) for the stagger.

## Optional Below-the-Fold Continuation (Non-Mandatory)

If the brief extends past the fold, a **feature band** can reuse glass panels, a two-column layout, a scan-line highlight over a simple icon, and a muted logo row—**only when the section contract includes those blocks**; the hero **MUST** still satisfy the checklist below on its own.

## Required Implementation Blueprint (Do Not Skip)

1. **MUST** implement the background as two non-interactive layers: a **tiled or repeated star spec** (CSS `background` with `radial-gradient` spots and `background-size`, or equivalent) **and** a **blurred** large circular/elliptical “planet/limb” element positioned to sit partially off-canvas, both with `pointer-events: none` and z-index under content.
2. **MUST** set **surface, text, border, and accent** colors from the **design system / section brief** (tokens, CSS variables, or theme classes)—not hardcoded one-off brand hexes from a reference.
3. **MUST** use a **client component** for scroll-driven `transform` on the planet layer (or a hook that only runs in the browser), and **MUST** remove the scroll listener and reset/cancel any animation frame in the effect cleanup.
4. **MUST** cap or clamp scroll-driven scale/translate so long scroll does not create extreme transform values or jank; use `passive: true` on scroll listeners if attaching to `window`.
5. **MUST** stagger the hero’s eyebrow, title block, subcopy, and CTA group with a defined entrance; **MUST** respect `prefers-reduced-motion` by disabling parallax and heavy motion paths when reduced.
6. **MUST** pair **display/serif** (or `font-display`) for the main headline with **monospace** for system-style labels/telemetry; follow project font configuration (no new Google Fonts unless the brief already names them; otherwise use configured families).
7. **MUST** provide **primary** and **secondary** actions: primary = filled or soft-filled outline using accent/surface tokens; secondary = border-only or ghost. **MUST** use the project’s icon set (e.g. `lucide-react` per repo conventions) for arrow/icons—**no** CDN `lucide` script or `iconify-icon`.
8. **MUST NOT** add `<script src="https://…">` for Tailwind, icons, or runtime deps; use the app’s build pipeline and imports only.

If any of the above is missing, the output is **not** valid for `starfield-planet-horizon`.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
// or: match project's motion + token imports

const STARFIELD_STYLE: CSSProperties = {
  // Use CSS variables or Tailwind theme tokens for opacity/size
  position: "fixed",
  inset: 0,
  zIndex: 0,
  pointerEvents: "none",
  backgroundImage: [
    "radial-gradient(1px 1px at 10% 10%, var(--star-dot, currentColor) 100%, transparent)",
    "radial-gradient(1px 1px at 20% 20%, var(--star-dot, currentColor) 100%, transparent)",
  ].join(", "),
  backgroundSize: "550px 550px",
  opacity: 0.3,
};

export function StarfieldPlanetHero() {
  const planetRef = useRef<HTMLDivElement | null>(null);
  const reduce = useReducedMotion() ?? false;

  useEffect(() => {
    if (reduce) return;
    const el = planetRef.current;
    if (!el) return;

    const onScroll = () => {
      const y = window.scrollY;
      const translateY = y * 0.1;
      const scale = 1 + y * 0.0005;
      el.style.transform = `translate3d(0, ${translateY}px, 0) scale(${Math.min(scale, 1.4)})`;
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduce]);

  return (
    <section className="relative z-10 flex min-h-screen w-full flex-col justify-center overflow-hidden px-8 pt-20 md:px-24">
      <div
        className="text-muted-foreground/40"
        style={STARFIELD_STYLE}
        aria-hidden
      />
      <div
        ref={planetRef}
        className="pointer-events-none fixed -bottom-[40vh] -right-[20vw] z-0 h-[120vw] w-[120vw] rounded-full opacity-60 blur-3xl"
        style={{
          // Planet limb: map stops to --background, --accent, etc.
          background:
            "radial-gradient(circle at 50% 0%, rgb(0 0 0) 40%, var(--surface-2) 60%, var(--primary) 65%, var(--primary-foreground) 68%, transparent 72%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 max-w-4xl">
        <div
          className="mb-6 flex items-center gap-4 opacity-0 motion-safe:animate-[heroIn_1s_ease_0.2s_forwards]"
        >
          <div className="h-px w-12 bg-border" />
          <span className="font-mono text-xs tracking-[0.3em] text-muted-foreground">
            {/* brief-driven eyebrow */}
          </span>
        </div>

        <h1 className="mb-8 font-display text-5xl leading-tight opacity-0 motion-safe:animate-[heroIn_1s_ease_0.5s_forwards] md:text-8xl">
          {/* Headline; gradient text via from-primary via-muted to-muted */}
        </h1>

        <p className="mb-12 max-w-xl text-lg font-light text-muted-foreground opacity-0 motion-safe:animate-[heroIn_1s_ease_0.8s_forwards] md:text-xl">
          {/* Subcopy */}
        </p>

        <div className="flex flex-col gap-6 opacity-0 motion-safe:animate-[heroIn_1s_ease_1.1s_forwards] md:flex-row">
          <button
            type="button"
            className="inline-flex items-center gap-2 border border-primary/60 bg-primary/10 px-8 py-4 text-xs uppercase tracking-widest text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            {/* CTA label */}
            <ArrowRight className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className="border border-border px-8 py-4 text-xs uppercase tracking-widest text-muted-foreground transition hover:bg-muted/30"
          >
            {/* secondary */}
          </button>
        </div>
      </div>

      <div className="absolute bottom-12 left-8 flex gap-12 font-mono text-[10px] text-muted-foreground md:left-24">
        {/* optional telemetry: labels + static or live values if brief allows */}
      </div>
    </section>
  );
}
```

Add `@keyframes heroIn` in global CSS or Tailwind `theme` extension as in other sections; for `prefers-reduced-motion`, use static `opacity-100` and drop animation classes.

## Layout Details

- Keep the planet mostly **off-canvas** so the headline stays on a calmer void; increase blur and lower opacity on small viewports if banding appears.
- Ensure **WCAG** contrast for headline and CTAs on the chosen `background`; if the planet bleeds under text, add a token-based scrim or shift content `max-w-*` to the calmer area.

## Content Rules

- Headline: bold claim + optional gradient line for secondary phrase; subcopy: precision, control, or automation (match product, not the sample’s literal vertical).
- Eyebrow: short code-like or protocol string if the brief allows; otherwise a normal category label in mono.
- Telemetry line: **decorative**—short labels + plausible static numbers/strings unless the product supplies live data; never fake precision that implies a regulated claim.

## Implementation Constraints

- `"use client"` when using scroll, refs, or browser-only motion hooks.
- No CDN `<script>`, no Tailwind browser runtime, no `iconify-icon`, no styled-jsx—follow repo patterns (Tailwind v4, CSS modules, or shared `globals.css`).
- Icons: `lucide-react` or the project’s documented icon system.

## Accessibility + Performance

- Decorative layers: `aria-hidden` on starfield and planet; ensure focus order stays in interactive controls only.
- `pointer-events-none` on all decorative full-screen divs.
- Throttle or use passive scroll; avoid `transform` on large layers every frame on low-end mobile if the brief allows—consider intersection-based “near hero only” parallax.
- No WebGL or second canvas in this skill—if the output adds Three.js, the implementation does **not** match this `id`.
