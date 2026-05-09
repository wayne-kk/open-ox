# Component Skill: Hero — Sphere Swarm Points (Three.js)

Use this skill when `generateSection` should deliver a **full-viewport dark hero** whose background is a **dense Three.js `Points`** cloud occupying a spherical volume: particles subtly **respond to pointer position** (soft attraction along the view plane), **pulse outward on primary click** near the cursor, then **relax back** to seeded “home” positions with light damping. Stack reads as **live telemetry / neural field** rather than illustration or photographic editorial.

Do **not** use this skill when the headline must be formed from 2D canvas particles or kinetic typography—that route belongs to `**particle`** (`canvas` text assembly), not WebGL points.

## Core Effect

- Thousands of tinted point sprites (~4k reference scale) scattered in a **hollow spherical shell** volume; each particle remembers a stable **home** XYZ.
- **Additive** point rendering: soft glow, depth felt through parallax and brightness, not hard geometry.
- **Pointer mapping**: screen coordinates → ray → intersection with a **plane at z = 0** (or equivalent fixed depth in view space) to drive attraction in XY; Z uses home-spring only (match reference feel).
- **Continuous loop**: spring toward home + optional mouse well + velocity integration + friction; `position` buffer attribute updated each frame.
- **Click burst**: on press, particles within a **XY radius** of the mapped point receive **outward XY impulse** (reference used radial push from cursor).

## Visual Language

- **Ground**: deep void background; optional **radial vignette** from tokens (`background` → darker edge) so the swarm reads centered—**do not** copy demo zinc/emerald hex; use **brief-driven** CSS variables or theme tokens.
- **Figure**: particle colors are **vertex colors** sampled from a **small role set** (e.g. primary accent, secondary/cool accent, neutral highlight). Contrast should stay **readable** under the overlay; keep mid-tones slightly dimmer than CTA text.
- **Overlay typography**: high-contrast headline; **one gradient or token-mapped accent span** on a key phrase (not a fixed emerald→cyan unless the brief demands it).
- **Secondary UI**: optional **status / eyebrow** pill (system-live metaphor), **mono stats ribbon** at bottom with 2–4 believable metrics aligned to the product story.

## Structure Requirements

- **No site navigation** — omit `<nav>`, logo rows, global links, and hamburger chrome. This section is **visual field + hero copy + CTAs + optional metrics** only.
- **Layering (bottom → top)**:
  1. Section root: `relative w-full min-h-[100svh] overflow-hidden` (or project equivalent).
  2. **Background stack**: optional token-based radial wash + **full-bleed** `<canvas class="block w-full h-full">` in `absolute inset-0 z-0`.
  3. **Content**: `relative z-10` centered column (eyebrow, `h1`, supporting line, primary + secondary CTA).
  4. **Optional metrics ribbon**: `absolute` bottom region, subtle top border using `border-foreground/5` or token; responsive wrap.
- **Canvas hit target**: pointer listeners may attach to `window` or the section; ensure **decorative layers** use `pointer-events-none` only where they must not steal clicks from CTAs.

## Motion Direction

- Idle motion = **gentle breathing** from spring-back + mouse well (if `prefers-reduced-motion` is false).
- **Entrance**: optional brief opacity fade-in of overlay copy (project motion system); WebGL may start static first frame then enable loop.
- `**prefers-reduced-motion: reduce`**: **disable** the animation loop after one static `render`, or show a **frozen** particle frame; **do not** run continuous physics.

## WebGL Requirements (Three.js)

- Import `**three` from the project bundle** (npm). **No** CDN `<script>` tags, **no** global `THREE` from `r128` demo URLs.
- **Scene / camera / renderer**:
  - `PerspectiveCamera` (~70–80° FOV reference); place camera on +Z looking at origin; `near`/`far` sane defaults.
  - `WebGLRenderer({ canvas, alpha: true, antialias: true })`; clear alpha so CSS background can show if desired.
  - **Pixel ratio**: `setPixelRatio(Math.min(devicePixelRatio, 2))` (or project cap) to protect GPU.
- **Geometry**:
  - `BufferGeometry` with `position` (dynamic) and `color` (static per particle).
  - Initialize positions = home positions; seed **spherical** distribution: random `theta`, `phi`, radius between **inner/outer** shell radii (reference ~4–6 units).
- **Material**:
  - `PointsMaterial` with `vertexColors: true`, `transparent: true`, moderate opacity, `**AdditiveBlending`**, small `size` (tune per DPR).
- **Interaction math**:
  - `Raycaster#setFromCamera` with NDC from canvas **bounding rect** (not raw `window` if container-sized).
  - **Plane** for hit test: normal `(0,0,1)`, constant `0` in reference—keep behavior equivalent when camera moves.
  - **Guards**: skip normalize when `dist === 0` for burst/attraction to avoid NaNs.

