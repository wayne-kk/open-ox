# Component Skill: Hero — Portfolio Tilt Card Rail (Spotlight)

Centered headline with one gradient span; two floating pills above a **six** portrait-card rail with light scatter (rotate/offset); **click** focuses one card (blur/dim siblings); reset on outside or second click. **CSS + images + client state**—no WebGL.

Not **`signal-grid-split-hero`** or **`editorial-blinds-hero`**—centered gallery + spotlight, not HUD or blinds.

## Core Effect

- **Centered headline**: large sans stack; **one line or fragment** uses **gradient-to-transparent text** (`bg-clip-text`, `text-transparent`)—**hue and contrast come from brief tokens**, not a fixed white→gray ramp.
- **Rhythm block** between headline and rail (may be **empty** spacing / subtle divider—structure only).
- **Floating pills**: **two** small **rounded “role” labels** (e.g. persona or community tags) **absolutely positioned** above the rail, **asymmetric left/right**, each with a **tiny diamond “tail”** suggesting a callout.
- **Card rail**: **six** **3:4 portrait tiles** in a **responsive grid** (dense columns on small screens, **one column per card** from `sm` upward in a six-column grid); each tile has **unique slight rotate + translate-y** for a **scattered desk**; **hover scale** is subtle.
- **Spotlight mode**: **one** card can be “focused”: **others** get **blur + lowered opacity** and **base transforms cleared** for the duration; the **active** card **neutralizes rotate**, **lifts scale**, **full opacity**, **highest z-index**. **Toggle off** by clicking the **same** card again or **outside** the grid container.
- **Staggered entrance** (`fadeSlideIn`-style): headline → rail → subcopy → CTA row with **short delays**; **must** collapse to **immediate layout** when `prefers-reduced-motion: reduce`.

## Visual Language

- **Palette roles** (map to design tokens—**do not** freeze demo **blue/orange** pill fills or fixed `neutral-300` copy):
  - **Page ground**: deep neutral or token `background`.
  - **Headline**: high-contrast primary foreground; **accent gradient span** uses **primary / muted / secondary** stops from theme.
  - **Pills**: **two distinct accent fills** for differentiation (e.g. primary vs. secondary brand)—**derive from brief**, not literal `blue-600` / `orange-500`.
  - **Cards**: **hairline ring** at low alpha; **shadow** lifts on hover; images **cover** crops without distortion.
  - **Subcopy**: **muted** foreground token.
  - **Primary CTA**: **dark elevated pill** with **soft internal gradient**, **token-based glow blobs** (low opacity, `mix-blend-*` optional), **sheen** on hover; **secondary CTA**: **muted surface**, **thin ring**.
- **Typography**: bold **display sans** for headline; **medium** UI sans for pills and buttons; body size for subcopy—use **project font tokens**.

## Structure Requirements

- **No site navigation** — no `<nav>`, logo strip, or global shell inside this section.
- **Layer order (bottom → top)**:
  1. Section wrapper: horizontal padding + **max-width** container (`max-w-7xl` class family or project equivalent).
  2. **Headline** block: `mx-auto max-w-3xl text-center`.
  3. **Optional spacer / divider** region: `max-w-5xl mx-auto` for optical alignment with rail.
  4. **Rail wrapper** `relative mx-auto max-w-5xl`: contains **absolute pills** + **grid**.
  5. **CTAs**: centered flex row with gap; below subcopy.

## Motion Direction

- **Entrance**: `fadeSlideIn` — opacity **0→1** + small **translateY** (e.g. `8–16px` reference), **`animation-fill-mode: both`**, staggered delays (~`0.1s`, `0.3s`, `0.5s`, `0.7s` reference). Under **reduced motion**, apply **no** keyframe animation (or **opacity only** if product allows—prefer **none**).
- **Card hover**: **scale ~1.05** with **duration ~700ms**, `ease-out`; **must not** fight spotlight transform (merge logic so focused state wins).
- **Spotlight transition**: **~0.7s ease-out** on **filter, opacity, transform, z-index** where applicable.
- **Primary CTA**: **hover lift** (`-translate-y`, outline brightening), **sheen sweep** across pseudo-layer.

## CSS / DOM Details

- **Gradient border**: source uses a **`border-gradient` utility**—if the project lacks it, substitute **ring + inset highlight** or **documented** token gradient border pattern; **do not** require a CDN-only plugin.
- **Keyframes**: define **`fadeSlideIn`** in **project global CSS** or Tailwind **theme extension**—**no** Next.js `<style jsx>`.

## Required Implementation Blueprint (Do Not Skip)

When this skill is selected, the generated hero MUST include all of the following:

