---
id: component.hero.minimalist
kind: component-skill
sectionTypes: ["hero"]
priority: 75
fallback: false
disabled: true
when:
  designKeywords:
    any: ["minimal", "minimalist", "clean", "editorial", "fashion", "luxury", "portrait", "product-shot", "lifestyle", "elegant", "refined", "white-space", "typographic", "less-is-more", "modern-minimal", "boutique", "high-end", "premium"]
    none: ["neon", "cyber", "glow", "festival", "rave", "acid", "dramatic", "immersive", "dashboard", "analytics", "shader", "webgl"]
  traits:
    any: ["split", "centered", "editorial", "subtle"]
    none: ["energetic"]
  journeyStages:
    any: ["entry", "acquisition", "campaign"]
    none: []
  productTypes:
    any: ["marketing-site", "brand-site", "portfolio", "landing-page", "product-site", "fashion-site", "lifestyle-brand"]
    none: ["dashboard", "admin", "internal-tool"]
notes: |
  Minimalist hero: full-viewport, three-column grid, centered product/portrait on a solid-color circle,
  oversized headline right, body copy left, staggered framer-motion entrance. Best for fashion,
  lifestyle, product, and brand sites.
---

# Component Skill: Hero — Minimalist Split

## The Defining Visual Effect

The centerpiece of this hero is a **product/portrait image that visually overflows a large solid-color circle**.

```
         ┌─────────────────────────────────────────────────────┐
         │  Logo          HOME  PRODUCT  ABOUT          ☰      │
         ├─────────────────────────────────────────────────────┤
         │                                                     │
         │  Short body    ┌──────────────┐   OVERSIZED        │
         │  copy here.    │  [  image  ] │   HEADLINE         │
         │                │ ┌──────────┐ │   TWO LINES        │
         │  Read More     │ │  circle  │ │                    │
         │                │ └──────────┘ │                    │
         │                └──────────────┘                    │
         │                                                     │
         ├─────────────────────────────────────────────────────┤
         │  ⓕ ⓘ ⓣ                              City, Country  │
         └─────────────────────────────────────────────────────┘
```

The image uses `scale-150` to extend beyond the circle boundary. The parent has NO `overflow-hidden`.

## Critical Implementation: Circle + Overflowing Image

This is the most important part. Implement it exactly like this:

```tsx
{/* Center column */}
<div className="relative order-1 flex h-full items-center justify-center md:order-2">

  {/* Circle — absolute, behind the image, NO overflow-hidden on parent */}
  <motion.div
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
    className="absolute z-0 h-[300px] w-[300px] rounded-full bg-yellow-400/90 md:h-[400px] md:w-[400px] lg:h-[500px] lg:w-[500px]"
  />

  {/* Image — call generate_image tool first, then use the returned path. Wrap in motion.div for entrance; scale on wrapper */}
  <motion.div
    className="relative z-10 w-56 scale-150 md:w-64 lg:w-72"
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
  >
    <img
      src="/images/HeroSection-center.png"
      alt="Editorial fashion portrait"
      className="h-auto w-full object-cover"
      style={{ aspectRatio: "3 / 4" }}
    />
  </motion.div>
</div>
```

**Rules for this effect:**
- Call `generate_image` tool with a portrait-oriented prompt before writing the component, then use the returned `/images/...` path in a standard `<img>` tag.
- Parent `div`: NO `overflow-hidden` — the image must be allowed to overflow
- Circle: `absolute z-0 rounded-full` — background layer only
- Image wrapper: `relative z-10 scale-150` — sits on top, scaled 1.5× to overflow the circle
- Circle color: use design system accent (warm tones work best: yellow, orange, amber)

## Full Layout Structure

```tsx
"use client";
import { motion } from "framer-motion";
import { Facebook, Instagram, Twitter } from "lucide-react";

export default function HeroSection() {
  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-between overflow-hidden bg-background p-8 md:p-12">

      {/* Header */}
      <header className="z-30 flex w-full max-w-7xl items-center justify-between">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
          className="text-xl font-bold tracking-wider">
          [Logo text]
        </motion.div>
        <div className="hidden items-center space-x-8 md:flex">
          {/* Nav links: text-sm tracking-widest text-foreground/60 */}
        </div>
        <motion.button initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
          className="flex flex-col space-y-1.5 md:hidden" aria-label="Open menu">
          <span className="block h-0.5 w-6 bg-foreground" />
          <span className="block h-0.5 w-6 bg-foreground" />
          <span className="block h-0.5 w-5 bg-foreground" />
        </motion.button>
      </header>

      {/* 3-column grid */}
      <div className="relative grid w-full max-w-7xl flex-grow grid-cols-1 items-center md:grid-cols-3">

        {/* Left: body copy */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 1 }}
          className="z-20 order-2 text-center md:order-1 md:text-left">
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-foreground/80 md:mx-0">[Body copy]</p>
          <a href="#" className="mt-4 inline-block text-sm font-medium text-foreground underline decoration-from-font">Read More</a>
        </motion.div>

        {/* Center: circle + overflowing image — SEE ABOVE */}
        <div className="relative order-1 flex h-full items-center justify-center md:order-2">
          {/* circle + image as shown above */}
        </div>

        {/* Right: oversized headline */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 1.2 }}
          className="z-20 order-3 flex items-center justify-center text-center md:justify-start">
          <h1 className="text-7xl font-extrabold text-foreground md:text-8xl lg:text-9xl">
            [Line 1]<br />[Line 2]
          </h1>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="z-30 flex w-full max-w-7xl items-center justify-between">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 1.2 }}
          className="flex items-center space-x-4">
          {/* Social icons: h-5 w-5, text-foreground/60 hover:text-foreground */}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 1.3 }}
          className="text-sm font-medium text-foreground/80">
          [Location text]
        </motion.div>
      </footer>
    </div>
  );
}
```

## Content Guidelines

- Fill ALL content from the project context — no placeholder text
- Image: call `generate_image` tool with descriptive prompt tuned to the brand, then use the returned path in `<img src="...">`
- Headline: 2 short lines, evocative, brand-aligned
- Circle color: match design system accent (yellow/orange/amber for warm brands, use `--color-accent` token)
- Social icons: use lucide-react icons matching the brand's actual social presence

## Constraints

- `"use client"` required (framer-motion)
- No `overflow-hidden` on the center column parent
- `scale-150` on the image wrapper is mandatory for the overflow effect
- Output only raw TSX, no markdown fences
