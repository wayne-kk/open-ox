# Component Skill: Hero — Wireframe Torus Arch (Three.js)

Use this skill when `generateSection` needs a **commanding SaaS/community launch hero**: a **WebGL wireframe torus “gateway” arch** drifting above the viewport, softened by a **vertical gradient fade mask** into the page chrome, paired with **ambient radial glow**, **massive headline** (light-to-warm gradient fill from tokens), subdued subcopy, and a **pill primary CTA**. The reference page included a **global header with logo, nav links, chamfer CTAs, and Iconify menu** — **omit all of that** from this section; shell navigation belongs in layout, not here.

## Core Effect

- **Masked WebGL band**: renderer targets roughly the **upper ~75% of the hero viewport height** (`75vh` reference), full width, `**pointer-events-none`**, clipped/faded via `**mask-image` / `-webkit-mask-image`** linear gradient so the wireframe **dissolves before** the typography block (opaque at top → transparent toward ~60–100% depending on tuning).
- **Scene**: dual **nested `TorusGeometry` meshes**, both **wireframe** `MeshBasicMaterial`, stacked at the same pose: translated **above** scene origin on Y, rotated on X to read as an **arch** facing the viewer; **slow opposing `rotation.z` drift** plus **shared subtle breathing scale** driven by `**sin`** time.
- **Camera**: `**PerspectiveCamera`** placed **below** and **rear** (`z` pushed back, `y` negative reference), `**lookAt`** a focal point **above** origin so the rings arc through the upper frame (**monumental atrium** framing).
- **Ambient**: oversized **radial bloom** centered above content (cyan family in demo only)—implement as **CSS** behind WebGL (`pointer-events-none`), alpha from tokens.
- **Foreground content**: vertically centered `**main`** feeling with slight **negative top margin** offset (pull headline into arch—tune per safe area), `**text-center`**, one dominant word or short title at extreme scale (`text-7xl` → `**10rem`** class of scale on large breakpoints), **gradient text fill**, **muted body line**, **single high-contrast CTA** (reference: **filled light pill** on dark ground).

## Visual Language

- **Ground**: deep **cool void** (`background` token)—not pasted `#0a0f1a`.
- **Wireframe figure**: **outer ring** = brighter accent (primary/cyan role); **inner ring** = secondary cool accent, **lower opacity**, slightly **denser** tube feel via segment counts (reference: outer `32x180`, inner `16x120` order of magnitude).
- **Typography gradient**: **highlight top** → **soft warm lift** at bottom of glyph (reference metaphor only—map **warm stop** to brief, e.g. cream/tint from brand secondary).
- **Glow discipline**: keep WebGL **sub-line**; glow is **atmospheric**, not neon clutter.

## Structure Requirements

- **No site navigation** in this section: **no** `<header>` site chrome, **no** logo row, **no** link cluster, **no** hamburger, **no** Iconify.
- **Section root**: `relative`, full viewport height behavior (`min-h-screen` or `h-dvh` per project), **overflow** controlled so the arch **does not** cause horizontal scroll.
- **Layer order**:
  1. **Background** solid token.
  2. **Ambient radial** (absolute, centered, max dimension caps).
  3. **WebGL mount** (absolute, top-aligned, **height ≈ 75% of viewport** or matching design token).
  4. **Content column** (`relative z-10`): headline, subcopy, CTA.

## Motion Direction

- **WebGL**: continuous `**requestAnimationFrame`**; use `**THREE.Clock`** for elapsed time (reference pattern).
- **Breathing**: shared scale `1 + sin(t * 1.5) * 0.015` class amplitude—**reduce or disable** under `prefers-reduced-motion`.
- **Rotation**: outer **faster** negative Z than inner (reference scale `0.05` vs `0.03` rad/s order).
- **No scroll-driven requirement** in reference (page `overflow-hidden` demo)—product may allow scroll; if so, keep WebGL **fixed to hero section box**, not `position: fixed` to viewport, unless brief demands parallax.

## WebGL Requirements (Three.js)

