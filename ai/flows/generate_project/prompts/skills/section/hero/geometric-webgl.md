# Component Skill: Hero — Geometric WebGL Frame

Use this skill when generating a hero section with a dark sci-fi UI frame, precision line-work, and a Three.js geometric mesh as the central visual layer.

The effect should feel like an analysis console: structural, technical, and premium.

## Core Effect

Build a full-viewport hero with:

- Outer dark canvas-like shell with subtle diagonal texture.
- Framed container with border lines, corner brackets, and measurement marks.
- Center-stage WebGL object (faceted geometry) rendered behind content.
- GSAP-powered reveal for badge, heading lines, paragraph, and CTA.

Keep the implementation self-contained in the hero component — no extra component files.

## Visual Language

1. **Dark analytical base**: near-black background (`#050508` or equivalent), low-opacity white lines.
2. **Architectural framing**: corner brackets, vertical guide lines, tiny corner pixels.
3. **Controlled glow**: indigo/violet accents for key labels and highlights.
4. **Depth layering**: texture layer -> frame -> WebGL scene -> radial blend -> content overlay.

## Structure Requirements

- **Hero shell (no navigation)** — **Do not** implement `<nav>`, logo+links header rows, hamburger menus, or site chrome. Those belong in the app layout, not this section.
- **Hero Main**:
  - Full-viewport hero area (`min-h-screen` class of constraint).
  - Absolute WebGL canvas container filling the hero.
  - Radial gradient overlay to blend edges into dark background.
- **Content Overlay**:
  - Top badge with vertical indicator line (revealed by animation).
  - Two-line headline with masked upward reveal.
  - Supporting paragraph with masked reveal.
  - Primary and optional secondary CTA per **CTA Button Styling** below (not a flat “corporate blue” pill).

## Motion Direction

Use GSAP + ScrollTrigger for staged reveal:

1. `.reveal-text` translateY from `110%` to `0%`.
2. `#reveal-badge` fade/slide in.
3. `#reveal-cta` fade/slide in.

Animation should be smooth, restrained, and high-end (no bouncy playful easing).

## WebGL Requirements (Three.js)

Scene setup should include:

- Perspective camera (around 45-55 FOV).
- Transparent renderer (`alpha: true`, antialias enabled).
- Main mesh: `IcosahedronGeometry` with low detail (`detail = 0` or similar faceted look).
- Material: `MeshStandardMaterial` with:
  - high metalness,
  - low/moderate roughness,
  - subtle emissive tint (indigo/violet family),
  - `flatShading: true`.
- Lighting set:
  - ambient light,
  - key directional light,
  - colored rim/back light,
  - optional point light for depth.

Interaction and loop:

- Mouse movement should **only** affect **rotation** (or a *very* small tilt), not horizontal translation. **Do not** move the mesh along X/Y for parallax; that shifts the polyhedron off-center and reads as a layout bug.
- Mesh keeps **world origin** `position.set(0, 0, 0)` as the rest pose; allowed motion is: autonomous rotation, optional **Y-only** float (`Math.sin` on `position.y` only, small amplitude).
- `camera.lookAt(0, 0, 0)` after setting `camera.position` so the composition stays centered in the frustum.
- Mesh has slow autonomous rotation and gentle vertical floating motion.
- `requestAnimationFrame` render loop.
- Handle resize: camera aspect + renderer size update.
- Cleanup on unmount: remove listeners, cancel RAF, dispose renderer/geometry/material.

## Required Implementation Blueprint (Do Not Skip)

When this skill is selected, the generated hero MUST include all of the following:

1. A dedicated `canvas` node rendered **full-bleed behind content**: parent `relative min-h-screen w-full overflow-hidden`, canvas `absolute inset-0 h-full w-full` (and `block` if needed) so the draw buffer matches the visible box — **no** bottom/right anchoring of the canvas that would visually offset the scene.
2. A Three.js scene with `IcosahedronGeometry(1.2~1.5, 0)` and `MeshStandardMaterial` using `flatShading: true`.
3. At least 3 lights: ambient + key directional + colored rim/back light.
4. A render loop with:
  - autonomous rotation,
  - gentle **vertical-only** floating (`sin(elapsedTime)` on `position.y` only),
  - mouse driving **lerped rotation only** (no `mesh.position.x` / `mesh.position.z` from pointer).
5. Proper lifecycle safety:
  - `useEffect` setup and teardown,
  - `cancelAnimationFrame`,
  - remove listeners,
  - `renderer.dispose()`,
  - `geometry.dispose()` and `material.dispose()`.
6. GSAP staged reveal for badge, heading text lines, and CTA.
7. **MUST NOT** add top navigation, persistent header links, or mobile menu affordances inside this section.
8. Primary CTA and hover states follow **CTA Button Styling** — including **clipped shine**: any “light sweep” / sheen must read **inside** the button shape, not as a glow sitting outside it.

