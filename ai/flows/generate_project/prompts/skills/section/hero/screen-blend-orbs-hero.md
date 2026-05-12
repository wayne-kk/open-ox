# Component Skill: Hero — Screen-Blend Orbs (CSS / DOM)

Hero-only: near-black ground, **two or three** large blurred circles with `mix-blend-mode: screen`, tight display headline. Orb layout **morphs** with **scroll progress 0→1** on this section root (long CSS transitions)—no WebGL or canvas loops.

**Scope — hero only:** Orbs + headline column. No `<nav>`, brand rows, multi-chapter grids, equalizer, orbit diagrams, or page-level timelines—those belong elsewhere.

**Progress:** Bind **2–3 orb “recipes”** to progress through the section root (e.g. thirds of `0…1`). All fills from **design tokens**, not fixed demo hex.

## Core Effect

- **Additive void** — Token `background`; **fixed** `inset-0` orb layer; **`mix-blend-mode: screen`** (or `plus-lighter` if brief allows).
- **Three orbs** — Default **three** `div`s (two dominant + third **often starting at `opacity: 0`** then **joining** mid-progress); sizes **asymmetric** (~40–60vh width), **blur ~64–96px** (`blur-3xl` class range).
- **Scroll morph** — While the **root** intersects the viewport, compute **`progress ∈ [0,1]`** from **document scroll + `getBoundingClientRect()`** (not multiple `IntersectionObserver` callbacks on fake subsections). When `progress` crosses segment boundaries, **update** each orb’s `transform`, `opacity`, and **token-mapped** `backgroundColor`; rely on **long CSS `transition`** (`~2s` **`cubic-bezier(0.16, 1, 0.3, 1)`** on transform, **`background-color ~2s ease`**, **`opacity ~2s ease`**) so changes **ease** like the reference — this is the **“滚动渐变”** (gradual morph), not instant swaps.
- **Copy entrance** — **IntersectionObserver** (or `useInView`) adds **staggered** `translateY(20px) → 0` + opacity on **eyebrow / H1 / p**; eyebrow often settles at **~70% opacity** when visible (muted signal).

## Visual Language

- **Atmosphere** — “Studio dark” + **pools of semantic light** (primary / secondary / chart / accent slots from tokens).
- **Morph intent** — Early progress: **two warm-forward pools** + hidden third; mid: **shift mass**, **introduce third** mass, **cooler / alternate** token roles; late: **diffused**, **smaller secondary glow**, **stronger tertiary** — **approximate** the reference’s three blocks **without** copying hex.
- **Texture** — Blur + screen blend only unless brief adds noise.

## Structure Requirements

1. **Z-order:** token **surface** → **fixed** orb wrapper **`z-0`** `pointer-events-none` → **relative** content **`z-10`**, **`min-h-screen` minimum** and **enough vertical extent** (e.g. extra **`padding-bottom`** or **`min-h-[120svh]`**) so **`progress` can move past ~0.25** while the user still scrolls **within** normal one-page flow — *or* rely on **page-level** scroll with next sections below; **progress** must still update smoothly as the hero block **moves through** the viewport.
2. **Root** — Single wrapper `ref` for rect + scroll binding; **one** hero **column** (`max-w-4xl`, `px-[clamp(…,10vw,…)]`).
3. **No interaction** on orbs.

## Motion Direction

- **Progress formula (document scroll, recommended):**  
  Let `el` = section root, `rect = el.getBoundingClientRect()`, `vh = window.innerHeight`.  
  A robust pattern:  
  `raw = (vh - rect.top) / (rect.height + vh * 0.35)` then `progress = clamp(0, 1, raw)`  
  (tune `0.35` only if brief needs faster/slower morph). **Throttle** with **`requestAnimationFrame`** from a **`scroll` listener** `{ passive: true }`; cancel rAF + remove listener on unmount.
- **Phase index:** `phase = progress < 1/3 ? 0 : progress < 2/3 ? 1 : 2` — apply `RECIPES[phase]` per orb (translate %, scale, opacity, CSS color).
- **Copy fade-in** — Same as before: IO **`threshold ~0.35`**, **`prefers-reduced-motion: reduce`** → show copy immediately **without** translate stagger; **freeze** `phase` at `0` (initial recipe only) — **no scroll morph dependency** for validity.

