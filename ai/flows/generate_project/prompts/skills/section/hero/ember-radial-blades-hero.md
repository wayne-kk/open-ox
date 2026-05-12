# Component Skill: Hero — Ember Void + Radial Blade Sculpture (GSAP)

Full-viewport dark hero: ember radial stack + grain; left masked word-by-word headline + micro-labels; right **DOM** blade arc (many curved strips). **GSAP + ScrollTrigger** for blades and scroll text—**no WebGL**.

Reference used CDN header/iconify—**forbid**; nav in layout; **`lucide-react`** (or project icons); **GSAP from npm**.

Not **`*-webgl`** or **`cinematic-photo-glass-hero`**—abstract blades + type, not photo hero.

## Core Effect

- **Root section**: **`h-screen`** / **`min-h-screen`** equivalent, **`relative`**, **`overflow-hidden`**, **deep void** ground token; **antialiased** type; **selection** colors from **theme** (snippet’s orange selection is a **reference mood only**).
- **Film grain / noise**: **`fixed` `inset-0`**, **`pointer-events-none`**, **very low opacity** (~`0.03–0.08`), **`mix-blend-mode: overlay`** (or project equivalent), **SVG `feTurbulence`** via **data-URI** `background-image` **or** dedicated component—must not block interaction.
- **Atmospheric stack** (all **`fixed`**, **`z-0`**, **`pointer-events-none`**):
  1. **Primary void**: large **radial gradient** biased **off-center** (e.g. toward **right**), **ember → near-black** (**token stops**, not pasted demo hex).
  2. **Accent bloom**: second radial with **`mix-blend-screen`** (or similar) for **soft hot halo** at **moderate opacity** (~`0.5–0.7` range—tune to brand).
- **Main column** (`<main>`): **`relative z-20`**, **full height**, **flex** vertical center, **generous left inset** padding scaling by breakpoint.
- **Reveal hub** (`.reveal-trigger`): **inline-flex column**, **`max-w-fit`**, holds **title + label row**.
- **Display title**: **massive** (`~text-7xl` → `text-9xl` reference), **`uppercase`**, **`font-semibold`**, **tight tracking**, **flex-wrap** with **horizontal gap** between **word cells**.
- **Word / label mask pattern**: each token wrapped in **`inline-block`** with **`clip-path: polygon(-50% -50%, 150% -50%, 150% 100%, -50% 100%)`** (or equivalent rectangle that **contains** the motion); inner **`<span>`** starts at **`translateY(110–120%)`**, animates to **`translateY(0%)`**.
- **Glow typography**: layered **`text-shadow`** suggesting **hot bloom**—**hue and spread from accent tokens**, not mandatory literal `rgba` triplets from demo.
- **Micro-label row**: **`flex justify-between`**, **`text-xs`**, **wide letter-spacing**, **thin weight**, **muted warm tint** token; **four** (or brief-defined count) **masked words** with same **y-reveal** as title.
- **Sculpture container**: **`absolute`**, **vertically centered**, **anchored off right** (`right` **negative vw** pattern), **large height** (~`150vh` reference), **`origin-right`**, **`pointer-events-none`**, houses **`N`** **blade** elements (**~40 reference**, brief-tunable).
- **Each blade**: **`absolute`**, **`top-1/2` `right-0`**, **`origin-right`**, **`translateY(-50%)`**, **`rotate(angle)`** in a **sweep from ~−85° to +85°**, **viewport-relative width** (`~90vw` mobile / `~65vw` md+ reference), **modest height** (`~6vw` with **`minHeight`** floor); **pill-shaped** left edge via **`border-radius: 100% 0 0 100% / 50% 0 0 50%`** (or equivalent); **stacked linear-gradients** ( **vertical specular** + **horizontal ember depth** ) and **inset/outset `box-shadow`** for **thickness**—**all stops from tokens**.

## Visual Language

- **Palette roles**: **near-black void** base; **ember / molten** midtones; **paper-hot** highlight; **cool shadow** in blade cores—**derive** from **`primary` / `accent` / `background`** or CSS variables; **do not** treat snippet hex as mandatory output.
- **Readability**: glow on type **must not** destroy WCAG intent for **marketing heroes**—if brief requires **AAA**, add **subtle scrim** behind copy column only (still **no photo**—optional **left vignette**).

## Structure Requirements