If any item above is missing, the result is NOT considered a valid geometric-webgl implementation.

## CTA Button Styling (Primary + Secondary)

The hero is **dark, technical, indigo/violet–accented**. Buttons must match that language — not a flat mid-blue (e.g. periwinkle `#6371D6` only) with a basic darkening hover.

**Primary CTA (main action, e.g. “立即开始 / 试用”)**

- **Base**: `inline-flex` / `items-center` / `gap-2` / `rounded-xl` or `rounded-2xl` (12–16px), generous horizontal padding (`px-6`~`px-8`, `py-3`~`py-3.5`).
- **Fill**: **linear gradient** on-brand — e.g. `from-violet-600` → `to-indigo-600` (or `from-indigo-500` → `to-violet-600`), **or** a deep indigo base plus `bg-gradient-to-r` overlay so it is never a single solid swatch.
- **Edge**: very subtle `ring-1` / `ring-inset` in `white/10` or `violet-400/20` so the control reads as a **lit panel**, not a flat rectangle.
- **Text + icon**: `text-white` / `font-medium`; trailing chevron (e.g. `lucide-react` `ChevronRight`, `h-4 w-4`); `group` on the `<a>` or `<button>` for `group-hover:` on the icon.
- **Shadow**: soft lift — e.g. `shadow-lg shadow-violet-500/20` (or `shadow-indigo-900/40`), not a heavy gray drop that fights the frame.
- **Hover (required pattern — pick a coherent combo)**:
  - Slightly **brighter gradient** (e.g. `hover:from-violet-500 hover:to-indigo-500`) and/or
  - **Inner glow** (see **Shine / sweep** below) — not a second halo **outside** the pill, and/or
  - **Subtle lift**: `hover:-translate-y-0.5` with `transition duration-300 ease-out` and `active:translate-y-0`
  - **Avoid as the only hover**: `hover:bg-blue-700` on a single flat `bg-blue-600` — that reads as generic admin UI, not this hero.
  - **Avoid**: stacking `ring-2` / `shadow-lg` on hover in a way that makes the *highlight* look like it lives **around** the button but not on its surface. Prefer **inset** treatments for “light on the glass.”

**Shine / light sweep (critical — 光影必须在按钮*内部*)**

A common failure: a diagonal or moving gradient is applied to an element **larger** than the control, or the button has no `overflow-hidden`, so the sweep reads as a band **beside** or **around** the button. Fix the structure, not the color:

1. **Clipping root**: the interactive node that carries `rounded-xl` / `rounded-2xl` must be `relative overflow-hidden` so **all** decorative layers (shine, specular) are **masked** to the same rounded rect.
2. **Sheen layer as child**: put the moving sweep on an **absolutely positioned child**: `absolute inset-0` (or `inset-0 -translate-x-full` → animate to `translate-x-full` for a pass), `pointer-events-none`, **low opacity** (e.g. `from-white/0 via-white/25 to-white/0`), and **z-index** below label/icon (`z-0` for sheen, `relative z-10` for text).
3. **Do not** attach the sweep to a **wrapper** that is `w-full` of a row, or to a `::before` on a parent section — that makes the “light” appear **outside** the pill.
4. If using GSAP: animate **only** the sheen `div`’s `translate`/`opacity`/`xPercent` **inside** the clipped button, not a parent `motion.div` that spans the whole hero.
5. **Outer** `shadow` / `ring-offset` for depth is optional on the **same** `overflow-hidden` node or an outer wrapper; if using a double wrapper, the inner one must still clip the sheen. Prefer: **one** rounded, `overflow-hidden` surface for gradient + sheen, then `shadow-sm` on that same node so shadow doesn’t look like the “sweep” leaking out.

**Secondary CTA (e.g. “查看演示”)**

- **Base**: `rounded-xl`~`2xl`, `border border-white/15` (or `border-violet-400/30`), `bg-white/5` or `bg-transparent`, `text-white/90`, optional `backdrop-blur-sm`.
- **Hover**: `hover:border-white/30 hover:bg-white/10`, text stays readable; no primary-gradient fill (keep hierarchy clear).

**Interaction shell**

- Wrap CTAs in a container with `pointer-events-auto` (hero overlay is otherwise `pointer-events-none` for decorative layers).
- Focus visible: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950`.

**Reference structure (shiny primary — sheen *inside* the pill):**

```tsx
{/* Clipping + gradient on same node; sheen is a child with absolute inset-0 */}
<a
  href="..."
  className="group relative inline-flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-7 py-3.5 text-sm font-medium text-white shadow-lg shadow-violet-500/25 ring-1 ring-inset ring-white/10 transition duration-300 ease-out hover:from-violet-500 hover:to-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
>
  {/* Sheen — only this layer moves; parent overflow-hidden clips it to the pill */}
  <span
    aria-hidden
    className="pointer-events-none absolute inset-0 z-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
  />
  <span className="relative z-10 inline-flex items-center gap-2">
    文案
    <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
  </span>
