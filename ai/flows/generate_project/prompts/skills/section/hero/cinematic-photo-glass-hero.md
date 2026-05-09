# Component Skill: Hero — Cinematic Full-Bleed Photo + Glass UI

Use this skill when `generateSection` needs a **premium, cinematic first screen**: a **full-viewport photographic background** with a **subtle edge treatment**, **centered editorial typography** (glass **announcement bar**, large **serif headline**, supporting copy), **primary + secondary CTAs**, and a **partner / authority logo rail** below. Pure **HTML/CSS + imagery**—**no WebGL**, **no canvas shaders**, **no blinds / slit parallax**.

**Source note:** The reference markup included a **top `<header>` with logo, `<nav>`, and mobile menu**. Per project hero-skills contract, **that chrome is NOT part of this section**—implement **global navigation in the layout/shell**. This skill covers **background stack + hero story + partner strip** only.

Route away from **`editorial-blinds-hero`** (vertical blinds + scroll parallax) and **WebGL `*-webgl` skills**—here the hero reads as **single hero photograph + frosted UI**.

## Core Effect

- **Root section**: **`w-full`**, **`min-h-screen`** (or `min-h-[100dvh]` if project standard), **`relative`**, **`isolate`**, **`overflow-hidden`** so layers stack predictably.
- **Background**: one **`absolute inset-0`** image **`w-full h-full object-cover`**—**hero-grade still** (space, landscape, aviation, expedition, etc.) from **brief assets**; **meaningful `alt`** from content (not empty unless purely decorative and documented).
- **Frame**: **`pointer-events-none`** **`absolute inset-0`** **hairline ring** or **inset border** at **low opacity** (token-driven “lens edge,” not mandatory black/`30` from demo).
- **Content column** (no nav): **`relative z-10`**, **`max-w-7xl` mx-auto**, responsive **top padding** so copy clears any **global** fixed header the shell provides—**do not** embed that header here.
- **Announcement / eyebrow**: **horizontal frosted pill**—**backdrop-blur**, **translucent surface + ring**; left **compact badge** (e.g. “New,” “Beta”) + **short headline** (single line preferred on mobile).
- **Display headline**: **large serif** (project display serif), **light-on-dark**, **tight tracking**; optional **responsive line break** (`<br>` **hidden** until `sm`+) between two phrases.
- **Lead paragraph**: **narrower** than full column (`max-w-2xl`), **high contrast** muted foreground token on photo.
- **CTAs**: **primary** = frosted **pill** (fill + ring + hover lift/brighten); **secondary** = **ghost** text link with **small icon** (e.g. play metaphor for “watch”).
- **Partner strip**: **muted caption** + **responsive grid** of **logo marks** (**mark + optional link**); each mark uses **`<img>` / `next/image`** or **inline SVG** from **props**—**avoid** mandatory **`bg-[url(...)]`** on empty anchors for production (poor **a11y** / no **alt**).

## Visual Language

- **Palette roles** (map to tokens—**do not** freeze demo white opacities as the only spec):
  - **Photographic ground**: full-bleed still; optional **token scrim** (radial or linear gradient) **between photo and type** if brief needs extra legibility—**opacity from theme**, not pasted `white/80` literals as mandatory.
  - **Glass surfaces**: **translucent white-on-dark** pattern for eyebrow and primary CTA; **hairline borders** at very low alpha.
  - **Badge chip** inside eyebrow: **inverted** treatment (light surface, dark text) for contrast.
  - **Typography**: **serif display** for hero lines; **sans** for UI chrome, eyebrow, buttons—match **project font tokens** (`font-serif` / `font-sans` mappings).
- **Texture**: **luxury briefing / launch announcement**—calm, spacious, not playful scatter.

## Structure Requirements

- **No site navigation** inside `<section>`: **no** `<nav>`, **no** logo row, **no** hamburger—those belong to **`layout`** or a **dedicated header component** above this hero.
- **Layer order (bottom → top)**:
  1. **Photo** `absolute inset-0 z-0`.
  2. **Optional legibility scrim** `absolute inset-0 z-[1] pointer-events-none` (if brief requires).
  3. **Edge ring** `absolute inset-0 z-[1] pointer-events-none`.
  4. **Content wrapper** `relative z-10` with centered blocks.

## Motion Direction