## CSS / DOM Background (no WebGL)

- **Orb class** — Tailwind: `rounded-full blur-3xl mix-blend-screen` + absolute positioning; inline **`style`** for **dynamic** transform / opacity / `backgroundColor` + **`transition: transform 2s cubic-bezier(0.16,1,0.3,1), background-color 2s ease, opacity 2s ease`** (match reference **feel**).
- **Eyebrow** — `text-sm uppercase tracking-widest`; visible state often **`opacity-70`** (not full 100).

## Required Implementation Blueprint (Do Not Skip)

1. **MUST** use **`mix-blend-mode: screen`** (or documented equivalent) on **≥2** blurred orbs in a **fixed** non-interactive layer; **MUST** include a **third** orb when the brief implies a **two→three mass** narrative (default **yes** for this `id`); **semantic colors only**.
2. **MUST** implement **scroll-driven** orb updates: **`progress`** derived from **layout + scroll** while the section is relevant, **≥3 recipes** (`phase` 0/1/2) mapping to **distinct** transform/opacity/background **roles** — **`prefers-reduced-motion`** may pin `phase === 0` only.
3. **MUST** apply **~2s** transitions on orb **`transform`**, **`opacity`**, and **`background-color`** so morphs **ramp smoothly** (the reference’s CSS `.orb { transition: … }` behavior).
4. **MUST** use **`pointer-events: none`** on orb layer; **z-index** below copy.
5. **MUST** implement **eyebrow + multi-line `clamp` headline + muted subcopy** with **IO stagger** and **disconnect** on unmount.
6. **MUST NOT** embed **nav**, **other full sections**, **timeline**, **equalizer**, **orbit UI**.
7. **MUST NOT** use CDN Tailwind, external font links, or hardcoded **mandatory** reference hex.
8. **MUST** use **`"use client"`** and **clean up** scroll listeners + rAF + observers.

If any **MUST** fails, output is **invalid** for `screen-blend-orbs-hero`.

Page-level note: if the **marketing page** later adds real `#synthesis` / `#context` sections, **those** own their content; **this** section’s orb morph is **self-contained** and approximates the **visual rhythm** of the reference without coupling to sibling section IDs.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

const easeOut = "cubic-bezier(0.16, 1, 0.3, 1)";

type Orb = { transform: string; opacity: number; background: string };

const PHASES: [Orb, Orb, Orb][] = [
  [
    { transform: "translate(0, 0) scale(1)", opacity: 0.6, background: "hsl(var(--primary))" },
    { transform: "translate(0, 0) scale(1)", opacity: 0.6, background: "hsl(var(--secondary))" },
    { transform: "translate(0, 0) scale(1)", opacity: 0, background: "hsl(var(--chart-2))" },
  ],
  [
    { transform: "translate(-20%, 30%) scale(0.8)", opacity: 0.65, background: "hsl(var(--chart-2))" },
    { transform: "translate(-30%, -20%) scale(1.2)", opacity: 0.5, background: "hsl(var(--primary))" },
    { transform: "translate(10%, -10%) scale(1)", opacity: 0.8, background: "hsl(var(--chart-3))" },
  ],
  [
    { transform: "translate(40%, -10%) scale(1.5)", opacity: 0.35, background: "hsl(var(--secondary))" },
    { transform: "translate(-20%, 20%) scale(0.5)", opacity: 0.25, background: "hsl(var(--foreground))" },
    { transform: "translate(0, 0) scale(1.1)", opacity: 0.65, background: "hsl(var(--chart-4))" },
  ],
];

function useScrollPhase(sectionRef: RefObject<HTMLElement | null>) {
  const [phase, setPhase] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof window === "undefined") return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase(0);
      return;
    }

    const tick = () => {
      raf.current = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const raw = (vh - rect.top) / (rect.height + vh * 0.35);
      const p = Math.min(1, Math.max(0, raw));
      const next = p < 1 / 3 ? 0 : p < 2 / 3 ? 1 : 2;
      setPhase((prev) => (prev !== next ? next : prev));
    };

    const onScroll = () => {
      if (!raf.current) raf.current = requestAnimationFrame(tick);
    };

    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (window.cancelAnimationFrame && raf.current) cancelAnimationFrame(raf.current);
    };
  }, [sectionRef]);

  return phase;
}

