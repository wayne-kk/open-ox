# Component Skill: Hero — Scroll-Morph Screen Orbs (CSS / DOM)

Use this skill when `generateSection` should deliver a **hero-only** block inspired by **additive “orb” lighting**: several **huge, heavily blurred circles** with `mix-blend-mode: screen`, sitting in a **fixed, non-interactive** backdrop, while **scroll position inside the hero** (or viewport intersection thresholds) **smoothly morphs** each orb’s **translate, scale, opacity, and semantic fill**—without WebGL, canvas animation loops, or a multi-section landing embedded in one file.

For **three phased recipes** (hero / mid / deep) with **long blend transitions** mapped to scroll **0…1**, prefer **`screen-blend-orbs-hero`** — this id is better when you want **flexibility** (e.g. **two** recipes, alternate progress formulas, or simpler MUSTs).

**Scope — hero only:** The exported section contains **only** the first-screen experience: **orb field + primary headline stack** (eyebrow, display title, supporting paragraph). **Do not** include site `<nav>`, brand/version header rows, `mix-blend-difference` top chrome, secondary full-height “chapters” (synthesis/context/download), **equalizer** demos, **orbiting satellite** diagrams, or a **bottom timeline** strip—those belong in **other sections** composed by the page shell.

## Core Effect

- **Additive void** — Near-black **surface** from tokens; 3 orb **blobs** (could start with third at opacity 0) read as **colored light pools**, not crisp shapes.
- **Screen / plus-light look** — `mix-blend-mode: screen` (or `plus-lighter` where supported and brief allows) so overlaps **brighten** the scene.
- **Scroll morph** — As the user scrolls through the hero (0→1 progress while the section still occupies meaningful viewport height), orbs **transition** position/scale/opacity and **role-mapped** fills using CSS transitions (2s ease-out family) or `requestAnimationFrame` throttled updates—**never** hard-require the exact hex choreography from any reference snippet.
- **Typography** — Ultra-tight **display** headline with `clamp`, wide-track **uppercase eyebrow**, muted **subcopy** in `muted-foreground`-class role.
- **Entrance** — Staggered **fade + translateY** on copy when the hero enters view (`IntersectionObserver` or hook), with delays on children.

## Visual Language

- **Atmosphere** — “Studio night” + **confident accent glow**; map orb colors to **design tokens** (e.g. primary / secondary / chart / accent slots)—describe **warm vs cool bias** and **contrast against background**, not demo palette hexes.
- **Motion personality** — Slow, **premium** eases (`cubic-bezier(0.16, 1, 0.3, 1)` class of curve); morphs feel **inevitable**, not bouncy.
- **Texture** — Softness from **CSS blur** only (e.g. `blur-3xl` / ~64–96px effective), not image grain unless the brief demands it.

## Structure Requirements

1. **Z-order:** `fixed` orb wrapper `inset-0` `overflow-hidden` `pointer-events-none` `z-0` · hero `relative z-10` `min-h-[100svh]` (or `min-h-screen`) with horizontal padding from tokens / responsive `px`.
2. **Three orb nodes** — Each a single `div`, `rounded-full`, token `backgroundColor`, heavy blur, `mix-blend-screen`, **no pointer events**.
3. **No chrome** — No `<nav>`, no fake app header inside the section.

## Motion Direction

- **Scroll progress** — Implement **one** of: (a) `useEffect` + `scroll` listener on `window` or scroll parent, computing progress while hero is in view; (b) `IntersectionObserver` with multiple thresholds to snap through 2–3 **orb recipes**; (c) CSS-only **initial** state + IO reveal if brief disallows scroll choreography—**hero must still read complete**.
- **Transitions** — Prefer **CSS `transition`** on `transform`, `opacity`, `background-color` for orbs when recipes change; duration ~1.5–2.5s for morphs, **ease-out-heavy**.
- **Copy reveal** — IO at `threshold` ~0.35–0.5 toggles `data-visible` / class on `[data-hero-fade]` children with staggered `transition-delay`.
- **`prefers-reduced-motion: reduce`** — Skip scroll-driven morphing: pick **one static** balanced oracle layout; show copy **visible** without translate stagger (opacity-only optional). Disconnect observers and cancel listeners on unmount.

## CSS / DOM (no WebGL)

- **Blur + blend** — Tailwind utilities or scoped CSS module; **no** `@import` Google Fonts, **no** `cdn.tailwindcss.com` script.
- **Progress hook** — If using scroll: **passive** listener where possible; **throttle** with `requestAnimationFrame`; cleanup on unmount.

## Required Implementation Blueprint (Do Not Skip)

1. **MUST** render **exactly three** orb `div`s in a **fixed** full-viewport layer with `**mix-blend-mode: screen**` (or documented equivalent), **heavy blur**, and **`pointer-events: none`**; **semantic** fills from **tokens / CSS variables from the active brief**, not mandatory literal reference hex values.
2. **MUST** drive **at least one** meaningful **orb state change** from **user scroll while the hero is on screen** (progress-based interpolation or threshold snaps)—unless `prefers-reduced-motion`, in which case **MUST** use a single static hero-balanced layout.
3. **MUST** implement **staggered fade-in** for eyebrow / title / paragraph via **IntersectionObserver** (or equivalent) and **disconnect** on unmount.
4. **MUST** include **eyebrow** (uppercase, tracked), **`clamp` fluid headline** with **tight negative tracking**, and **one** supporting paragraph in muted tone; copy may be **props** or realistic placeholders aligned to `projectContext.language`.
5. **MUST NOT** embed **Navigation**, **secondary full-height sections**, **timeline UI**, **equalizer bars**, or **satellite orbit** widgets in this component.
6. **MUST NOT** add **CDN scripts**, **inline `@import` fonts**, or **`@font-face` URLs** to googleapis—use the site’s font stack.
7. **MUST** export a **named** React function component with **`"use client"`** at top of file (hooks + IO/scroll).
8. **MUST** guard all DOM access: **`typeof window !== "undefined"`** where needed; no crashes on SSR first paint.