- Import `**three`** from the app bundle (**no** CDN `r128` global).
- **Renderer**: `WebGLRenderer({ alpha: true, antialias: true })`; `**setPixelRatio(Math.min(devicePixelRatio, 2))`**.
- **Mount sizing**: `setSize(width, height)` where `height = hostHeight` (e.g. `container.clientHeight`), `**width = container.clientWidth`** — **not** raw `window` if the hero is inset.
- **Camera aspect**: `width / height` of the **same host box** used by the mask.
- **Dispose** on unmount: `cancelAnimationFrame`, remove resize listener, `geometry.dispose()` ×2, `material.dispose()` ×2, `renderer.dispose()`.

## Required Implementation Blueprint (Do Not Skip)

When this skill is selected, the generated hero MUST include all of the following:

1. **Masked WebGL host**: a dedicated container with **height ≈ 75% of the hero viewport** (same proportion as reference), **full width**, `**pointer-events-none`**, and **CSS mask** (`mask-image` + webkit prefix) **fading the canvas to transparent toward the bottom** so the wireframe does not hard-cut across copy.
2. **Dual torus wireframe pair**: **outer** `TorusGeometry` + **inner** `TorusGeometry` with **smaller tube** and **adjusted segment counts** so the inner reads as a **denser core**; both use `**MeshBasicMaterial` wireframe** with **theme-mapped colors** (outer brighter, inner dimmer — **no mandatory demo hex**).
3. **Shared rig**: both meshes share the **same** `position.y` lift and `**rotation.x` tilt** so they form one **arch**; both participate in the **same breathing scale** each frame.
4. **Opposing slow spin**: **outer** and **inner** **negative `rotation.z`** over time at **different rates** (outer faster).
5. **Camera staging**: **off-center camera** with `**lookAt`** targeting a point **above** the origin (reference: camera low/behind, focal point elevated) so the composition feels **upward and monumental**.
6. **Ambient glow layer**: **CSS radial gradient** blob (large max dimensions) **behind** WebGL, **very low** opacity, **cool accent** role from tokens.
7. **Typography stack**: **single-line or tightly controlled** display title at **extreme** responsive scale; **gradient text** using **token stops** (top light → bottom warm tint **per brief**).
8. **Body + CTA**: muted supporting paragraph (`max-width` readable), **one** rounded **filled** CTA with subtle **hover scale** and **soft outer shadow** (token-driven shadow color).
9. **Resize correctness**: on resize, update **renderer size** and **camera aspect** from the **WebGL host element**’s client dimensions; **skip** when width/height are zero.
10. `**prefers-reduced-motion`**: **no** continuous animation **or** freeze on first frame / disable breathing while allowing static render—**must not** ignore the media query.
11. **Integration hygiene**: **no** CDN Three, **no** CDN Tailwind, **no** Iconify; icons **not required** for this hero unless brief adds them via project system.
12. **No navigation chrome** inside the section output (no brand header row, no `nav` links, no mobile menu control).

If any item above is missing, the output is **NOT** valid for `wireframe-torus-arch-webgl`.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

function cssColor(property: string, fallback = "#ffffff") {
  if (typeof document === "undefined") return new THREE.Color(fallback)
  const raw = getComputedStyle(document.documentElement).getPropertyValue(property).trim()
  try {
    return new THREE.Color(raw.length > 0 ? raw : fallback)
  } catch {
    return new THREE.Color(fallback)
  }
}

type WireframeTorusArchHeroProps = {
  title: string
  subcopy: string
  cta: { label: string; href: string }
}

