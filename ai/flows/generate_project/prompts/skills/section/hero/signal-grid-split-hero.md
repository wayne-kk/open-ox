# Component Skill: Hero — Signal Grid Split Panel

Use this skill when `generateSection` needs a **high-contrast, technical-documentary landing hero**: a **two-column split** (stacked on small viewports) with **mono telemetry**, **rail guides**, **layered atmospheric grid**, **stacked display typography** with interaction, and a **photo-forward right panel** read as an instrument frame (corners, reticle, captions). Pure **CSS/Tailwind + static image**—no WebGL.

Route away from `**editorial-blinds-hero`**: this layout is **grid/HUD/chrome + dashed container rails**, not **horizontal blinds / parallax slit** treatment.

## Core Effect

- **Global depth layers (fixed/full-viewport décor only)**: optional **vertical rail lines** at content max-width; **“atmosphere”** stack = center radial falloff + subtle light top-to-bottom wash + **large-pitch line grid** (all low contrast, `pointer-events-none`).
- **Hero shell**: centered max-width frame, `**min-h-screen`**, vertical **dashed** rules on left/right tying into a **technical dossier** reading.
- **Left column**: top **status block** (mono, condensed: recording/system state, location label, live clock line); dominant **three-line headline** (two stacked primary lines + one **accent “signal” chip** line with mono + slight rotation); **glass-ish description card** with **accent-spine** metaphor (thin vertical spine that expands on hover) and hidden **signal acquired** caption that fades in; **primary + ghost** CTAs.
- **Right column**: edge-to-edge **documentary photograph** (`object-cover`) with restrained **chromatic treatment** (desaturate + contrast/brightness—not fixed demo values); **gradient legibility** scrim; **fine grid** via low-opacity overlay blend; **inner instrument frame** (corner fiducials, centered **crosshair circle** that subtly scales on panel hover, bottom-right caption block with frame ID / place / year pattern).

## Visual Language

- **Palette roles** (map to brief tokens—**do not** freeze demo acid-lime / charcoal hex):
  - **Void ground**: near-black base.
  - **Signal accent**: sharp, **high-chroma** highlight for labels, chip border, corner dots, CTA hover state (chartreuse family in reference only).
  - **Raw paper / ink inverse**: light neutral for solid primary button fill; dark text on that fill.
  - **Grid / hairlines**: muted neutral at **very low** opacity for rails, dashed borders, reticle lines.
- **Typography**: **display sans** for stacked lines; **mono** for telemetry, chip line, annotations, CTAs (or project equivalents).
- **Texture**: everything reads **scanned technical document** + **field monitor**—crisp, not soft consumer marketing.

## Structure Requirements

- **No site navigation** — no `<nav>`, logo row, or global header links inside this section. Fixed rail décor is allowed; it is **not** interactive chrome.
- **Layer order (bottom → top)**:
  1. `body`-level equivalent: default page background token.
  2. **Rail guides** (`fixed`, `pointer-events-none`, very low opacity).
  3. **Atmosphere** overlay (`fixed` or `absolute` covering viewport, `pointer-events-none`).
  4. **Hero `<header>` or `<section>`** (`relative`, z above décor): internal **two-column grid** for `lg+`, single column on small screens (image block height ~`60vh` on mobile before scroll, full height in right column on large).
- **Left column**: padding per breakpoint; `backdrop-blur` light on content column if project allows.
- **Right column**: `overflow-hidden` on panel; image absolutely filled; decorative frame `absolute inset-*` with `pointer-events-none` except if product needs interactions (default **none**).

## Motion Direction

- **Headline lines**: on hover, **translate-x** nudge + **fill ↔ stroked/outline** inversion (implementation via `color` / `text-shadow` / `-webkit-text-stroke` utilities acceptable—must use **token colors**).
- **Accent chip line**: hover brightens/flips bg/text roles toward **accent-on-ink**.
- **Description card spine**: thin **vertical accent bar** expands into a **top-left rectangular wipe** filling the card background region (reference: height full → height hairline while width grows); paired **fade/slide** for ancillary caption.
- **Image panel**: slow **scale + drift** (`scale`, `translate`) on group-hover; **must** neutralize under `motion-reduce:transform-none`.
- **Status label**: subtle **opacity flicker** on “recording” motif—**disable entirely** when `prefers-reduced-motion: reduce` (hold steady opacity).