</a>
```

Use CSS or GSAP to drive a repeating sweep *only* on the inner `span` (or replace with `translateX` keyframes) — the important part is **parent `overflow-hidden` + `rounded-*` on the same element as the gradient**, sheen as `absolute inset-0` under `z-10` content.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

Use this as the minimum architecture pattern when generating the section:

```tsx
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function HeroSection() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    gsap.registerPlugin(ScrollTrigger);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const geometry = new THREE.IcosahedronGeometry(1.3, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      metalness: 0.85,
      roughness: 0.22,
      emissive: 0x1e1b4b,
      emissiveIntensity: 0.55,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, 0);
    scene.add(mesh);

    scene.add(new THREE.AmbientLight(0xffffff, 0.28));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(4, 5, 4);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xa855f7, 2.2);
    rimLight.position.set(-4, -2, -3);
    scene.add(rimLight);

    const targetMouse = new THREE.Vector2(0, 0);
    const currentMouse = new THREE.Vector2(0, 0);
    const onMouseMove = (event: MouseEvent) => {
      targetMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      targetMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", onMouseMove);

    const onResize = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth === 0 || clientHeight === 0) return;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight, false);
    };
    onResize();
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let rafId: number | null = null;
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      currentMouse.x += (targetMouse.x - currentMouse.x) * 0.05;
      currentMouse.y += (targetMouse.y - currentMouse.y) * 0.05;

      mesh.rotation.x = elapsed * 0.18 + currentMouse.y * 0.35;
      mesh.rotation.y = elapsed * 0.26 + currentMouse.x * 0.35;
      mesh.position.y = Math.sin(elapsed * 1.4) * 0.12;
      // Keep X at 0 so the polyhedron stays horizontally centered; mouse only via rotation
      mesh.position.x = 0;

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };
    animate();

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top 70%",
      },
      defaults: { ease: "power4.out" },
    });
    tl.to(".reveal-text", { y: "0%", duration: 1.1, stagger: 0.14 })
      .to("#reveal-badge", { opacity: 1, y: 0, duration: 0.9 }, "-=0.75")
      .to("#reveal-cta", { opacity: 1, y: 0, duration: 0.9 }, "-=0.6");

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      tl.scrollTrigger?.kill();
      tl.kill();
      geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
      renderer.dispose();
    };
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen w-full overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 block h-full w-full"
        aria-hidden
      />
      {/* content overlay: absolute inset-0 flex items-center justify-center ... */}
    </section>
  );
}
```

### Notes for adaptation

- Keep this pattern, but replace copywriting/content with project-specific content and target language.
- Do not use CDN scripts; use package imports.
- Do not use `iconify-icon`; use project icon libraries (e.g. `lucide-react`).
- Do not use `<style jsx>`; rely on Tailwind utilities and existing global styles.

## Layout Details

- **WebGL / viewport alignment**: The Three.js camera targets world origin; the mesh lives at `(0, 0, 0)`. On resize, update `camera.aspect` from the **hero container** (`containerRef.clientWidth` / `clientHeight`), then `setSize` the renderer to the same values so the frustum’s centerline matches the section’s center — the polyhedron must read as **centered behind the headline**, not parked in a corner.
- Preserve `overflow-x-hidden`, `min-h-screen`, and smooth-scrolling-friendly layout.
- Use a centered max-width shell (`max-w-[1400px]` or similar) with vertical border rails.
- Add optional one-third vertical guide lines on desktop for blueprint rhythm.
- Keep content overlay centered and pointer-events disabled except CTA area.
- Maintain clear text readability above WebGL layer.

## Content Rules

- Headline must be project-relevant and concrete (no placeholders).
- Supporting copy should describe product value in one tight paragraph.
- CTA text should be action-oriented and specific.
- Avoid generic buzzwords if the project brief provides domain language.

## Implementation Constraints

- Output only raw TSX.
- Must be a Client Component (`"use client"`).
- Use React hooks only (`useEffect`, `useRef`) for lifecycle.
- Prefer existing project deps (`three`, `gsap`, `ScrollTrigger`) if available.
- Do not inject CDN `<script>` tags.
- Do not use `iconify-icon` web component directly; use project icon system (for example `lucide-react`) or simple inline SVG.
- Keep all styles in Tailwind utility classes plus minimal inline style for gradients/clip-path only.

## Accessibility + Performance

- Respect `prefers-reduced-motion` for non-essential motion.
- Ensure decorative lines are `pointer-events-none`.
- Keep frame decoration lightweight (avoid excessive DOM duplication).
- Cap renderer pixel ratio (`Math.min(devicePixelRatio, 2)`).

## Suggested Output Path

`components/ui/hero-geometric-webgl.tsx` (or project-specific hero section path).