## Required Implementation Blueprint (Do Not Skip)

When this skill is selected, the generated hero MUST include all of the following:

1. **Three.js `Points` field** with **~3.5k–4.5k** particles (same order of magnitude as reference), each with **home** XYZ and **current** position in typed arrays; colors as **vertexColors** from **brief roles** (no mandatory fixed hex from the demo).
2. `**PointsMaterial`** configured for **additive** blending, transparency, and **per-vertex color**; particle `size` tuned so the field reads as **fine dust**, not oversized disks.
3. **Animation core** per frame: **spring toward home** on all axes; **optional XY attraction** toward pointer-mapped world position within a **finite influence radius**; **velocity integration** + **global friction** on velocities (reference ~0.92).
4. **Pointer plane mapping** via `Raycaster` + **single plane** (or equivalent) so mouse maps to **stable world XY**; updates on move.
5. **Click / primary-press impulse**: particles within a **XY distance threshold** of the mapped point receive an **outward radial kick** scaled by proximity (same family as reference `mousedown` logic); guard **division by zero**.
6. **Resize handling** tied to the **actual canvas host size** (container `clientWidth`/`clientHeight` preferred over bare `window` when the hero is not full-window); update **camera aspect** and **renderer.setSize**; skip when dimensions are zero.
7. **Render loop** via `requestAnimationFrame` with **cleanup** on unmount: cancel frame, **remove** all listeners, `**dispose()`** geometry and material, dispose renderer if appropriate for the integration pattern used.
8. **Reduced motion**: respect `prefers-reduced-motion` by **not** running continuous physics (static snapshot acceptable).
9. **Hero overlay content only**: eyebrow/status chip, headline with **one accent treatment**, body copy, **two CTAs** (primary filled / secondary outline), and **optional** bottom **metrics ribbon**—**no** global navigation or app header.
10. **Accessibility & input**: decorative canvas does not trap focus; CTAs are real focusable controls/links; if simulating “system status,” keep language **honest** to the product (no fake security claims unless true).

If any item above is missing, the output is **NOT** valid for `sphere-swarm-webgl`.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

type SphereSwarmHeroProps = {
  headline: string
  accentLine: string
  subcopy: string
  primaryCta: { label: string; href: string }
  secondaryCta: { label: string; href: string }
  eyebrow?: string
  metrics?: { label: string; value: string; unit?: string }[]
}

/** Resolve design-token colors to THREE.Color — avoid passing raw `var(...)` into THREE.Color(). */
function colorsFromCssVars(
  primaryVar: string,
  accentVar: string,
  neutralVar: string,
): [THREE.Color, THREE.Color, THREE.Color] {
  const read = (name: string) => {
    if (typeof document === "undefined") return new THREE.Color(0xffffff)
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return new THREE.Color(raw.length > 0 ? raw : "#ffffff")
  }
  return [read(primaryVar), read(accentVar), read(neutralVar)]
}