- **No site navigation** — **no** `<header>`, **no** logo row, **no** `iconify-icon` in this section.
- **Layer order (bottom → top)**:
  1. Section background token (optional flat fill).
  2. **Radial void layers** (`z-0`).
  3. **Sculpture** container (`z-10`, **below** copy).
  4. **Main** copy (`z-20`).
  5. **Noise** (`z-50` reference)—**still `pointer-events-none`**.

## Motion Direction (GSAP)

- **Timeline** (`defaults.ease` **`power3.out`** family):  
  1. **Blades**: **`opacity 0→1`**, **`duration ~2.5s`**, **`stagger`** with **`amount ~1.8`**, **`from: "center"`**, starting ~`0.2s`.  
  2. **Title words**: **`y: 0%`** (from GSAP-measured start), **`duration ~1.6`**, **`stagger ~0.18`**, **`ease: expo.out`**, **`scrollTrigger`** on `.reveal-trigger`, **`start: 'top 85%'`**.  
  3. **Label words**: same pattern, **`duration ~1.4`**, **`stagger ~0.12`**, slightly later timeline offset (~`1.0s`).
- **Ambient (looping)**:
  - **Hub**: **slow `yoyo` rotation** on sculpture container (**~±4°**, **~16s** period, **`sine.inOut`**).
  - **Blades**: **per-blade micro `rotation` / `scaleX` `yoyo`** with **phased delays** and **5–8s-scale** durations—**amplitudes small** (reference **~2°**, **scaleX ~1.01–1.02**).
- **`prefers-reduced-motion: reduce`**: **skip** infinite tweens; **set** blades **visible** and **type at final position**; **optional** omit ScrollTrigger or **instant** set—**must** **`ScrollTrigger.kill()`** / **`gsap.killTweensOf`** in cleanup path.

## Rendering / Implementation (DOM Blades)

- Blades are **`div`s**, not **`<canvas>`**—**no** Three.js.
- **Resize**: on **`window.resize`**, **update** blade **`width`** (vw preset) **or** regenerate layout constants; **debounce** optional; **remove** listener on unmount.
- **React**: **prefer** `**Array.from**` **render** of blades (stable **`key`**) over **`document.createElement`** loops so Reconciliation stays predictable—**GSAP** targets **`scope`** ( **`gsap.context`** ).

## Required Implementation Blueprint (Do Not Skip)

When this skill is selected, the generated hero MUST include all of the following:

1. **Viewport-locked hero** (`**h-screen`** or **`min-h-[100dvh]`**), **`overflow-hidden`**, **void** background role from tokens.
2. **Noise veil**: **fixed fullscreen**, **`pointer-events-none`**, **SVG fractal noise** (data-URI or file), **blend mode** + **low opacity**.
3. **At least two** **radial gradient** layers ( **void** + **screen/additive bloom** style) **`fixed`**, **non-interactive**, **token-driven** color stops.
4. **No header / nav / Iconify / CDN GSAP** in output—**bundled** `**gsap`** and `**gsap/ScrollTrigger`** **imports** only.
5. **Left-centered main column** with **responsive pl** scale; **reveal-trigger** wrapper containing **headline + label row**.
6. **Headline structure**: **multiple word segments**; **each** in **clip-path clipper** + inner span with **initial below-fold translateY** (`**110%+**`); **flex-wrap** + **gap** between words.
7. **ScrollTrigger-linked** **stagger** bringing **title words** to **`y:0`** with **`expo.out`** (or equivalent) **ease**—**one** coherent timeline or **matched** choreography.
8. **Label row** with **same mask/reveal** mechanism and **ScrollTrigger** tied to **same trigger** element.
9. **Sculpture**: **≥36** blades (reference **42**), **arc distribution** of **rotation angles** across **~170°** span, **z-index** stacks by index; **responsive width** rule on **resize**.
10. **Blade styling**: **curved left edge** radius pattern, **dual `linear-gradient` background** ( **specular vertical** + **horizontal depth** ), **compound `box-shadow`** ( **outer cast** + **inset rim** )—**colors from brief**, not demo literals only.
11. **Intro timeline**: blade **opacity stagger** **`from: "center"`** with **multi-second** **in**; **no** pop-in without stagger.
12. **Ambient loops** on **container** and **each blade** (**yoyo**, **`sine.inOut`**) **unless** `**prefers-reduced-motion**`.
13. **Cleanup**: **`gsap.context`** **or** **`ScrollTrigger.getAll().forEach(kill)`** + **`revert`** on **unmount**; **remove** **resize** listeners.
14. **Icons** (if global shell echoes this brand elsewhere): **`lucide-react`** only in **project** patterns—**this hero section** still **excludes** top bar; if a **Calibrate** affordance is required by brief, implement as **inline link** without Iconify.

