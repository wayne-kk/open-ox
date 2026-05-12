# Component Skill: Hero — Split Bento + Dropzone + Marquee Gallery

Dark product first screen: **lg** two-pane—**left** stacked bento (copy, compact controls, file dropzone with cursor glow); **right** framed stage with **three** vertical marquee image columns (rAF drift, opposing directions) and edge fades. **DOM + CSS + images**—no WebGL.

Reference had full `<header>`, Iconify, CDN Tailwind—**omit**; use `layout` for nav and **`lucide-react`** (or project icons).

Not **`gradient-frame-shader-hero`** / **`ember-radial-blades-hero`** / **`cinematic-photo-glass-hero`**—this is UI + gallery, not shader or one photo hero.

## Core Effect

- **Root section**: **deep void** background (token), **min-height** full viewport; on **`lg`** use **`h-screen`** + **column flex** with **`overflow-hidden`** so panes **tile** without page scroll (reference: **`lg:h-screen`**, **`lg:overflow-hidden`**); **`overflow-x-hidden`** baseline.
- **Main** (no header): **`flex-1`** **flex column** on small screens → **`lg:flex-row`** with **gap**; **`h-full`** / **`min-h-0`** patterns so children **shrink** correctly in flex.
- **Left pane (~40%)**: **`lg:w-5/12`**, **`w-full`**, **`flex flex-col gap`**, on mobile **bounded heights** (`**~60vh**` reference) so **gallery** remains reachable.
- **Bento 1 — Hero**: **large radius** (`**~2rem**`), **hairline border**, **ultra-subtle** translucent surface; **corner** **decorative blur orb** (`**pointer-events-none`**); **gradient headline** (`**bg-clip-text**`), **light** weight, **tight lead**; supporting **muted** paragraph **`max-w-sm`**.
- **Bento 2 — Configuration**: slightly smaller radius; **horizontal layout** on **`sm+`** (mode + toggle); **mode** row: label + **pill/button** control resembling **dropdown** (implement with **real** **`select`**, **Headless UI**, or **button** + **popover**—not dead iconify); **toggle**: **`aria-pressed`**, **`role="switch"`** or **checkbox** pattern, **keyboard** operable.
- **Bento 3 — Dropzone**: **flex-grow** (`**flex-1**`), **min-height** floor (**~220px** reference), **dashed metaphor optional**—reference uses **solid** border; **`cursor-pointer`**; **hidden** **`input type="file"`** + **`label`** or **button** to open; **mouse-tracking glow**: **absolute** blurred oval **follows** cursor **inside** box (**`pointer-events-none`**); **default** centered; **hover** reveals glow (**opacity** transition); **icon** in **raised** circle with **hover lift**.
- **Right pane (~60%)**: **`lg:w-7/12`**, **`rounded-[2rem]`**, **darker inner** token, **overflow hidden**; **top + bottom** **gradient scrims** (**`pointer-events-none`**, **`z-20`**) for depth; **optional** **corner** **control** (e.g. **expand**) — **icons** from **Lucide**.
- **Gallery scaffold**: **absolute `inset-0`**, **flex** **three** **equal columns** (`**gap**` responsive); on **`lg`**: **slight** **negative rotate** + **`scale-105`** (tunable) for **showcase tilt**; each column **stack** of **images** with **varied** **`aspect-*`**, **rounded**, **muted border**, **default** partial **desaturate + lowered opacity**, **hover** **full color + full opacity**.
- **Marquee motion**: **duplicate** each column’s **children** in DOM ( **two copies** end-to-end ); **`translateY`** animates continuously; **wrap** when **`pos`** crosses **± half** of **duplicated column height**; **column 2** moves **opposite** direction from 1 & 3 (reference speeds **±0.25 / 0.3** px/frame scale—**normalize** to **delta time** in production for **consistent** speed across refresh rates).

## Visual Language

- **Palette roles** (tokens—not **`#030303`/`#050505` as law**):
  - **App void**: near-black **page** bg.
  - **Panel lift**: **subtle** translucent white overlay on cards (`**white/[0.015]**` family).
  - **Hairlines**: **border** **6–10%** **white** alpha range.
  - **Text**: **primary** heading gradient (white → **soft** **muted** **white**); **body** **muted** neutral.
  - **Accent**: **invert** **pill** on dropzone **hover** (dark → **light**) optional per brief.
- **Typography**: **light** / **normal** weights, **tight** tracking on headlines.

## Structure Requirements