export function WireframeTorusArchHero({ title, subcopy, cta }: WireframeTorusArchHeroProps) {
  const webglHostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = webglHostRef.current
    if (!host) return

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000)
    camera.position.set(0, -6, 18)
    camera.lookAt(0, 6, 0)

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2))
    host.appendChild(renderer.domElement)

    const outerGeo = new THREE.TorusGeometry(14, 4, 32, 180)
    const outerMat = new THREE.MeshBasicMaterial({
      color: cssColor("--chart-1"),
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    })
    const torus = new THREE.Mesh(outerGeo, outerMat)
    torus.position.y = 10
    torus.rotation.x = Math.PI / 2.3
    scene.add(torus)

    const innerGeo = new THREE.TorusGeometry(14, 3.8, 16, 120)
    const innerMat = new THREE.MeshBasicMaterial({
      color: cssColor("--chart-2"),
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    })
    const innerTorus = new THREE.Mesh(innerGeo, innerMat)
    innerTorus.position.y = 10
    innerTorus.rotation.x = Math.PI / 2.3
    scene.add(innerTorus)

    const clock = new THREE.Clock()
    let raf = 0

    const setSize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    setSize()

    const onResize = () => setSize()
    window.addEventListener("resize", onResize)

    const animate = () => {
      raf = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()
      torus.rotation.z = -t * 0.05
      innerTorus.rotation.z = -t * 0.03
      const s = reduced ? 1 : 1 + Math.sin(t * 1.5) * 0.015
      torus.scale.setScalar(s)
      innerTorus.scale.setScalar(s)
      renderer.render(scene, camera)
    }

    if (reduced) {
      renderer.render(scene, camera)
    } else {
      animate()
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
      outerGeo.dispose()
      innerGeo.dispose()
      outerMat.dispose()
      innerMat.dispose()
      renderer.dispose()
      host.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <section className="relative flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      {/* Ambient glow — replace CSS vars / stops with brief tokens */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-30%] z-0 max-h-[1000px] max-w-[1000px] h-[min(100vw,1000px)] w-[min(100vw,1000px)] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--glow-accent)_0%,transparent_60%)] opacity-90"
      />

      <div
        ref={webglHostRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-0 h-[75vh] w-full [mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_40%,transparent_100%)]"
      />

      <main className="relative z-10 flex flex-grow flex-col items-center justify-center px-4 text-center [-webkit-tap-highlight-color:transparent]">
        <h1 className="flex select-none items-center justify-center bg-[linear-gradient(180deg,var(--hero-text-top)_30%,var(--hero-text-base)_100%)] bg-clip-text text-7xl font-semibold leading-none tracking-tighter text-transparent md:text-[10rem]">
          {title}
        </h1>
        <p className="mx-auto mt-8 max-w-lg text-base font-normal tracking-wide leading-relaxed text-muted-foreground md:text-lg">
          {subcopy}
        </p>
        <a
          href={cta.href}
          className="mt-10 rounded-full bg-foreground px-7 py-3.5 text-sm font-medium text-background shadow-[0_0_30px_rgb(var(--hero-cta-shadow)/0.15)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_40px_rgb(var(--hero-cta-shadow)/0.25)] active:scale-95"
        >
          {cta.label}
        </a>
      </main>
    </section>
  )
}
```

> **Implementer hooks**: define `--chart-1`, `--chart-2`, `--glow-accent`, `--hero-text-top`, `--hero-text-base`, `--hero-cta-shadow` on `:root` (or replace `cssColor` keys with theme tokens).

## Layout Details

- **Negative offset** (`-mt-[8vh]` reference): pull headline **upward** into arch; clamp on short viewports so CTA clears safe areas / notches.
- **Selection**: optional `selection:` utility with **subtle** contrast (tokenized).

## Content Rules

- Title works best as **one powerful word** or **two short words**; subcopy explains **community scale** or **platform reach** in plain language.
- CTA is **decisive** (“launch”, “join”, “start”)—avoid duplicating secondary nav actions removed from this section.

## Implementation Constraints

- `**use client`** for Three lifecycle.
- **No** `cdn.tailwindcss.com`, **no** `iconify-icon`, **no** global `THREE` script tag.
- **No** `<style jsx>` unless project standard.

## Accessibility + Performance

- Decorative WebGL: `aria-hidden` on host; **semantic** `h1` in `main`.
- **DPR cap** as in blueprint; avoid allocating new `Vector3` each frame in hot paths (not needed for this scene).
- **Reduced motion** path must not spin infinitely.