- **Entrance**: **`fadeSlideIn`**-style—opacity **0→1** + small **translateY**; **stagger** eyebrow → headline → body → CTAs → partner block (**~0.1s–0.4s** reference offsets).
- **Scroll gating** (optional but matches reference `animate-on-scroll`): apply stagger **when the block enters viewport** (**`IntersectionObserver`** with **`once: true`** or equivalent); **if unobserve is not used**, still **clean up** observer on unmount.
- **`prefers-reduced-motion: reduce`**: **skip** translate animation; **allow instant opacity** or **no animation** entirely.
- **Hover**: CTA **background/ring** brightens slightly; **no** aggressive motion.

## CSS / DOM

- Define **`@keyframes fadeSlideIn`** in **global CSS** or **Tailwind theme**—**no** `<style jsx>`.
- **Glass**: `backdrop-blur` + translucent **bg** + **ring**; verify **contrast** on badge and eyebrow text over busy photos.

## Required Implementation Blueprint (Do Not Skip)

When this skill is selected, the generated hero MUST include all of the following:

1. **Full-bleed section** with **`min-h-screen`**, **`relative`**, **`isolate`**, **`overflow-hidden`**, spanning **intended viewport width** (use project **breakout** pattern if parent layout is narrow).
2. **Background image layer** **`absolute inset-0`** with **`object-cover`**; **`alt`** and **`src`** from **brief** (no required hard-coded CDN URLs).
3. **Non-interactive overlay**: **inset hairline** (ring or border) **`pointer-events-none`**—color/opacity from **tokens**.
4. **Zero navigation chrome** inside the section (**no** header/nav/menu from the reference snippet).
5. **Centered content stack** with **`max-w-7xl`** (or equivalent) and **responsive vertical padding** so typography is not flush to viewport top.
6. **Glass announcement bar**: **rounded-full**, **horizontal flex**, **inner badge** + **label text**; **backdrop-blur** and **ring**; badge **high-contrast** vs bar.
7. **Serif display headline** (two-part copy allowed) with **responsive `<br>`** pattern: second line **hidden** on very small screens if copy is long—**brief-driven** line breaks.
8. **Centered lead paragraph** with **bounded line length** (`max-w-2xl`).
9. **Two CTAs**: **primary** glass pill + icon; **secondary** text/ghost + icon (**`lucide-react`** or project icon set)—**no** Iconify, **no** CDN icon scripts.
10. **Partner section**: **caption line** + **logo grid** (`grid-cols-2` → **`sm:3` / `md:5`** pattern as reference); **each logo** is an **accessible** **`img`/Image** or **decorative pattern** with **`aria-hidden`** only if truly decorative—prefer **partner name in `alt`**.
11. **Staggered reveal**: **either** CSS animation delays on mount **or** **scroll-triggered** class toggles; **must** respect **`prefers-reduced-motion`**.
12. **Client hookup** (if using IO): **`use client`** on the wrapper that observes; **disconnect/unobserve** on **unmount**.
13. **Hygiene**: **no** `cdn.tailwindcss.com`, **no** `data-element-locator` attributes, **no** inline `<script>` tags.

If any item above is missing, the output is **NOT** valid for `cinematic-photo-glass-hero`.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { ArrowRight, Play } from "lucide-react"

type Partner = { name: string; src: string; href?: string }

type CinematicPhotoGlassHeroProps = {
  background: { src: string; alt: string; width: number; height: number }
  announcement: { badge: string; label: string }
  headline: React.ReactNode
  lead: string
  primaryCta: { label: string; href: string }
  secondaryCta: { label: string; href: string }
  partners: { caption: string; logos: readonly Partner[] }
}

