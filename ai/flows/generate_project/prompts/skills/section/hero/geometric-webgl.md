# Component Skill: Hero — Geometric WebGL Frame

For a hero with dark chrome frame lines, subtle texture, and a centered Three.js faceted mesh (e.g. icosahedron) behind copy. Client-only; GSAP reveal optional. No `<nav>` in section.

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
  - Absolute WebGL canvas layer **filling the hero and visually centered**: wrapper `absolute inset-0`, canvas `block h-full w-full` (avoids inline-element baseline gap and edge misalignment). Geometry stays **world-origin centered** — use **rotation** for pointer parallax, not horizontal `position.x` drift.
  - Radial gradient overlay to blend edges into dark background.
- **Content Overlay**:
  - Top badge with vertical indicator line (revealed by animation).
  - Two-line headline with masked upward reveal.
  - Supporting paragraph with masked reveal.
  - CTA button with subtle gradient hover sweep.

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

- Mouse movement softly influences **rotation only** (lerped target vector); **do not** translate the mesh on **X** for pointer follow — that reads as off-center background. Optional: tiny **Y-only** bob (`sin(time)`) around `y = 0`.
- Mesh has slow autonomous rotation and gentle vertical floating motion; keep `position.x` and `position.z` at 0 so the faceted form stays framing the viewport midpoint.
- `requestAnimationFrame` render loop.
- Handle resize: camera aspect + renderer size update.
- Cleanup on unmount: remove listeners, cancel RAF, dispose renderer/geometry/material.

## Required Implementation Blueprint (Do Not Skip)

When this skill is selected, the generated hero MUST include all of the following:

1. A dedicated `canvas` node rendered behind content: parent `absolute inset-0`, canvas `className` includes `block h-full w-full` (plus `pointer-events-none` if desired).
2. A Three.js scene with `IcosahedronGeometry(1.2~1.5, 0)` and `MeshStandardMaterial` using `flatShading: true`.
3. At least 3 lights: ambient + key directional + colored rim/back light.
4. A render loop with:
  - autonomous rotation,
  - gentle floating on **Y only** (`sin(elapsedTime)` at `x=0`, `z=0`),
  - mouse-driven **rotation** only (lerped smoothing) — **no** mesh `position.x` / horizontal drift.
5. Proper lifecycle safety:
  - `useEffect` setup and teardown,
  - `cancelAnimationFrame`,
  - remove listeners,
  - `renderer.dispose()`,
  - `geometry.dispose()` and `material.dispose()`.
6. GSAP staged reveal for badge, heading text lines, and CTA.
7. **MUST NOT** add top navigation, persistent header links, or mobile menu affordances inside this section.

If any item above is missing, the result is NOT considered a valid geometric-webgl implementation.

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
      mesh.position.set(0, Math.sin(elapsed * 1.4) * 0.12, 0);

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
    <section ref={containerRef} className="relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
      {/* frame + gradient overlay + content */}
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

- Preserve `overflow-x-hidden`, `min-h-screen`, and smooth-scrolling-friendly layout.
- **WebGL centering checklist**: resize handler uses **hero container** `clientWidth` / `clientHeight` (same box as `inset-0` canvas); after any camera move, `camera.lookAt(0, 0, 0)`; mesh anchor at origin with **no X translation** from input.
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