export function ScreenBlendOrbsHero() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const phase = useScrollPhase(sectionRef);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof window === "undefined") return;

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
      ([e]) => e?.isIntersecting && reveal(),
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const [a, b, c] = PHASES[phase] ?? PHASES[0]!;

  const orbTransition = `transform 2s ${easeOut}, background-color 2s ease, opacity 2s ease`;

  return (
    <div className="relative min-h-[min(120svh,1400px)] overflow-x-hidden bg-background text-foreground">
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden
      >
        <div
          className="absolute h-[60vh] w-[60vh] rounded-full mix-blend-screen blur-3xl"
          style={{
            top: "20%",
            left: "20%",
            transform: a.transform,
            opacity: a.opacity,
            backgroundColor: a.background,
            transition: orbTransition,
          }}
        />
        <div
          className="absolute h-[50vh] w-[50vh] rounded-full mix-blend-screen blur-3xl"
          style={{
            top: "30%",
            right: "20%",
            transform: b.transform,
            opacity: b.opacity,
            backgroundColor: b.background,
            transition: orbTransition,
          }}
        />
        <div
          className="absolute h-[40vh] w-[40vh] rounded-full mix-blend-screen blur-3xl"
          style={{
            bottom: "10%",
            left: "40%",
            transform: c.transform,
            opacity: c.opacity,
            backgroundColor: c.background,
            transition: orbTransition,
          }}
        />
      </div>

      <section
        ref={sectionRef}
        className="relative z-10 flex min-h-screen flex-col justify-center px-[clamp(1.25rem,10vw,8rem)]"
      >
        <div className="max-w-4xl">
          <span
            data-hero-fade
            className="mb-4 block translate-y-5 text-sm font-medium uppercase tracking-widest text-muted-foreground opacity-0 transition-[opacity,transform] duration-[800ms] data-[visible=true]:translate-y-0 data-[visible=true]:opacity-70"
            style={{ transitionTimingFunction: easeOut }}
          >
            Eyebrow
          </span>
          <h1
            data-hero-fade
            className="mb-6 translate-y-5 text-[clamp(3rem,8vw,8rem)] font-bold leading-[0.95] tracking-[-0.04em] opacity-0 transition-[opacity,transform] delay-100 duration-[800ms] ease-out data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100"
            style={{ transitionTimingFunction: easeOut }}
          >
            Headline
            <br />
            Second line
          </h1>
          <p
            data-hero-fade
            className="max-w-[50ch] translate-y-5 text-lg leading-relaxed text-muted-foreground opacity-0 transition-[opacity,transform] delay-200 duration-[800ms] ease-out data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100 md:text-xl"
            style={{ transitionTimingFunction: easeOut }}
          />
        </div>
      </section>
    </div>
  );
}
```

Fix typo in skeleton: `justify-center` not `justify.center`.

## Layout Details

- **Extra height** — `min-h-[min(120svh,1400px)]` on outer wrapper (or equivalent) helps **`progress`** advance before the next page section; adjust per brief.
- **Legibility** — Nudge orbs or `max-w` if headline fights local glow.

## Content Rules

- Eyebrow: short signal. Headline: imperative / declarative with optional `<br />`. Subcopy: one concrete paragraph.

## Implementation Constraints

- `"use client"`; no CDN; no `<style jsx>` for prod-critical orb math unless project standard.

## Accessibility + Performance

- Orb wrapper `aria-hidden`.
- **One** scroll listener (passive) + **rAF coalescing**; **no** per-frame recolor without rAF.
- Disconnect IO on unmount.

**Relation to `scroll-morph-screen-orbs-hero`:** that skill is a **lighter** variant (often **two** recipes + simpler story). **`screen-blend-orbs-hero`** is the **default Retune-class** recipe: **three phases**, **three orbs**, **long blend transitions**.

If the output uses **WebGL / canvas** for the background, it does **not** match this `id`.
