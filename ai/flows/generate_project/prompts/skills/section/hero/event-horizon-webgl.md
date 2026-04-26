# Component Skill: Hero - Event Horizon WebGL

Use this skill when generating a hero section with a dark framed interface and a Three.js particle accretion disk (black-hole/event-horizon style) as the central visual atmosphere.

## Core Effect

Build a full-viewport hero with:

- Fixed WebGL canvas background rendering a rotating particle disk around an empty core.
- Subtle diagonal texture and radial darkening overlays above the canvas.
- Framed viewport shell with corner brackets and tiny measurement accents.
- Masked GSAP reveal for hero headline words.
- Foreground content using restrained glassmorphism (not heavy blur clutter).

## Visual Language

1. Near-black base (`#050507`-like) with cyan/violet luminous accents.
2. Structured frame geometry: thin rails, corner brackets, alignment ticks.
3. Deep-space atmosphere: radial fade to dark edges, additive particle glow.
4. Data-console tone: minimal, precise, technical, premium.

## Structure Requirements

- **Background Layer**
  - fixed canvas (`absolute/fixed inset-0`) behind all content.
  - radial and gradient overlays to control readability and depth.
- **Frame Layer**
  - perimeter border, 4 corner brackets, and tiny alignment guide marks.
- **Content Layer**
  - main hero copy + CTA group (and optional glass-side panel) — **no** site `<nav>`, link rows, or header bar inside this section.
  - optional right-side quote/system panel with subtle glass card treatment.

## Motion Direction

Use GSAP + ScrollTrigger for text reveal:

1. split headline by words into masked wrappers.
2. animate `.reveal-word` from `translateY(110%)` to `0%` with stagger.
3. keep easing restrained (`power4.out`), no spring bounce.

## Rendering Requirements

Three.js scene should include:

- perspective camera with slight top-down angle.
- transparent renderer (`alpha: true`, antialias enabled).
- particle disk using `BufferGeometry + PointsMaterial`:
  - dense particle field,
  - inner empty radius (event horizon),
  - additive blending,
  - low opacity glow.
- smooth camera parallax based on mouse position.
- slow disk rotation for ambient motion.

## Required Implementation Blueprint (Do Not Skip)

When this skill is selected, generated output MUST include:

1. a dedicated fixed canvas background for WebGL.
2. particle accretion disk logic with inner void and outer falloff.
3. mouse-influenced camera drift/parallax.
4. GSAP masked word reveal on hero heading.
5. frame language elements (corner brackets + guide ticks/rails).
6. **MUST NOT** include `<nav>`, top link rows, or site header chrome inside this section.
7. complete cleanup:
   - cancel RAF,
   - remove mouse/resize listeners,
   - dispose geometry/material/renderer.

If any item above is missing, this is not a valid `event-horizon-webgl` implementation.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export default function HeroSection() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!rootRef.current || !canvasRef.current) return;
    gsap.registerPlugin(ScrollTrigger);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(0, 4, 12);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 25000;
    const positions = new Float32Array(particlesCount * 3);
    const colors = new Float32Array(particlesCount * 3);
    const color = new THREE.Color();

    for (let i = 0; i < particlesCount; i += 1) {
      const r = 2.5 + Math.pow(Math.random(), 2) * 12;
      const theta = Math.random() * Math.PI * 2;
      const ySpread = Math.max(0, (1 - (r - 2.5) / 12)) * 1.5;
      const y = (Math.random() - 0.5) * ySpread;
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * r;

      const t = Math.max(0, 1 - (r - 2.5) / 10);
      color.setHSL(0.6 - t * 0.15, 0.9, 0.1 + t * 0.7);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particlesGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const disk = new THREE.Points(particlesGeometry, particlesMaterial);
    disk.rotation.x = Math.PI * 0.15;
    scene.add(disk);

    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    onResize();
    window.addEventListener("resize", onResize);

    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = (event: MouseEvent) => {
      mouseX = event.clientX / window.innerWidth - 0.5;
      mouseY = event.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("mousemove", onMouseMove);

    let rafId: number | null = null;
    const animate = () => {
      disk.rotation.y -= 0.0015;
      camera.position.x += (mouseX * 3 - camera.position.x) * 0.05;
      camera.position.y += (-mouseY * 3 + 4 - camera.position.y) * 0.05;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };
    animate();

    gsap.to(".reveal-word", {
      scrollTrigger: { trigger: ".reveal-text", start: "top 95%" },
      y: "0%",
      opacity: 1,
      duration: 1.2,
      stagger: 0.04,
      ease: "power4.out",
      delay: 0.2,
    });

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      particlesGeometry.dispose();
      particlesMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  return <section ref={rootRef} className="relative min-h-screen">{/* ... */}</section>;
}
```

## Layout Details

- keep hero as `min-h-screen` with layered fixed background.
- use subtle frame border and corner elements only; avoid noisy decoration.
- preserve text readability using radial dark overlays above canvas.
- keep foreground interactions crisp with small motion and low visual latency.

## Content Rules

- headline should communicate orchestration/unification/insight from complexity.
- body copy should be concise and specific, not generic sci-fi buzzword spam.
- CTA should be concrete and action-oriented.

## Implementation Constraints

- output raw TSX only.
- must be a client component.
- do not use CDN scripts.
- do not use `iconify-icon`; use project icon system (e.g. `lucide-react`) or inline SVG.
- do not use `<style jsx>`; rely on Tailwind utilities/global styles.

## Accessibility + Performance

- support reduced-motion fallback (disable or reduce non-essential animation).
- keep decorative frame/overlay elements `pointer-events-none`.
- cap pixel ratio to `Math.min(devicePixelRatio, 2)`.
- avoid excessive particle count when performance is poor (degrade gracefully).