- **No** `<header>`, **`<nav>`**, **credits strip**, or **global** **account** **controls** inside this **`<section>`**.
- **Layering (right pane)**: **images** → **gradient masks** (`z-20`) → **floating** **controls** (`z-30`).

## Motion Direction

- **Marquee**: **always-on** **`requestAnimationFrame`** loop **per** section instance (or **single** loop **driving** three values)—**cancelAnimationFrame** on **unmount**; **pause** when **document.hidden** **optional**; under **`prefers-reduced-motion: reduce`**: **static** layout (**no** **translation** loop) or **very slow** per product—**minimum** **no infinite motion**.
- **Dropzone glow**: **pointer** move updates **`left`/`top`** on glow node (**percent** or **px** + **`translate(-50%,-50%)`**).
- **Hover**: **short** **duration** transitions on cards and CTA chip.

## Rendering / Implementation (Marquee)

- After **layout**, **measure** **`scrollHeight / 2`** on each **column inner** wrapper (the **duplicated** stack). **Initialize** **`pos`** per direction (reference: **downward** columns start **`pos = -halfHeight`**).
- **Use **`translate3d(0, pos, 0)`** for **GPU** path.
- **Resize**: **re-measure** on **resize** (**`ResizeObserver`** on column or **`window`**) to avoid **drift** after **font/image** load.

## Required Implementation Blueprint (Do Not Skip)

When this skill is selected, the generated hero MUST include all of the following:

1. **Section shell** with **token** **background**, **selection** styles, **`min-h-screen`**, and **responsive overflow** matching reference intent (**`overflow-x-hidden`**, **`lg` height lock** + **`overflow-hidden`** where appropriate).
2. **No app-wide header/nav** in the section output.
3. **`main`** **split**: **`lg:flex-row`** with **`~5/12`–`~7/12`** width split (or **CSS grid** equivalent); **mobile** **column** order with **height** hints so neither pane is **unusable**.
4. **Three** **left** **bento** blocks with **consistent** **radius / border / surface** language.
5. **Hero bento**: **gradient** **clipped** headline + **blur** **glow** **decoration** + **muted** description.
6. **Controls bento**: **two** **control clusters** (**mode** + **boolean** **toggle**) with **accessible** semantics (**keyboard**, **focus-visible**, **`aria-*`** on switch).
7. **Dropzone bento**: **file** **picker** **wired** (**`input`** + **`accept`** from brief); **mousemove**-tracked **glow** **inside** panel bounds; **hover** **states** on **chip** / **icon**.
8. **Right** **stage**: **rounded** **frame**, **darker** **inner** **surface**, **top/bottom** **fade** **gradients** (**token** **stops**).
9. **Three** **columns**, **each** **`flex-1`**, **image** **stack** with **mixed** **aspect ratios**; **images** from **props/CMS**—**no** required hard-coded **Unsplash** URLs.
10. **Duplicated** **content** per column for **seamless** loop; **`will-change: transform`** on **animated** **wrapper** only if **needed** (**remove** when **reduced** motion **static**).
11. **`requestAnimationFrame` marquee** with **per-column** **signed speed**; **deterministic** **wrap** at **±halfHeight**; **cleanup** **rAF** on **unmount**.
12. **Icons** via **`lucide-react`** (e.g. **Package/Box**, **Bell**, **User**, **ChevronDown**, **CloudUpload**, **Maximize2**)—**no** **`iconify-icon`**.
13. **No** **CDN** **Tailwind** or **Iconify** **scripts**; **no** **inline** **`<script>`** in JSX.

If any item above is missing, the output is **NOT** valid for `bento-split-marquee-gallery-hero`.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { ChevronDown, CloudUpload, Maximize2 } from "lucide-react"

type GalleryImage = { src: string; alt: string; aspect: "square" | "portrait" | "tall" | "standard" }

const aspectClass: Record<GalleryImage["aspect"], string> = {
  square: "aspect-square",
  portrait: "aspect-[4/5]",
  tall: "aspect-[2/3]",
  standard: "aspect-[4/5]",
}

