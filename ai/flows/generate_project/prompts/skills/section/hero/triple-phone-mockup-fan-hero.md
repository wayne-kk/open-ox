# Component Skill: Hero — Split Metrics + Triple Fanned Phone Mockups

Mobile product hero: **left** status chip, split headline, body, metric chips, CTAs, avatar stack; **right** three fanned phone frames (~**−8° / 0° / +8°**) with notch, dark chrome, three distinct in-screen UIs (card, map/route, live tracker). **CSS/DOM + inline SVG**—no WebGL or embed runtime.

Not **`bento-split-marquee-gallery-hero`**, **`unicorn-studio-embed-hero-bg`**, or **`signal-grid-split-hero`**—consumer device showcase, not bento/gallery or HUD.

## Core Effect

- **Atmosphere**: **three** large **soft accent orbs** (`blur-3xl` class family) **`absolute`**, **`pointer-events-none`**, **low/medium opacity**—**hues map to brief** (**lime-chartreuse + soft gold** in reference = **primary + highlight accent tokens**, not frozen Tailwind hex).
- **Shell**: **`relative`** section, **`overflow-hidden`**, **top padding** for breathing room below global header (**`pt-16`→`pt-20`** reference; tune if shell has no header).
- **Grid**: **`max-w-7xl`** container, **`lg:grid-cols-2`**, **`gap-16`**, items **vertically centered**.
- **Left block**:
  - **Status row**: pill with **border + frosted bg**, **leading pulse dot** (accent), **short status string** (e.g. conditions / system state).
  - **Headline**: **large** display (**two-part**: primary emphasis + **muted** secondary span); **project display font** (reference **Bricolage** → map to **`font-bricolage`** or brief).
  - **Body**: **muted** foreground, **max-width** for line length.
  - **Metric tags**: **2×2 / wrap** **rounded** panels, **label** (muted) + **value** per chip.
  - **CTAs**: **solid** primary (accent fill, dark text pattern) + **ghost** secondary with **leading icon** (e.g. **map** metaphor).
  - **Proof row**: **4** overlapping **avatars** (`ring` separates stacks) + **overflow count** chip + **one-line** social proof.