export function SphereSwarmHero({
  headline,
  accentLine,
  subcopy,
  primaryCta,
  secondaryCta,
  eyebrow = "System status",
  metrics,
}: SphereSwarmHeroProps) {
  const rootRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
    camera.position.z = 5

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    const maxDpr = 2
    const setSize = () => {
      const w = root.clientWidth
      const h = root.clientHeight
      if (w === 0 || h === 0) return
      const dpr = Math.min(window.devicePixelRatio ?? 1, maxDpr)
      renderer.setPixelRatio(dpr)
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    setSize()

    const count = 4000
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const home = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const palette = colorsFromCssVars("--primary", "--ring", "--muted-foreground")

    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      const r = 4 + Math.random() * 2
      home[i3] = r * Math.sin(phi) * Math.cos(theta)
      home[i3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      home[i3 + 2] = r * Math.cos(phi)
      positions[i3] = home[i3]
      positions[i3 + 1] = home[i3 + 1]
      positions[i3 + 2] = home[i3 + 2]
      const c = palette[Math.floor(Math.random() * palette.length)]
      colors[i3] = c.r
      colors[i3 + 1] = c.g
      colors[i3 + 2] = c.b
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    const mouse = { x: -999, y: -999, active: false }
    const raycaster = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const hit = new THREE.Vector3()

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
      if (raycaster.ray.intersectPlane(plane, hit)) {
        mouse.x = hit.x
        mouse.y = hit.y
        mouse.active = true
      }
    }

    const onDown = () => {
      const pos = geometry.attributes.position.array as Float32Array
      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const dx = pos[i3] - mouse.x
        const dy = pos[i3 + 1] - mouse.y
        const dist = Math.hypot(dx, dy)
        if (dist < 1.5 && dist > 1e-6) {
          const force = (1.5 - dist) * 0.8
          velocities[i3] += (dx / dist) * force
          velocities[i3 + 1] += (dy / dist) * force
        }
      }
    }

    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const pos = geometry.attributes.position.array as Float32Array
      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        if (mouse.active) {
          const dx = mouse.x - pos[i3]
          const dy = mouse.y - pos[i3 + 1]
          const dist = Math.hypot(dx, dy)
          if (dist < 2.5 && dist > 1e-6) {
            const pull = (2.5 - dist) * 0.0005
            velocities[i3] += dx * pull
            velocities[i3 + 1] += dy * pull
          }
        }
        velocities[i3] += (home[i3] - pos[i3]) * 0.01
        velocities[i3 + 1] += (home[i3 + 1] - pos[i3 + 1]) * 0.01
        velocities[i3 + 2] += (home[i3 + 2] - pos[i3 + 2]) * 0.01
        pos[i3] += velocities[i3]
        pos[i3 + 1] += velocities[i3 + 1]
        pos[i3 + 2] += velocities[i3 + 2]
        velocities[i3] *= 0.92
        velocities[i3 + 1] *= 0.92
        velocities[i3 + 2] *= 0.92
      }
      geometry.attributes.position.needsUpdate = true
      renderer.render(scene, camera)
    }

    const onResize = () => setSize()

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mousedown", onDown)
    window.addEventListener("resize", onResize)

    if (reduced) {
      renderer.render(scene, camera)
    } else {
      animate()
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mousedown", onDown)
      window.removeEventListener("resize", onResize)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <section
      ref={rootRef}
      className="relative w-full min-h-[100svh] overflow-hidden bg-background text-foreground"
    >
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,var(--color-muted),var(--color-background))]">
        <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
      </div>

      <main className="relative z-10 flex min-h-[100svh] flex-col items-center justify-center px-6 text-center">
        <div className="max-w-4xl">
          {eyebrow ? (
            <p className="mb-8 inline-flex items-center gap-3 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mb-8 text-5xl font-black uppercase leading-[0.85] tracking-tighter md:text-8xl">
            {headline}
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{accentLine}</span>
          </h1>
          <p className="mx-auto mb-12 max-w-2xl text-lg font-light leading-relaxed text-muted-foreground md:text-xl">{subcopy}</p>
          <div className="flex flex-col items-center justify-center gap-6 sm:flex-row">
            <a
              href={primaryCta.href}
              className="group relative overflow-hidden px-10 py-5 text-xs font-black uppercase tracking-[0.2em] bg-foreground text-background transition-transform active:scale-95"
            >
              <span className="relative z-10">{primaryCta.label}</span>
              <div className="absolute inset-0 translate-y-full bg-primary transition-transform duration-300 group-hover:translate-y-0" />
            </a>
            <a
              href={secondaryCta.href}
              className="border border-foreground/20 px-10 py-5 text-xs font-black uppercase tracking-[0.2em] transition-all hover:border-primary/50 hover:bg-foreground/5"
            >
              {secondaryCta.label}
            </a>
          </div>
        </div>

        {metrics && metrics.length > 0 ? (
          <div className="absolute bottom-12 flex w-full max-w-7xl flex-wrap items-center justify-between gap-8 border-t border-foreground/5 px-6 pt-12">
            {metrics.map((m) => (
              <div key={m.label} className="flex flex-col items-start">
                <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-primary">{m.label}</span>
                <span className="font-mono text-2xl font-bold">
                  {m.value}
                  {m.unit ? <span className="ml-1 text-xs text-muted-foreground">{m.unit}</span> : null}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </main>
    </section>
  )
}
```

## Layout Details

- Maintain **generous vertical padding** so CTAs clear the optional metrics ribbon on small screens (stack metrics above fold or allow wrap).
- Headline tracking and weight are intentionally **dense and technical**; if the brief is softer, lighten weight but **keep additive field** as the visual anchor.

## Content Rules

- Eyebrow: short **status / launch / live-session** metaphors grounded in real product truths.
- Headline + accent: **two-line** climax; accent line carries the **novelty claim**.
- Metrics: swap demo numbers for **meaningful KPIs** (latency, seats, uptime, throughput) plausible for the vertical.

## Implementation Constraints

- `**use client`** for the Three.js subtree in App Router setups.
- **No CDN** Three.js or Tailwind loaders; no inline CDN `<script>` tags.
- Prefer **tailwind classes + CSS variables / theme tokens** over hard-coded marketing hex unless the tokens themselves encode brand.
- **No `<style jsx>`**; icons only through the project’s icon system when needed.

## Accessibility + Performance

- Respect `**prefers-reduced-motion**` as specified.
- Cap **DPR**; avoid allocating new `Vector3` objects inside the hot loop (reuse instances as in blueprint).
- **Decorative canvas**: `aria-hidden` on canvas; semantic `h1` in overlay.