function MarqueeColumn({
  images,
  speed,
  reduceMotion,
}: {
  images: readonly GalleryImage[]
  speed: number
  reduceMotion: boolean
}) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const posRef = useRef(0)
  const rafRef = useRef<number>(0)
  const halfRef = useRef(0)

  const measure = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    halfRef.current = el.scrollHeight / 2
    if (speed > 0) posRef.current = -halfRef.current
    else posRef.current = 0
  }, [speed])

  useEffect(() => {
    measure()
    const ro = new ResizeObserver(() => measure())
    if (trackRef.current) ro.observe(trackRef.current)
    return () => ro.disconnect()
  }, [measure, images])

  useEffect(() => {
    if (reduceMotion) {
      trackRef.current?.style.setProperty("transform", "translate3d(0,0,0)")
      return
    }

    const tick = () => {
      const el = trackRef.current
      const half = halfRef.current
      if (!el || half <= 0) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      let pos = posRef.current + speed
      if (speed < 0) {
        if (pos <= -half) pos = 0
      } else {
        if (pos >= 0) pos = -half
      }
      posRef.current = pos
      el.style.transform = `translate3d(0, ${pos}px, 0)`
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [reduceMotion, speed])

  const doubled = [...images, ...images]

  return (
    <div className="min-w-0 flex-1 overflow-hidden">
      <div ref={trackRef} className="flex flex-col gap-3 will-change-transform lg:gap-4">
        {doubled.map((img, i) => (
          <Image
            key={`${img.src}-${i}`}
            src={img.src}
            alt={img.alt}
            width={400}
            height={500}
            className={`w-full ${aspectClass[img.aspect]} cursor-crosshair rounded-xl border border-white/[0.04] object-cover opacity-70 grayscale-[30%] transition-all duration-500 hover:opacity-100 hover:grayscale-0 lg:rounded-2xl`}
          />
        ))}
      </div>
    </div>
  )
}

type BentoSplitMarqueeGalleryHeroProps = {
  hero: { title: React.ReactNode; description: string }
  modeLabel: string
  highFidelityLabel: string
  dropzone: { title: string; hint: string; cta: string }
  galleryColumns: [readonly GalleryImage[], readonly GalleryImage[], readonly GalleryImage[]]
}

export function BentoSplitMarqueeGalleryHero(props: BentoSplitMarqueeGalleryHeroProps) {
  const { hero, modeLabel, highFidelityLabel, dropzone, galleryColumns } = props
  const [reduceMotion, setReduceMotion] = useState(false)
  const [hiFi, setHiFi] = useState(true)
  const dropRef = useRef<HTMLDivElement | null>(null)
  const glowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduceMotion(mq.matches)
    sync()
    mq.addEventListener?.("change", sync)
    return () => mq.removeEventListener?.("change", sync)
  }, [])

  const onDropMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const g = glowRef.current
    const root = dropRef.current
    if (!g || !root) return
    const r = root.getBoundingClientRect()
    g.style.left = `${e.clientX - r.left}px`
    g.style.top = `${e.clientY - r.top}px`
  }

  return (
    <section
      className="relative flex min-h-screen flex-col overflow-x-hidden bg-[color:var(--background)] font-sans text-white antialiased selection:bg-[color:var(--selection-bg)] selection:text-[color:var(--selection-fg)] lg:h-screen lg:overflow-hidden"
    >
      <main className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row lg:gap-5 lg:p-5">
        <section className="flex h-[60vh] w-full flex-shrink-0 flex-col gap-4 lg:h-full lg:w-5/12 lg:gap-5">
          <div className="relative flex flex-shrink-0 flex-col justify-end overflow-hidden rounded-[2rem] border border-white/[0.06] bg-white/[0.015] p-6 lg:p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 right-0 h-64 w-64 translate-x-1/3 -translate-y-1/3 rounded-full bg-white/[0.03] blur-[60px]"
            />
            <h1 className="mb-3 bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-4xl font-light leading-[1.05] tracking-tight text-transparent lg:text-6xl">
              {hero.title}
            </h1>
            <p className="max-w-sm text-sm font-light leading-relaxed text-[color:var(--muted-foreground)]">
              {hero.description}
            </p>
          </div>

          <div className="relative z-20 flex flex-shrink-0 flex-col items-start justify-between gap-4 rounded-[1.5rem] border border-white/[0.06] bg-white/[0.015] p-5 sm:flex-row sm:items-center lg:p-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-light text-[color:var(--muted-foreground)]">Mode:</span>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[color:var(--surface-elevated)] px-3 py-1.5 text-xs font-light text-gray-200 shadow-sm transition-colors hover:bg-white/[0.05]"
              >
                {modeLabel}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-light text-[color:var(--muted-foreground)]">{highFidelityLabel}</span>
              <button
                type="button"
                role="switch"
                aria-checked={hiFi}
                aria-label="Toggle high fidelity export"
                onClick={() => setHiFi((v) => !v)}
                className={`relative flex h-5 w-9 items-center rounded-full p-0.5 shadow-sm transition-colors ${hiFi ? "bg-white text-black" : "bg-white/20 text-white"}`}
              >
                <span
                  className={`h-4 w-4 rounded-full shadow-sm transition-transform ${hiFi ? "translate-x-4 bg-black" : "translate-x-0 bg-white"}`}
                />
              </button>
            </div>
          </div>

          <div
            ref={dropRef}
            role="button"
            tabIndex={0}
            onMouseMove={onDropMove}
            className="group relative flex min-h-[220px] flex-1 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-white/[0.06] bg-white/[0.015] p-6"
          >
            <div
              ref={glowRef}
              aria-hidden
              className="pointer-events-none absolute h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.05] opacity-0 blur-[60px] transition-opacity duration-500 group-hover:opacity-100"
              style={{ left: "50%", top: "50%" }}
            />
            <div className="z-10 mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.08] bg-[color:var(--surface-elevated)] shadow-xl transition-transform duration-500 group-hover:-translate-y-1">
              <CloudUpload className="h-7 w-7 text-white/80" aria-hidden />
            </div>
            <h3 className="z-10 text-sm font-light tracking-tight">{dropzone.title}</h3>
            <p className="z-10 mt-1.5 max-w-[220px] text-center text-xs font-light text-[color:var(--muted-foreground)]">
              {dropzone.hint}
            </p>
            <div className="z-10 mt-6 rounded-full border border-white/[0.08] bg-[color:var(--background)] px-5 py-2 text-xs font-light text-white transition-all duration-300 group-hover:bg-white group-hover:text-black">
              {dropzone.cta}
            </div>
            <input type="file" className="sr-only" aria-label="Upload reference files" multiple />
          </div>
        </section>

        <section className="relative flex h-[50vh] w-full flex-shrink-0 overflow-hidden rounded-[2rem] border border-white/[0.06] bg-[color:var(--gallery-surface)] lg:h-full lg:w-7/12">
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 h-24 bg-gradient-to-b from-[color:var(--gallery-surface)] to-transparent lg:h-32" />
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 h-24 bg-gradient-to-t from-[color:var(--gallery-surface)] to-transparent lg:h-32" />

          <div className="absolute right-5 top-5 z-30 flex items-center gap-2">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-black/50 backdrop-blur-md hover:bg-white/10"
              aria-label="Expand preview"
            >
              <Maximize2 className="h-4 w-4 text-gray-300" />
            </button>
          </div>

          <div className="absolute inset-0 flex scale-105 rotate-0 gap-3 p-3 lg:-rotate-2 lg:gap-4 lg:p-4">
            <MarqueeColumn images={galleryColumns[0]} speed={0.25} reduceMotion={reduceMotion} />
            <MarqueeColumn images={galleryColumns[1]} speed={-0.25} reduceMotion={reduceMotion} />
            <MarqueeColumn images={galleryColumns[2]} speed={0.3} reduceMotion={reduceMotion} />
          </div>
        </section>
      </main>
    </section>
  )
}
```

**Skeleton gaps implementers must close**

- Wire **`label`** **`htmlFor`** + **`input`** **`id`**, or **`onClick`** to **`input.click()`**; handle **drag-and-drop** events if brief requires.
- **`MarqueeColumn`**: optionally switch **speed** to **`pixelsPerSecond`** with **`performance.now()`** delta.
- **`Box` / `Bell` / `User`** were **in the removed header**—omit unless **brief** reintroduces **toolbar** **outside** this section.

## Layout Details

- **Flex trap**: parent **`min-h-0`** on **`main` / panes** if **marquee** **clips** unexpectedly.
- **Gallery**: **tilt** may **clip** corners—**keep** **`overflow-hidden`** on **right** **shell**.

## Content Rules

- **Headline**: **two-line** **imperative** fits **generator** products; keep **short**.
- **Dropzone**: **action** + **constraint** (“drag or browse”) in **hint** line.
- **Gallery**: **diverse** **aspect ratios** read as **output deck**—**alt** text **per** image.

## Implementation Constraints

- **`use client`** on **file** that owns **rAF** and **pointer** tracking.
- **`next/image`**: configure **remotePatterns** for **CMS** hosts; **don't** require **Unsplash** in **skill** output.

## Accessibility + Performance

- **Reduced motion**: **stop** **marquee** loops; **allow** **static** **stack**.
- **rAF**: **single** loop **preferred** when **multiple** columns—reduces **scheduler** **load**.
- **Images**: **reasonable** **`sizes`** for **column** width; **lazy** **below** fold if **framework** supports.