- **Right block**:
  - **Stage** **`relative`**, **`max-w-xl`** centered on mobile, **`lg:ml-auto`**, **fixed min-height** (**~560–600px**) to **lock** composition.
  - **Three phones** **`absolute`** within stage: **left** phone **rotated negative**, **center** **upright** (slightly raised), **right** **rotated positive**; **z-index** orders **center** above **sides** (typical: sides **lower**, center **highest`).
  - **Device chrome**: **`~rounded-[2.2rem]`**, **`ring`**, **strong shadow**, **dark** **panel** bg; **pill notch** top center; **home indicator** bar bottom.
  - **Screen 1** (example): **header** icon buttons, **title + subtitle**, **hero image card** with **gradient scrim**, **difficulty chip**, **footer meta** + **stat grid** + **schedule** row.
  - **Screen 2**: **map panel** with **SVG** grid pattern, **curved route path**, **start/end** markers—**stroke/fill** from **CSS variables** (no mandatory **`#d9ff3f`**); **floating** **chips** (location, distance, offline, GPS); **trail stats** card; **primary CTA** button.
  - **Screen 3**: **live** **hero photo**, **`Live`** **pulse** badge, **metrics** **glass** card (pace, time, distance), **progress** bar, **Pause / End** **actions** (semantic **destructive** on end).

## Visual Language

- **Roles**: **void / ink** page background; **elevated** **phone** **neutral-900** family; **primary accent** for **CTAs**, **route**, **progress**; **destructive** token for **live danger** / **end** (reference red)—**derive** from **design system**.
- **Typography**: **rounded display** for **headlines** and **large stats**; **UI** sizes for **chips** and **buttons**.
- **Texture**: **optimistic**, **trail-ready**, **clean** **iOS-style** **mock depth**—not **brutalist**.

## Structure Requirements

- **No site `<nav>`** or **app** **top** **chrome** in-section (**hero-only** rule).
- **Decorative glows** stay **`pointer-events-none`**.

## Motion Direction

- **Optional**: **subtle** **`translateY`** / **mouse** **parallax** on **`#phones`** wrapper—**throttled** **rAF** or **CSS** **`transition`**; **disable** under **`prefers-reduced-motion: reduce`**.
- **Micro**: **CTA** **`active:translate-y-[1px]`**; **icon** **nudge** on **hover** (primary link).

## Implementation Notes (SVG / A11y)

- **Unique `id`s** for **SVG** **`<pattern>`** / **gradients** when **multiple** phones render—prefix with **`useId()`** in React to avoid **collisions**.
- **Images** inside phones: **`next/image`** or **`<img>`** with **meaningful** **`alt`** (trail name, map screen, live view) **or** **`alt=""`** **only** if **decorative** **and** **redundant** with **visible** **text**—prefer **non-empty** **for** **marketing** **screens**.

## Required Implementation Blueprint (Do Not Skip)

When this skill is selected, the generated hero MUST include all of the following:

1. **`relative`** **section**, **`overflow-x-hidden`**, **responsive** **vertical** **padding** and **`max-w-7xl`** **content** **width**.
2. **At least three** **`absolute`** **glow** **ellipses** **full** **blur**, **non-interactive**, **token**-tinted (**no** **single** **mandatory** **lime** **hex**).
3. **`lg` two-column** **grid** with **~equal** **visual** **weight**; **single** **column** **on** **small** **viewports** **(order**: **copy** **first** **or** **match** **brief**).
4. **Status** **pill** **with** **dot** + **single** **status** **line**.
5. **Split** **headline** **(two** **spans** **or** **lines)** **+** **body** **paragraph** **with** **bounded** **width**.
6. **≥3** **metric** **chips** **(reference** **four)** in **wrap** **row**, **each** **with** **label** **+** **value**.
7. **Two** **CTAs**—**primary** **filled** **accent**, **secondary** **ghost** **with** **icon** **from** **`lucide-react`** (**no** **Iconify**).
8. **Avatar** **stack** **+** **overflow** **count** **+** **trust** **caption** **line**.
9. **Right** **stage** with **explicit** **`min-h`** **(reference** **560–600px)**.
10. **Three** **phone** **frames**, **distinct** **`rotate`** **and** **offsets**, **`z-index`** **layers** **center-forward**.
11. **Each** **phone** includes **notch**, **ring**, **shadow**, **scrollable-looking** **content** **regions** **(overflow** **`hidden`** **on** **shell)**.
12. **Three** **different** **screen** **stories**: **(A)** **media** **card** **+** **stats**, **(B)** **vector** **route** **map** **+** **chips** **+** **stats** **panel**, **(C)** **live** **session** **UI** **with** **progress** **+** **controls**.
13. **Route** **SVG** **uses** **theme** **`currentColor` / CSS vars** for **path** **stroke** **and** **markers**—**not** **hard-coded** **demo** **neons** **as** **only** **option**.
14. **`prefers-reduced-motion`** **gates** **any** **parallax** **or** **phone** **drift**.
15. **No** **`data-element-locator`**, **no** **CDN** **Tailwind** **script**, **no** **`<style jsx>`**.

If any item above is missing, the output is **NOT** valid for `triple-phone-mockup-fan-hero`.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client"

import Image from "next/image"
import { ArrowRight, Map } from "lucide-react"

type Metric = { label: string; value: string }

type TriplePhoneMockupFanHeroProps = {
  status: { dot?: boolean; text: string }
  title: { primary: string; secondary: string }
  lead: string
  metrics: readonly Metric[]
  primaryCta: { label: string; href: string }
  secondaryCta: { label: string; href: string }
  socialProof: { avatars: readonly { src: string; alt: string }[]; overflow: string; caption: string }
  phones: {
    trailCard: { image: { src: string; alt: string }; trailName: string; chips: Metric[] }
    map: { title: string; routeStroke: string }
    live: { image: { src: string; alt: string }; trailTitle: string }
  }
}

export function TriplePhoneMockupFanHero(props: TriplePhoneMockupFanHeroProps) {
  return (
    <section className="relative w-full overflow-hidden pt-16">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[color:var(--hero-glow)]/20 blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-[color:var(--hero-glow-warm)]/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-[color:var(--hero-glow)]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 lg:pb-32 lg:pt-28">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[color:var(--muted-foreground)]">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[color:var(--primary)]" />
              {props.status.text}
            </div>
            <h1 className="font-bricolage text-5xl font-medium tracking-tight leading-[1.05] sm:text-6xl">
              {props.title.primary}{" "}
              <span className="font-medium tracking-tight text-[color:var(--muted-foreground)]">
                {props.title.secondary}
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-[color:var(--muted-foreground)]">{props.lead}</p>

            <div className="mt-7 flex flex-wrap gap-3">
              {props.metrics.map((m) => (
                <div
                  key={m.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-200"
                >
                  <span className="text-[color:var(--muted-foreground)]">{m.label}:</span> {m.value}
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={props.primaryCta.href}
                className="group inline-flex items-center gap-2 rounded-full bg-[color:var(--primary)] px-5 py-3 font-medium text-neutral-950 transition hover:brightness-95 active:translate-y-px"
              >
                {props.primaryCta.label}
                <ArrowRight className="h-4 w-4 -translate-x-0.5 transition group-hover:translate-x-0.5" />
              </a>
              <a
                href={props.secondaryCta.href}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-white/90 transition hover:bg-white/[0.08] active:translate-y-px"
              >
                <Map className="h-4 w-4 text-white/80" />
                {props.secondaryCta.label}
              </a>
            </div>

            <div className="mt-7 flex items-center gap-4">
              <div className="flex -space-x-2">
                {props.socialProof.avatars.map((a) => (
                  <Image
                    key={a.src}
                    src={a.src}
                    alt={a.alt}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full object-cover ring-2 ring-neutral-950"
                  />
                ))}
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[11px] text-neutral-300 ring-2 ring-neutral-950">
                  {props.socialProof.overflow}
                </div>
              </div>
              <p className="text-sm text-[color:var(--muted-foreground)]">{props.socialProof.caption}</p>
            </div>
          </div>

            <div className="relative mx-auto w-full max-w-xl lg:ml-auto">
              <div className="relative h-[560px] sm:h-[600px]">
                {/* TODO: three PhoneShell components — left rotate-[-8deg], center upright (higher z), right rotate-[8deg].
                    Use props.phones + unique SVG pattern ids via useId(). See blueprint items 9–12. */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Example: map panel only — prefix pattern id with useId() when embedding multiple SVGs. */
function RouteMapPanel({ patternId, routeStroke }: { patternId: string; routeStroke: string }) {
  return (
    <svg viewBox="0 0 400 300" className="h-[240px] w-full text-neutral-700/40" aria-hidden>
      <defs>
        <pattern id={patternId} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      <path
        d="M30,250 C80,180 120,220 160,180 C200,140 260,160 300,120 C330,95 360,110 370,90"
        fill="none"
        stroke={routeStroke}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="30" cy="250" r="8" fill="var(--route-start, var(--primary))" />
      <circle cx="370" cy="90" r="8" fill="var(--route-end, var(--accent-warm))" />
    </svg>
  )
}
```

**Implementers:** Replace the **placeholder** **`SvgMapPreview`** **placement** with **three** **`PhoneShell`** **components** **(left/center/right)** **matching** **blueprint** **positions**; **pass** **content** **from** **`props.phones`**.

## Layout Details

- **Phone** **width** **reference**: **`w-64`/`sm:w-72`**, **height** **`~620px`**—**scale** **down** **on** **short** **viewports** **if** **needed** **(overflow** **`hidden`** **on** **stage)**.
- **Negative** **rotation** **must not** **clip** **against** **section** **edges**—**increase** **stage** **`min-h`** **or** **reduce** **phone** **scale** **on`sm`**.

## Content Rules

- **Replace** **Yosemite**-specific **strings** **with** **brief** **place** **/ product**; **metrics** **mirror** **real** **product** **fields**.
- **Legal**: **use** **licensed** **imagery** **or** **placeholders**—**no** **required** **Supabase** **URLs**.

## Implementation Constraints

- **`use client`** **only** **if** **parallax** **or** **pointer** **hooks** **are** **used**.
- **Icons**: **`lucide-react`** **throughout** **(replace** **inline** **SVG** **from** **demo)**.

## Accessibility + Performance

- **Decorative** **glow** **`aria-hidden`** **(already** **on** **wrapper)**.
- **Many** **images**: **lazy** **offscreen** **phones** **if** **possible**; **LCP** **image** **should** **be** **one** **hero** **asset** **in** **first** **visible** **column** **or** **center** **phone** **only**.
