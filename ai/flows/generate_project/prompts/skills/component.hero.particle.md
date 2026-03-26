---
id: component.hero.particle
kind: component-skill
sectionTypes: ["hero"]
priority: 72
fallback: false
when:
  designKeywords:
    any: ["particle", "generative", "interactive", "canvas", "text-effect", "kinetic", "dissolve", "scatter"]
    none: ["editorial", "magazine", "luxury", "minimal", "dashboard", "shader", "webgl", "lightning"]
  capabilityAssists:
    any: ["effect.motion.ambient", "effect.motion.energetic"]
    none: []
  journeyStages:
    any: ["acquisition", "launch", "activation", "campaign"]
    none: []
  productTypes:
    any: ["marketing-site", "campaign-site", "brand-site", "developer-tool"]
    none: []
notes: |
  Use for heroes with a canvas-based particle text effect. Particles form words
  and animate between them. Interactive: right-click destroys nearby particles.
---

# Component Skill: Hero — Particle Text

Use this skill when generating a hero section where the headline is rendered as an animated particle system on a `<canvas>`. Particles swarm to form words, cycle through them automatically, and respond to mouse interaction.

## Core Effect

The entire visual is a `<canvas>` element. Particles (small dots) fly in from random positions and assemble into the shape of text. Every few seconds they reassemble into the next word. Right-click + drag destroys nearby particles.

Keep the implementation self-contained in the hero component — no separate UI component files.

## Particle System — Minimal Implementation

Use this exact class structure, stripped to essentials:

```ts
class Particle {
  pos = { x: 0, y: 0 }
  vel = { x: 0, y: 0 }
  acc = { x: 0, y: 0 }
  target = { x: 0, y: 0 }
  maxSpeed = 5
  maxForce = 0.25
  size = 2
  isKilled = false
  color = { r: 255, g: 255, b: 255 }
  targetColor = { r: 255, g: 255, b: 255 }
  colorWeight = 1

  move() {
    const dx = this.target.x - this.pos.x
    const dy = this.target.y - this.pos.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const prox = dist < 80 ? dist / 80 : 1
    const speed = this.maxSpeed * prox
    const mag = dist || 1
    const steerX = (dx / mag) * speed - this.vel.x
    const steerY = (dy / mag) * speed - this.vel.y
    const sMag = Math.sqrt(steerX * steerX + steerY * steerY) || 1
    this.acc.x += (steerX / sMag) * this.maxForce
    this.acc.y += (steerY / sMag) * this.maxForce
    this.vel.x += this.acc.x
    this.vel.y += this.acc.y
    this.pos.x += this.vel.x
    this.pos.y += this.vel.y
    this.acc.x = 0
    this.acc.y = 0
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.colorWeight = Math.min(this.colorWeight + 0.02, 1)
    const r = Math.round(this.color.r + (this.targetColor.r - this.color.r) * this.colorWeight)
    const g = Math.round(this.color.g + (this.targetColor.g - this.color.g) * this.colorWeight)
    const b = Math.round(this.color.b + (this.targetColor.b - this.color.b) * this.colorWeight)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(this.pos.x, this.pos.y, this.size, this.size)
  }
}
```

## Word Rendering

Use an offscreen canvas to rasterize text, then sample lit pixels at every N steps to get particle targets:

```ts
function getPixelTargets(word: string, canvas: HTMLCanvasElement, step = 5) {
  const off = document.createElement("canvas")
  off.width = canvas.width
  off.height = canvas.height
  const ctx = off.getContext("2d")!
  ctx.fillStyle = "white"
  ctx.font = `bold ${Math.floor(canvas.height * 0.28)}px Arial`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(word, canvas.width / 2, canvas.height / 2)
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const coords: { x: number; y: number }[] = []
  for (let i = 0; i < data.length; i += step * 4) {
    if (data[i + 3] > 0) {
      coords.push({ x: (i / 4) % canvas.width, y: Math.floor(i / 4 / canvas.width) })
    }
  }
  // shuffle for fluid motion
  for (let i = coords.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [coords[i], coords[j]] = [coords[j], coords[i]]
  }
  return coords
}
```

## Component Structure

```tsx
"use client"
import { useEffect, useRef } from "react"

export default function HeroSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // words = project-relevant terms from the design brief (headline, brand name, tagline)
  const words = ["WORD_1", "WORD_2", "WORD_3"]  // replace with real content

  useEffect(() => {
    const canvas = canvasRef.current!
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    // ... init particles, start rAF loop, attach mouse events
    // cleanup: cancelAnimationFrame on unmount
  }, [])

  return (
    <section className="relative w-full h-screen bg-black overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {/* Overlay: headline copy, CTA — positioned above canvas */}
      <div className="relative z-10 flex flex-col items-center justify-end h-full pb-16 text-center px-4">
        {/* eyebrow, subheading, CTA buttons */}
      </div>
    </section>
  )
}
```

## Content Rules

- `words` array must contain **real project-relevant content**: brand name, headline, tagline, key value prop — derived from the project brief. Never use placeholder words like "HELLO" or "21st.dev".
- Canvas is the hero visual. Keep overlay copy minimal: one subheading line + one CTA is enough.
- Background: always `bg-black` or near-black. Particle colors should contrast.
- Pick particle colors from the design system's primary/accent tokens or derive from the mood keywords.

## Canvas Sizing

- Set `canvas.width / height` from `canvas.offsetWidth / offsetHeight` on mount and on resize.
- Use a `ResizeObserver` or `window.resize` listener; re-initialize particles on resize.

## Animation Loop

```ts
function animate() {
  ctx.fillStyle = "rgba(0,0,0,0.15)"  // motion blur trail
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  for (const p of particles) { p.move(); p.draw(ctx) }
  rafId = requestAnimationFrame(animate)
}
```

## Word Cycling

Cycle words every ~240 frames (~4s at 60fps). On each cycle, call `assignTargets(nextWord)` which maps existing particles to new pixel targets and spawns new ones as needed. Kill surplus particles by sending them off-screen.

## Mouse Interaction

Right-click + drag: destroy particles within radius 60 of cursor. Optional, keep it simple.

## Constraints

- Single file, no imports beyond React hooks.
- `"use client"` required.
- No external canvas/particle libraries.
- Font size for text rasterization: `Math.floor(canvas.height * 0.28)` — scales with canvas.
- Pixel sampling step: 5–6 for performance.