## CSS / DOM Atmosphere Stack

Implement the atmospheric background as **composed gradients** (no bitmap required):

1. **Radial vignette** elliptical toward center-transparent, edges slightly darkened (**alpha** driven by tokens).
2. **Vertical wash**: hairline luminance gradient top → slightly darker bottom.
3. **Repeating linear gradients**: horizontal and vertical **1px** lines at a **large** step (~`120px` reference scale—tune to viewport so it does not moiré on export).

Use **CSS variables** or Tailwind arbitrary values **tied to theme**, not pasted reference `rgba` literals as mandatory.

## Required Implementation Blueprint (Do Not Skip)

When this skill is selected, the generated hero MUST include all of the following:

1. **Split composition**: at `lg` breakpoint and above, a **two-column** layout; below `lg`, **single column** with **image panel** given a **bounded height** (reference **~60vh**) so copy remains reachable without excessive dead space.
2. **Outer dossier frame**: content **max-width** (~`1600px `reference) with **left/right vertical borders** using **dashed** hairlines at **low** opacity; hero region **`min-h-screen`**.
3. **Rail guides**: `fixed` **four** vertical hairlines distributed across max-width (some **hidden** until `md`/`lg` per reference) — all `**pointer-events-none`**.
4. **Atmosphere layer** covering the viewport: **radial vignette + vertical wash + cross-hatch line grid** (three logical layers minimum), non-interactive.
5. **Left column telemetry**: **mono** block with **at least** system state line, location line, and a **live updating clock** (`HH:MM:SS` 24h style); updates via `setInterval` or equivalent with **cleanup on unmount** in React.
6. **Stacked headline system**: **three** distinct lines—two **display** lines + one **smaller mono “signal label”** line with **subtle negative rotate**, **inline padding**, **hairline border**, and **muted panel** behind (token-driven).
7. **Interactive outline hover** on the two display lines: hover applies **horizontal offset** and swaps from **solid fill** to **stroked / outlined** treatment readable at large sizes (no illegible hairline at mobile—reduce stroke or skip on `sm` if needed, but **must** keep hover affordance).
8. **Description card** with **group hover** choreography: **accent spine** animation (bar grows / reveals), **primary blurb** + short **mono preface** (`//` style allowed as tone), and a **secondary caption** that is **hidden by default** and **appears** on hover (opacity + translate).
9. **Two CTAs**: **solid** primary (light fill / dark text pattern) and **text** secondary with **underline-on-hover**; each includes a **small arrow icon** from the **project icon system** (e.g. `lucide-react`) — **no** Iconify, **no** CDN icon scripts.
10. **Right panel image treatment**: `object-cover` **full panel**; **desaturation + contrast/brightness** filters **as roles** (“push documentary gray, lift structure”) rather than mandatory numeric class from demo; **legibility gradient** from bottom; **grid overlay** at very low opacity with **blend mode** (reference: overlay-style).
11. **Instrument frame overlay**: **inner inset border**; **four** corner fiducials (two accent, two neutral pattern); centered **circle reticle** with **cross hairs**; **footer caption** block with bracketed frame id + location + date pattern (**content from brief**, not canned NYC unless brief says so).
12. **Reduced motion**: respect `prefers-reduced-motion` — **no** image drift/scale choreography, **no** telemetry flicker; optional static hover states simplified.
13. **Implementation hygiene**: `**use client`** only where clock/hooks demand; **no** `cdn.tailwindcss.com`, **no** `iconify-icon` / Iconify loaders, **no** `<style jsx>`; typography families come from **project theme** (`font-sans` / `font-mono` mappings).
14. **Image source**: `**next/image` or `<img>`** with `**alt` text** from brief; remote URL **only** when brief supplies an asset — otherwise use **project placeholder** pattern or deterministic neutral placeholder—not a mandatory hard-coded Supabase link.