1. **Centered headline** with **at least one gradient-text span** (`background-image` linear gradient + `background-clip: text`) using **theme-derived stops**, not pasted demo hex pairs.
2. **Rail section** with **`relative` container**, **centered `max-w-5xl` (or equivalent)**, containing **exactly two** **floating pills** positioned **`absolute`** with **responsive offsets** (percent + breakpoint tweaks), each pill **inline-flex** with **icon** + label and a **small rotated square tail** under the pill.
3. **Six image cards** in a **grid** with **six columns** at the desktop reference: on **small** screens, cards **span multiple columns** so the grid remains **balanced** (same structural approach as source: **2 units wide per card** on base, **1 unit** from `sm+`).
4. **Portrait framing**: every card inner wrapper **`aspect-[3/4]`**, **`rounded-2xl`**, **`overflow-hidden`**, **`object-cover` image**, **subtle ring + shadow**; **each card** has a **distinct rotation and vertical offset** in **default** state (stored in **data or constants**, not magic inline strings duplicated six times without structure).
5. **Spotlight interaction** implemented with **React state** (`activeIndex: number | null` or equivalent): clicking a card **focuses** it; **non-active** cards get **blur + reduced opacity** and **transform reset** relative to default rail layout; **active** card **clears tilt**, **scales up modestly** (~`1.1–1.2`), **full opacity**, **top z-index**; clicking **same** card **clears** focus; **click outside** grid **clears** focus (use **`useRef`** on container + **`mousedown`/`pointerdown`** or **`click`** on `document` with **cleanup on unmount**).
6. **Hover scale** on cards in **unfocused** or **non-spotlight** states; when spotlight active, **non-selected** cards **omit hover-grow** or keep it **subtle**—behavior must stay **readable**.
7. **Staggered entrance** on headline, rail block, subcopy, and CTA row—**disabled or instant** under `prefers-reduced-motion: reduce` (**matchMedia** subscription with cleanup acceptable).
8. **Subcopy** paragraph: centered, **`max-w-xl`**, **muted** foreground token.
9. **Two CTAs**: **primary** as **pill button** with **layered background** (internal gradient + **soft glow ellipses** + optional **sheen sweep** + **inset highlight**); **secondary** as **link/button** with **muted fill**, **ring**, and **external-link style icon**; labels from **brief**.
10. **Icons** from **project system** (e.g. **`lucide-react`**)—**no** Iconify, **no** raw CDN icon scripts, **no** enormous pasted SVG trees unless project forbids lucide.
11. **Images**: **`next/image`** or **`<img>`** with meaningful **`alt`**; **no** mandatory hard-coded third-party CDN URLs—use **props**, CMS fields, or **placeholder** assets from brief.
12. **Accessibility**: decorative motion layers **`aria-hidden`** where appropriate; **focus-visible** rings on interactive elements; spotlight cards remain **keyboard-discoverable** if product uses **buttons**—if **div** click handlers are used, **document** the gap or use **`role="button"`** + **`tabIndex={0}`** + **`Enter`/`Space`** (prefer **real `<button>`** wrapping image for primary action if acceptable visually).
13. **Hygiene**: **`use client`** only on the component that registers listeners; **no** inline script tags in JSX; **no** `cdn.tailwindcss.com`.

If any item above is missing, the output is **NOT** valid for `portfolio-tilt-card-rail-hero`.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { ArrowUpRight, ExternalLink } from "lucide-react"

type CardDef = {
  src: string
  alt: string
  defaultClass: string
}

type RolePill = { label: string; pillClassName: string; tailClassName: string }

type PortfolioTiltCardRailHeroProps = {
  headline: { line1: string; gradientLine: string }
  rolePills: [RolePill, RolePill]
  cards: readonly CardDef[]
  subcopy: string
  primaryCta: { label: string; onClick?: () => void }
  secondaryCta: { label: string; href: string }
}

