# Component Skill: Hero — Split Metrics + Triple Fanned Phone Mockups

**Intent:** Marketing / product hero for a consumer mobile app—not a HUD, data wall, marquee gallery, or full-bleed WebGL/embed background. Split layout: copy + proof on one side; three fanned phone mockups (~−8° / 0° / +8°) on the other. **Implementation stack:** semantic HTML, Tailwind (or equivalent), **inline SVG** where needed (`<pattern>` for map grid, route path). **No WebGL, no iframe/embed runtimes.**

## Layout & composition

- **Section:** `relative`, horizontal clip (`overflow-x-hidden` or `overflow-hidden`), top padding for header clearance (`pt-16`→`pt-24` tier—tune if there is no global nav).
- **Background:** Three large soft blobs (`blur-3xl`), `absolute`, `pointer-events-none`, `aria-hidden` on wrapper; tint from design tokens / brief—not a fixed demo hex.
- **Container:** `max-w-7xl`, horizontal padding; `lg:grid-cols-2`, `gap-16`, items vertically centered. Mobile: stack; column order follows brief (copy first unless specified).
- **Left column:** Status pill (border, frosted bg, pulse dot + one line); split headline (primary + muted secondary span); body with max width; metric chips (≥3, typically four—label muted, value emphasized); primary solid CTA + secondary ghost with leading `lucide-react` icon; avatar stack (about four faces) + overflow count + one trust line.
- **Right column — stage:** `relative`, `max-w-xl`, `lg:ml-auto`, `min-h` ~560–600px so rotated phones don’t clip. Three phones `absolute`; center phone highest `z-index`, slightly elevated; sides lower. Chrome: ~`rounded-[2.2rem]`, ring, strong shadow, dark shell, pill notch, home indicator.
- **Per-screen content (distinct stories):**
  1. **Trail / product card:** header controls, title, hero image card with scrim, meta + small stat grid / schedule strip.
  2. **Map / route:** SVG grid via `<pattern>`, curved route, start/end dots; strokes and fills from CSS variables / `currentColor`; optional floating chips (distance, offline, GPS, etc.) + compact stats + CTA.
  3. **Live session:** hero photo, live pulse badge, glass metrics (pace/time/distance), progress bar, primary actions (pause / end—end uses destructive token).

## Visual language

Ink/void page surface; phones in elevated neutral-dark band; accent drives CTAs and route emphasis; destructive only where appropriate (e.g. end session). Display font for headline if brief supplies one (e.g. Bricolage → project utility). Tone: clean, optimistic, iOS-like depth—not brutalist.

## Rules

- No in-section site `<nav>` or app chrome (hero-only strip).
- Optional motion: subtle parallax or drift on phones wrapper—throttle (`rAF` or CSS-only); honor `prefers-reduced-motion`.
- SVG `id`s on patterns/gradients must be unique per phone—use React `useId()` (or equivalent) prefixes.
- Images inside phones: `next/image` or `<img>` with meaningful `alt` for marketing content when it carries meaning.

## Mandatory checklist

If any item is missing, the hero is invalid for **`triple-phone-mockup-fan-hero`**:

1. `relative` section with responsive vertical padding and `max-w-7xl` inner width.
2. At least three non-interactive blurred glow ellipses (token-colored; no mandatory single neon hex).
3. Two-column grid from `lg` up; single column below; sensible visual balance.
4. Status pill with dot + one status string.
5. Two-part headline + bounded-width body.
6. ≥3 metric chips in a wrapping row (`label` + `value`).
7. Two CTAs: primary filled (accent); secondary ghost with `lucide-react` icon (no Iconify).
8. Avatar stack + overflow badge + caption.
9. Right stage with explicit `min-h` in the ~560–600px range.
10. Three separate phone shells with distinct `rotate`/offset and center-forward stacking.
11. Each phone: notch, ring, shadow, `overflow-hidden` shell around screen content.
12. Three distinct screen narratives: (A) media card + stats, (B) SVG route map + chips/panel, (C) live session + progress + controls.
13. Route SVG path/markers wired to theme (CSS vars / `currentColor`), not only hard-coded neon.
14. Parallax/drift disabled when `prefers-reduced-motion: reduce`.
15. No `data-element-locator`, no CDN Tailwind script, no styled-jsx `<style jsx>`.

## Reference TSX skeleton

Adapt naming and tokens to the project. Add three `PhoneShell` components inside the stage; wire `props.phones` and unique SVG ids.

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
  socialProof: {
    avatars: readonly { src: string; alt: string }[]
    overflow: string
    caption: string
  }
  phones: {
    trailCard: {
      image: { src: string; alt: string }
      trailName: string
      chips: Metric[]
    }
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
            <h1 className="font-bricolage text-5xl font-medium leading-[1.05] tracking-tight sm:text-6xl">
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
              {/* Three PhoneShell nodes: left ~-8deg, center upright + higher z, right ~+8deg.
                  useId() prefixes for SVG pattern ids; populate from props.phones. */}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Example map panel — pass patternId from useId() when multiple SVGs mount. */
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

## Sizing & content

- Phone footprint reference: `w-64` / `sm:w-72`, height ~620px tread; scale down if the stage clips rotated frames.
- Copy and imagery come from the product brief—not placeholder national-park meme strings. Use licensed or generic placeholders; don’t assume Supabase URLs.
- Omit `"use client"` unless you add pointer hooks or non-CSS motion.
- **LCP:** Prefer one primary hero image in the first paint column or the center phone; lazy-load peripheral phone assets when practical.