export function CinematicPhotoGlassHero(props: CinematicPhotoGlassHeroProps) {
  const {
    background,
    announcement,
    headline,
    lead,
    primaryCta,
    secondaryCta,
    partners,
  } = props
  const rootRef = useRef<HTMLElement | null>(null)
  const [motionOk, setMotionOk] = useState(true)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setMotionOk(!mq.matches)
    sync()
    mq.addEventListener?.("change", sync)
    return () => mq.removeEventListener?.("change", sync)
  }, [])

  useEffect(() => {
    const el = rootRef.current
    if (!el || !motionOk) {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [motionOk])

  const fade = (delayMs: number) =>
    !visible
      ? { opacity: 0, transform: "translateY(12px)" }
      : motionOk
        ? { animation: `fadeSlideIn 1s ease-out ${delayMs}ms both` }
        : { opacity: 1 }

  return (
    <section
      ref={rootRef}
      className="relative isolate min-h-screen w-full overflow-hidden"
    >
      <Image
        src={background.src}
        alt={background.alt}
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 ring-1 ring-[color:var(--hero-frame,hsl(0_0%_0%/0.3))]"
      />

      <div className="relative z-10">
        <div className="mx-auto max-w-7xl px-6 pb-16 pt-28 sm:pt-28 md:pt-32 lg:pt-40">
          <div className="mx-auto max-w-3xl text-center">
            <div
              className="mb-6 inline-flex items-center gap-3 rounded-full bg-white/10 px-2.5 py-2 font-sans ring-1 ring-white/15 backdrop-blur-md"
              style={fade(100)}
            >
              <span className="rounded-full bg-[color:var(--badge-bg)] px-2 py-0.5 text-xs font-medium text-[color:var(--badge-fg)]">
                {announcement.badge}
              </span>
              <span className="text-sm font-medium text-white/90">
                {announcement.label}
              </span>
            </div>

            <h1
              className="font-serif text-4xl font-normal tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl"
              style={fade(200)}
            >
              {headline}
            </h1>

            <p
              className="mx-auto mt-6 max-w-2xl text-base text-white/80 sm:text-lg"
              style={fade(300)}
            >
              {lead}
            </p>

            <div
              className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
              style={fade(400)}
            >
              <a
                href={primaryCta.href}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 font-sans text-sm font-medium text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                {primaryCta.label}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <a
                href={secondaryCta.href}
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 font-sans text-sm font-medium text-white/90 hover:text-white"
              >
                {secondaryCta.label}
                <Play className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </div>

          <div className="mx-auto mt-20 max-w-5xl">
            <p
              className="text-center text-sm text-white/70"
              style={fade(100)}
            >
              {partners.caption}
            </p>
            <div
              className="mt-6 grid grid-cols-2 items-center justify-items-center gap-6 sm:grid-cols-3 md:grid-cols-5"
              style={fade(200)}
            >
              {partners.logos.map((p) => {
                const img = (
                  <Image
                    src={p.src}
                    alt={p.name}
                    width={240}
                    height={72}
                    className="h-9 w-auto opacity-80 brightness-0 invert"
                  />
                )
                return p.href ? (
                  <a key={p.name} href={p.href} className="block">
                    {img}
                  </a>
                ) : (
                  <div key={p.name}>{img}</div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
```

**Headline example** (pass as `headline` prop):

```tsx
<>
  Journey Beyond Earth
  <br className="hidden sm:block" /> Into the Cosmos
</>
```

Add **`fadeSlideIn`** keyframes in global CSS as in other hero skills (`portfolio-tilt-card-rail-hero`).

**Note:** Logo treatment (`brightness-0 invert`) is **one monochrome-on-dark approach**—swap for **token-compliant** monochrome assets per brand guidelines.

## Layout Details

- **Vertical spacing**: reference uses **`mt-20`** before partner block; tune to **spacing scale**.
- **Partner grid**: keep **consistent hit areas**; center grid when fewer than five partners on small screens.

## Content Rules

- **Announcement**: one **factual hook** (launch window, milestone)—avoid long sentences in the pill.
- **Headline**: **two** short clauses or **three** words per line; **cosmos / exploration / frontier** tone fits routing keywords but **replace** with brief industry.
- **CTAs**: **verb-first** primary; secondary can be **media** (“Watch,” “Tour”).

## Implementation Constraints

- **`use client`** only if **IntersectionObserver** or **motion query** lives in this file; otherwise split **server** shell + **tiny client** reveal wrapper.
- **Images**: prefer **`next/image`** with **`sizes="100vw"`** for background; **priority** only for LCP hero.
- **No** `<style jsx>`, **no** Tailwind CDN.

## Accessibility + Performance

- **Contrast**: verify **white/80** body over **photo**; add **scrim** if product palette fails WCAG.
- **Motion**: **no** **infinite** animations; **one-shot** entrance only.
- **Performance**: **single** large LCP image—**compress** and **avoid** loading **five** huge logo bitmaps; use **SVG** or **small PNG** where possible.