If any **MUST** is missing, output is **not** valid for `scroll-morph-screen-orbs-hero`.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

const easeOut = "cubic-bezier(0.16, 1, 0.3, 1)";

type OrbStyle = {
  transform: string;
  opacity: number;
  background: string;
};

export function ScrollMorphScreenOrbsHero() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number>(0);
  const [recipeIndex, setRecipeIndex] = useState(0);

  const recipes: [OrbStyle, OrbStyle, OrbStyle][] = [
    [
      { transform: "translate(0,0) scale(1)", opacity: 0.6, background: "hsl(var(--primary))" },
      { transform: "translate(0,0) scale(1)", opacity: 0.6, background: "hsl(var(--secondary))" },
      { transform: "translate(0,0) scale(1)", opacity: 0, background: "hsl(var(--chart-2))" },
    ],
    [
      { transform: "translate(-12%, 18%) scale(0.85)", opacity: 0.55, background: "hsl(var(--chart-2))" },
      { transform: "translate(-18%, -12%) scale(1.1)", opacity: 0.45, background: "hsl(var(--primary))" },
      { transform: "translate(8%, -8%) scale(1)", opacity: 0.65, background: "hsl(var(--chart-3))" },
    ],
  ];

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const reveal = () => {
      el.querySelectorAll("[data-hero-fade]").forEach((n) => {
        n.setAttribute("data-visible", "true");
      });
    };

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reveal();
      setRecipeIndex(0);
      return;
    }

    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) reveal();
      },
      { threshold: 0.35 },
    );
    io.observe(el);

    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight || 1;
        const raw = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height * 0.35)));
        setRecipeIndex(raw > 0.55 ? 1 : 0);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const [a, b, c] = recipes[Math.min(recipeIndex, recipes.length - 1)] ?? recipes[0]!;

  const orbBase =
    "pointer-events-none absolute rounded-full mix-blend-screen blur-3xl transition-[transform,opacity,background-color] duration-[2s]";

  return (
    <div
      ref={sectionRef}
      className="relative min-h-[100svh] overflow-x-hidden bg-background text-foreground"
    >
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
        <div
          className={`${orbBase} h-[60vh] w-[60vh]`}
          style={{
            top: "20%",
            left: "20%",
            transform: a.transform,
            opacity: a.opacity,
            backgroundColor: a.background,
            transitionTimingFunction: easeOut,
          }}
        />
        <div
          className={`${orbBase} h-[50vh] w-[50vh]`}
          style={{
            top: "30%",
            right: "20%",
            transform: b.transform,
            opacity: b.opacity,
            backgroundColor: b.background,
            transitionTimingFunction: easeOut,
          }}
        />
        <div
          className={`${orbBase} h-[40vh] w-[40vh]`}
          style={{
            bottom: "10%",
            left: "40%",
            transform: c.transform,
            opacity: c.opacity,
            backgroundColor: c.background,
            transitionTimingFunction: easeOut,
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-[100svh] flex-col justify-center px-[clamp(1.25rem,10vw,8rem)]">
        <div className="max-w-4xl">
          <span
            data-hero-fade
            className="mb-4 block translate-y-5 text-sm font-medium uppercase tracking-widest text-muted-foreground opacity-0 transition-[opacity,transform] duration-700 data-[visible=true]:translate-y-0 data-[visible=true]:opacity-70"
          >
            {/* eyebrow from brief */}
          </span>
          <h1
            data-hero-fade
            className="mb-6 translate-y-5 text-[clamp(3rem,8vw,8rem)] font-bold leading-[0.95] tracking-[-0.04em] opacity-0 transition-[opacity,transform] delay-100 duration-700 data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100"
          >
            {/* headline */}
          </h1>
          <p
            data-hero-fade
            className="max-w-[50ch] translate-y-5 text-lg leading-relaxed text-muted-foreground opacity-0 transition-[opacity,transform] delay-200 duration-700 data-[visible=true]:translate-y-0 data-[visible=true]:opacity-100 md:text-xl"
          >
            {/* supporting copy */}
          </p>
        </div>
      </div>
    </div>
  );
}
```

## Layout Details

- **Orb positions** — Use **percent / vh** anchors so layouts work across breakpoints; avoid locking to pixel artboards from a demo.
- **Readable column** — Cap text width; maintain **minimum contrast** against orb glow (slight text shadow or overlay only if brief requires—default avoid heavy scrim).

## Content Rules

- Tone: **confident, technical-humanist** (insight / signal / learning) unless the brief overrides.
- **Language** — All user-facing strings follow `projectContext.language` from the generate pipeline.

## Implementation Constraints

- **`"use client"`** required.
- **No** CDN Tailwind, **no** external script tags for fonts.
- **Icons** — Only if brief asks; use project icon system (e.g. `lucide-react`) or inline SVG—**not** icon CDNs.
- **Cleanup** — Remove scroll listeners and cancel rAF; disconnect `IntersectionObserver` on unmount.

## Accessibility + Performance

- Decorative layer **`aria-hidden`** on orb wrapper.
- **`prefers-reduced-motion`** static fallback as specified.
- Keep **three DOM orbs** max in this pattern; **no** continuous physics unless brief extends.

---

*Derived from a multi-section reference; this skill intentionally **collapses** scroll-morph logic into **hero-local** progress so `generateSection` emits one coherent shell-safe component.*