If any item above is missing, the output is **NOT** valid for `ember-radial-blades-hero`.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client"

import { useEffect, useLayoutEffect, useRef, useMemo, useState } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

const NOISE_SVG = encodeURIComponent(
  `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#noise)"/></svg>`,
)

type EmberRadialBladesHeroProps = {
  titleWords: readonly string[]
  labelWords: readonly string[]
  bladeCount?: number
}

export function EmberRadialBladesHero({
  titleWords,
  labelWords,
  bladeCount = 42,
}: EmberRadialBladesHeroProps) {
  const rootRef = useRef<HTMLElement | null>(null)
  const revealRef = useRef<HTMLDivElement | null>(null)
  const sculptureRef = useRef<HTMLDivElement | null>(null)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduceMotion(mq.matches)
    sync()
    mq.addEventListener?.("change", sync)
    return () => mq.removeEventListener?.("change", sync)
  }, [])

  const blades = useMemo(
    () =>
      Array.from({ length: bladeCount }, (_, i) => {
        const progress = bladeCount > 1 ? i / (bladeCount - 1) : 0
        return { id: i, angle: -85 + progress * 170 }
      }),
    [bladeCount],
  )

  useLayoutEffect(() => {
    const root = rootRef.current
    const sculpture = sculptureRef.current
    if (!root || !sculpture) return

    if (reduceMotion) {
      gsap.set(".blade", { opacity: 1 })
      gsap.set([".title-word", ".label-word"], { y: "0%" })
      return
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } })

      tl.to(
        ".blade",
        {
          opacity: 1,
          duration: 2.5,
          stagger: { amount: 1.8, from: "center" },
          ease: "power2.out",
        },
        0.2,
      )

      tl.to(
        ".title-word",
        {
          y: "0%",
          duration: 1.6,
          stagger: 0.18,
          ease: "expo.out",
          scrollTrigger: {
            trigger: revealRef.current,
            start: "top 85%",
          },
        },
        0.6,
      )

      tl.to(
        ".label-word",
        {
          y: "0%",
          duration: 1.4,
          stagger: 0.12,
          ease: "expo.out",
          scrollTrigger: {
            trigger: revealRef.current,
            start: "top 85%",
          },
        },
        1.0,
      )

      gsap.to(sculpture, {
        rotation: -4,
        duration: 16,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      })

      gsap.utils.toArray<HTMLElement>(sculpture.querySelectorAll(".blade")).forEach((blade, index) => {
        gsap.to(blade, {
          rotation: `+=${2 + (index % 2)}`,
          scaleX: 1.015 + (index % 3) * 0.005,
          duration: 5 + (index % 3),
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: index * 0.06,
        })
      })
    }, root)

    const onResize = () => {
      const w = window.innerWidth > 768 ? "65vw" : "90vw"
      sculpture.querySelectorAll<HTMLElement>(".blade").forEach((el) => {
        el.style.width = w
      })
    }
    window.addEventListener("resize", onResize)

    return () => {
      window.removeEventListener("resize", onResize)
      ctx.revert()
    }
  }, [reduceMotion, bladeCount])

  return (
    <section
      ref={rootRef}
      className="relative h-screen w-full overflow-hidden bg-[color:var(--void)] font-sans text-white antialiased selection:bg-[color:var(--selection-bg)] selection:text-[color:var(--selection-fg)]"
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.05] mix-blend-overlay"
        style={{ backgroundImage: `url("data:image/svg+xml;utf8,${NOISE_SVG}")` }}
      />

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(circle at 85% 50%, var(--ember-mid), var(--ember-deep) 40%, var(--void) 90%)",
        }}
      />

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 mix-blend-screen opacity-60"
        style={{
          background:
            "radial-gradient(circle at 75% 50%, color-mix(in oklch, var(--ember-hot) 20%, transparent) 0%, transparent 60%)",
        }}
      />

      <main className="relative z-20 flex h-full w-full flex-col justify-center pl-8 md:pl-24 lg:pl-32">
        <div ref={revealRef} className="reveal-trigger relative inline-flex max-w-fit flex-col">
          <h1
            className="flex flex-wrap gap-x-4 text-7xl font-semibold uppercase leading-none -tracking-tight md:gap-x-8 md:text-9xl"
            style={{
              textShadow:
                "0 0 25px color-mix(in oklch, var(--bloom-soft) 60%, transparent), 0 0 60px color-mix(in oklch, var(--ember-hot) 40%, transparent)",
            }}
          >
            {titleWords.map((w, idx) => (
              <div
                key={`${w}-${idx}`}
                className="inline-block"
                style={{
                  clipPath: "polygon(-50% -50%, 150% -50%, 150% 100%, -50% 100%)",
                }}
              >
                <span className="title-word inline-block translate-y-[110%] will-change-transform">
                  {w}
                </span>
              </div>
            ))}
          </h1>

          <div className="mt-8 flex w-[95%] justify-between text-xs font-thin uppercase tracking-[0.4rem] text-[color:var(--ember-muted)] md:mt-12 md:w-full md:tracking-[0.8rem]">
            {labelWords.map((w, idx) => (
              <div
                key={`${w}-${idx}`}
                className="inline-block"
                style={{
                  clipPath: "polygon(-50% -50%, 150% -50%, 150% 100%, -50% 100%)",
                }}
              >
                <span className="label-word inline-block translate-y-[120%] will-change-transform">
                  {w}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <div
        ref={sculptureRef}
        className="pointer-events-none absolute top-1/2 right-[-15vw] z-10 h-[150vh] w-[70vw] origin-right -translate-y-1/2 md:right-[-5vw] md:w-[50vw]"
      >
        {blades.map((b, i) => (
          <div
            key={b.id}
            className="blade absolute right-0 top-1/2 opacity-0"
            style={{
              width: typeof window !== "undefined" && window.innerWidth > 768 ? "65vw" : "90vw",
              height: "6vw",
              minHeight: 35,
              transformOrigin: "right center",
              transform: `translateY(-50%) rotate(${b.angle}deg)`,
              zIndex: i,
              borderRadius: "100% 0 0 100% / 50% 0 0 50%",
              background: `
                linear-gradient(to bottom, color-mix(in oklch, white 50%, transparent) 0%, transparent 8%, transparent 85%, color-mix(in oklch, black 80%, transparent) 100%),
                linear-gradient(to right, var(--blade-hi), var(--ember-hot), var(--ember-deep), var(--blade-shadow), var(--void))
              `,
              boxShadow:
                "0px 18px 45px -8px rgba(0,0,0,0.95), inset 0px 2px 4px color-mix(in oklch, white 40%, transparent), inset 0px -4px 12px rgba(0, 0, 0, 0.9)",
            }}
          />
        ))}
      </div>
    </section>
  )
}
```

**Fixes implementers should apply**

- **Blade angle math** when `bladeCount === 1`: use **`progress = 0`** (e.g. **`angle = -85°`**)—never divide by **`bladeCount - 1`** when it is **0**.
- **SSR / hydration**: **do not** read **`window.innerWidth`** in **render** for initial **blade width**—use **`useState` + `useEffect`** or **CSS `clamp`** / **`vw`** in **className** where possible; the skeleton flags the issue for **refinement**.
- Define **CSS variables** (`--void`, `--ember-hot`, **`--blade-*`**, etc.) in **theme** or **parent wrapper**.

## Layout Details

- **Right overflow** is **intentional**—blades **bleed** past viewport; **guard** **horizontal page scroll** at **`body`** if needed (**`overflow-x-hidden`** on layout).
- **Title** may **wrap** to multiple lines on **narrow** widths—**keep** **gap** consistent.

## Content Rules

- **Title words**: **2–4** **short** tokens for maximum **impact**; **uppercase** in CSS, not necessarily in **CMS** strings (transform handles case if product allows).
- **Labels**: **secondary** **myth / positioning** line—**four** **single words** match reference; **adjust count** if copy demands **3 or 5** (update **flex** layout accordingly).

## Implementation Constraints

- **`use client`** on this component.
- **No** `iconify-icon`, **no** Tailwind **CDN**, **no** GSAP **CDN**.
- **ScrollTrigger**: call **`ScrollTrigger.refresh()`** after **fonts load** if **layout shifts** (optional **`document.fonts.ready`** hook).

## Accessibility + Performance

- **Reduced motion** path **required**—see Motion section.
- **GPU**: many **blades** + **shadows** can be **heavy**—on **low-power** profiles, **cap** **`bladeCount`** (~**24**) or **remove** **inner** shadows per **product perf budget**.
- **Seizures**: **no** **rapid** **strobing**—ambient motion **must stay slow** and **low amplitude**.