If any item above is missing, the output is **NOT** valid for `signal-grid-split-hero`.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { ArrowRight, ArrowUpRight } from "lucide-react"

type SignalGridSplitHeroProps = {
  statusLines: { system: string; location: string }
  headline: [string, string]
  signalLine: string
  monoPreface: string
  description: React.ReactNode
  hoverAside: React.ReactNode
  primaryCta: { label: string; href: string }
  secondaryCta: { label: string; href: string }
  panelCaption: React.ReactNode
  image: { src: string; alt: string; width: number; height: number }
}

export function SignalGridSplitHero(props: SignalGridSplitHeroProps) {
  const [clock, setClock] = useState("")
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduceMotion(mq.matches)
    sync()
    mq.addEventListener?.("change", sync)
    return () => mq.removeEventListener?.("change", sync)
  }, [])

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en-US", { hour12: false }))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 mx-auto flex max-w-[1600px] justify-between px-6 opacity-20 md:px-12"
      >
        <div className="h-full w-px bg-[color:var(--hairline)]" />
        <div className="hidden h-full w-px bg-[color:var(--hairline)] md:block" />
        <div className="hidden h-full w-px bg-[color:var(--hairline)] lg:block" />
        <div className="h-full w-px bg-[color:var(--hairline)]" />
      </div>

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[5] bg-[radial-gradient(ellipse_at_center,transparent_42%,rgb(0_0_0/0.33)_100%),linear-gradient(to_bottom,rgb(255_255_255/0.02),rgb(0_0_0/0.08)),repeating-linear-gradient(to_right,rgb(255_255_255/0.03)_0_1px,transparent_1px_120px),repeating-linear-gradient(to_bottom,rgb(255_255_255/0.025)_0_1px,transparent_1px_120px)]"
      />

      <header className="relative z-10 mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 border-x border-dashed border-foreground/5 lg:grid-cols-2">
        <div className="relative z-20 flex flex-col justify-center border-b border-dashed border-foreground/5 px-6 py-20 backdrop-blur-sm md:px-12 lg:border-b-0 lg:border-r lg:border-foreground/5 lg:py-0">
          <div
            className={`pointer-events-none absolute left-6 top-6 font-mono text-[10px] text-primary md:left-12 ${
              reduceMotion ? "opacity-100" : "animate-pulse"
            }`}
          >
            {props.statusLines.system}
            <br />
            {props.statusLines.location}
            <br />
            <span className="tabular-nums">{clock}</span>
          </div>

          <div className="relative z-10 mt-24 max-w-xl lg:mt-0">
            <h1 className="mb-12 text-6xl font-bold uppercase leading-[0.85] tracking-tighter md:text-7xl lg:text-8xl">
              {[props.headline[0], props.headline[1]].map((line, i) => (
                <span
                  key={line}
                  className={[
                    "block w-max cursor-default text-foreground transition-all duration-300",
                    "hover:translate-x-4",
                    "[text-shadow:none] hover:text-transparent hover:[-webkit-text-stroke:1px_var(--stroke)]",
                    i === 1 ? "delay-75" : "",
                  ].join(" ")}
                >
                  {line}
                </span>
              ))}
              <span className="mt-4 block w-max -rotate-1 border border-primary/20 bg-muted/30 px-4 font-mono text-4xl font-normal tracking-tight text-primary transition-all duration-300 hover:translate-x-4 hover:bg-primary hover:text-primary-foreground md:text-6xl lg:text-7xl">
                {props.signalLine}
              </span>
            </h1>

            <div className="group relative mb-10 overflow-hidden rounded-r-sm bg-foreground/5 py-6 pl-6 pr-6 backdrop-blur-md">
              <div className="absolute left-0 top-0 h-full w-[2px] origin-top-left bg-primary transition-all duration-300 ease-out group-hover:h-[2px] group-hover:w-full" />
              <div className="pointer-events-none absolute right-4 top-4 translate-y-2 text-right opacity-0 transition-all delay-75 duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <div className="font-mono text-[10px] uppercase leading-relaxed tracking-widest text-muted-foreground">
                  {props.hoverAside}
                </div>
              </div>
              <div className="relative z-10">
                <p className="mb-4 font-mono text-xs uppercase leading-relaxed text-muted-foreground transition-colors duration-300 group-hover:text-muted-foreground/90 md:text-sm">
                  {props.monoPreface}
                </p>
                <div className="text-lg leading-tight text-muted-foreground transition-colors duration-300 group-hover:text-muted-foreground/80">
                  {props.description}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
              <a
                href={props.primaryCta.href}
                className="group inline-flex items-center gap-4 bg-foreground px-8 py-4 font-mono text-sm font-bold uppercase tracking-widest text-background transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                {props.primaryCta.label}
                <ArrowRight className="transition-transform group-hover:translate-x-1" size={18} aria-hidden />
              </a>
              <a
                href={props.secondaryCta.href}
                className="group inline-flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-primary"
              >
                <span className="border-b border-transparent transition-all group-hover:border-primary">
                  {props.secondaryCta.label}
                </span>
                <ArrowUpRight className="opacity-50 transition-opacity group-hover:opacity-100" size={14} aria-hidden />
              </a>
            </div>
          </div>
        </div>

        <div className="group/panel relative h-[60vh] overflow-hidden border-b border-dashed border-foreground/5 lg:h-auto lg:border-none">
          <Image
            src={props.image.src}
            alt={props.image.alt}
            width={props.image.width}
            height={props.image.height}
            className={[
              "absolute inset-0 h-full w-full object-cover grayscale contrast-125 brightness-[0.65] saturate-0 transition-transform duration-1000 ease-out",
              reduceMotion ? "" : "lg:group-hover/panel:scale-105 lg:group-hover/panel:translate-x-2 lg:group-hover/panel:-translate-y-2",
            ].join(" ")}
            priority
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-[color:var(--hairline)] opacity-10 mix-blend-overlay" />

          <div className="pointer-events-none absolute inset-4 flex flex-col justify-between border border-foreground/10 p-4">
            <div className="flex items-start justify-between">
              <div className="box-content h-2 w-2 border border-background bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.35)]" />
              <div className="box-content h-2 w-2 border border-primary" />
            </div>
            <div
              className={[
                "absolute left-1/2 top-1/2 flex aspect-square w-[40%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-foreground/5 opacity-30 transition-transform duration-700",
                reduceMotion ? "" : "lg:group-hover/panel:scale-95",
              ].join(" ")}
            >
              <div className="h-full w-px bg-foreground/10" />
              <div className="absolute h-px w-full bg-foreground/10" />
            </div>
            <div className="flex items-end justify-between">
              <div className="bg-background/50 px-2 font-mono text-[9px] tracking-widest text-primary/80 backdrop-blur-sm">
                {props.panelCaption}
              </div>
              <div className="box-content h-2 w-2 border border-background bg-foreground" />
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
```

## Layout Details

- Keep **telemetry** readable: avoid overlap with headline—use `**mt`** offset on small breakpoints (see skeleton).
- **Line lengths**: description `max-width` aligns with dossier rhythm; photograph carries **visual weight** on `**lg`** right rail.

## Content Rules

- Telemetry copy should reflect **truthful** operational state — avoid counterfeit security/legal claims.
- Headline stacking suits **three-beat poetic** phrases; mono line is the **equipment readout**.
- Caption block: `{frame-id} / {place} / {year}` pattern from editorial brief.

## Implementation Constraints

- **No CDN Tailwind**.
- **No Iconify / `iconify-icon`**.
- Compose styles with **project Tailwind** + minimal global utilities if `-webkit-text-stroke` is reused site-wide.

## Accessibility + Performance

- Decorative layers: `**aria-hidden`** where appropriate.
- Clock updates **once per second** — clear interval on unmount.
- Image: `**priority`** only when this hero is truly LCP-critical; otherwise project defaults.
- **Vestibular / motion**: disable pulse/flicker and panel transforms under reduced motion.