export function PortfolioTiltCardRailHero(props: PortfolioTiltCardRailHeroProps) {
  const { headline, rolePills, cards, subcopy, primaryCta, secondaryCta } = props
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onChange = () => setReduceMotion(mq.matches)
    onChange()
    mq.addEventListener?.("change", onChange)
    return () => mq.removeEventListener?.("change", onChange)
  }, [])

  const onDocPointer = useCallback(
    (e: MouseEvent | PointerEvent) => {
      const root = gridRef.current
      if (activeIndex === null || !root) return
      if (!root.contains(e.target as Node)) setActiveIndex(null)
    },
    [activeIndex],
  )

  useEffect(() => {
    document.addEventListener("pointerdown", onDocPointer)
    return () => document.removeEventListener("pointerdown", onDocPointer)
  }, [onDocPointer])

  const entrance = (delayMs: number) =>
    reduceMotion
      ? undefined
      : { animation: `fadeSlideIn 1s ease-out ${delayMs}ms both` }

  return (
    <section className="mx-auto max-w-7xl px-6 pb-28 pt-36 sm:pb-28 sm:pt-36">
      <div className="relative">
        <div
          className="mx-auto max-w-3xl text-center"
          style={entrance(100)}
        >
          <h1 className="font-sans text-4xl font-semibold leading-[1.06] tracking-tighter sm:text-6xl lg:text-7xl">
            {headline.line1}{" "}
            <span className="block bg-gradient-to-r from-[color:var(--foreground)] to-[color:var(--muted-foreground)] bg-clip-text text-transparent">
              {headline.gradientLine}
            </span>
          </h1>
        </div>

        <div className="mx-auto mt-10 max-w-5xl px-2" aria-hidden />

        <div
          className="relative mx-auto mt-12 max-w-5xl sm:mt-12"
          style={entrance(300)}
        >
          <div className="absolute left-[12%] top-0 z-50 -translate-y-5 sm:left-[16%] sm:-translate-y-7">
            <Pill {...rolePills[0]} />
          </div>
          <div className="absolute right-[10%] top-0 z-50 -translate-y-4 sm:right-[14%] sm:-translate-y-6">
            <Pill {...rolePills[1]} />
          </div>

          <div
            ref={gridRef}
            className="flex justify-center"
            role="presentation"
          >
            <div className="grid grid-cols-6 gap-x-3 gap-y-3 sm:gap-4">
              {cards.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={activeIndex === i}
                  className={[
                    "card-item self-end text-left transition-all duration-700 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
                    c.defaultClass,
                    activeIndex !== null && activeIndex !== i
                      ? "z-[1] blur-sm opacity-40"
                      : "",
                    activeIndex === i
                      ? "z-10 !translate-y-0 !rotate-0 scale-[1.15] !blur-none !opacity-100"
                      : "",
                  ].join(" ")}
                  onClick={() =>
                    setActiveIndex((cur) => (cur === i ? null : i))
                  }
                >
                  <div className="aspect-[3/4] overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/10 transition-shadow duration-500 hover:shadow-2xl">
                    <Image
                      src={c.src}
                      alt={c.alt}
                      width={600}
                      height={800}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p
          className="mx-auto mt-8 max-w-xl text-center text-base font-sans text-[color:var(--muted-foreground)]"
          style={entrance(500)}
        >
          {subcopy}
        </p>

        <div
          className="mt-8 flex flex-wrap items-center justify-center gap-4"
          style={entrance(700)}
        >
          <button
            type="button"
            className="group relative inline-flex h-10 max-w-[300px] items-center justify-center rounded-full px-6 text-base font-semibold text-[color:var(--primary-foreground)] outline outline-1 outline-white/10 transition-all duration-500 hover:-translate-y-0.5 hover:outline-white/20 focus-visible:outline-2 focus-visible:outline-[color:var(--ring)] lg:h-11"
            onClick={primaryCta.onClick}
          >
            <span
              aria-hidden
              className="absolute -inset-px overflow-hidden rounded-full"
            >
              <span className="absolute inset-0 rounded-full bg-[linear-gradient(140deg,var(--cta-a),var(--cta-b),var(--cta-c),var(--cta-d))]" />
              {/* Glow blobs + sheen: token CSS variables, not demo rgba */}
            </span>
            <span className="relative z-10 flex items-center gap-1.5 font-sans text-[14px] font-normal leading-none -tracking-[0.04em] text-white/95 lg:text-base">
              {primaryCta.label}
            </span>
          </button>
          <a
            href={secondaryCta.href}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-800/60 px-5 py-3 font-sans text-sm font-medium text-neutral-100 ring-1 ring-white/10 hover:bg-neutral-800"
          >
            {secondaryCta.label}
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  )
}

function Pill({ label, pillClassName, tailClassName }: RolePill) {
  return (
    <div className="relative">
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium text-white shadow-md ${pillClassName}`}
      >
        {label}
        <ArrowUpRight className="h-4 w-4" aria-hidden />
      </span>
      <span
        className={`absolute -bottom-1 left-6 h-2 w-2 rotate-45 ${tailClassName}`}
        aria-hidden
      />
    </div>
  )
}
```

Add to global CSS (example only):

```css
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

## Layout Details

- **Vertical rhythm**: generous **`pt-36` / `pb-28`** on section (tune to project spacing scale).
- **Readability**: ensure **contrast** between headline and background; **pill text** must pass **WCAG** on **accent fills** from tokens.
- **Z-index**: pills **`z-50`** above cards; spotlight active card **`z-10`** within grid context.

## Content Rules

- **Headline**: short **value proposition**; **gradient line** should be the **emotional hook** (e.g. outcome, audience), not a long sentence.
- **Pills**: **roles or communities** the product serves—**two** labels max in reference layout.
- **Card alt text**: describe **subject** (artwork genre, project type)—brief-driven.
- **Subcopy**: **three-part benefit** sentence pattern is fine; avoid jargon unless B2B brief demands.

## Implementation Constraints

- **`use client`** for pointer-outside + motion query; **server components** may wrap static outer shell if project splits.
- **No** `iconify-icon`, **no** Tailwind CDN script, **no** `<style jsx>`.
- **Dispose** all event listeners in **`useEffect`** return paths.

## Accessibility + Performance

- **Reduced motion**: gate **fadeSlideIn** and optionally **disable blur** on siblings if it causes discomfort—product choice; **minimum** is **no stagger animation**.
- **Blur cost**: `filter: blur` on multiple thumbnails can be **GPU-heavy**; on low-end targets, substitute **opacity-only** dimming—document in implementation comments if brief allows.
- **Images**: provide **width/height** or **`sizes`** for `next/image`; lazy-load below fold if framework defaults allow.
