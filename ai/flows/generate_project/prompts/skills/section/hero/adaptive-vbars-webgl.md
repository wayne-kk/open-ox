# Component Skill: Hero - Adaptive V-Bars WebGL

Use this skill when generating a hero section that combines a faceted Three.js core object, dynamic V-shaped luminous background bars, and a compact glass navigation shell.

## Core Effect

Build a full-viewport hero with:

- dark technical base and subtle grid texture.
- animated V-shaped vertical gradient bars in the background.
- center mini WebGL stage with faceted icosahedron core.
- masked headline reveal using GSAP + ScrollTrigger.
- clean, premium glass navigation capsule and restrained bracket framing.

Keep the implementation self-contained in a single section component.

## Visual Language

1. Base atmosphere: near-black (`#030303`-like) with low-opacity structural lines.
2. Accent palette: emerald + cyan highlights over white-neutral typography.
3. Frame vocabulary: rails, corner brackets, micro alignment marks.
4. Rhythm: minimal but alive - micro motion in bars and object.

## Structure Requirements

- **Frame Layer**
  - centered max-width rails with border-x.
  - corner dots/brackets and tiny alignment markers.
- **Nav Layer**
  - floating pill nav with subtle gradient border and blur.
- **Hero Core Layer**
  - dynamic V-bar background container.
  - center WebGL object container.
  - reveal headline + support copy + CTA group.

## Motion Direction

Use two motion systems:

1. GSAP masked reveal:
  - animate `.reveal-word` from `translateY(110%)` to `0%`.
  - slight stagger and `power4.out` easing.
2. Runtime ambient motion:
  - V-bars vertical oscillation with phase offset.
  - WebGL object slow rotation + floating.
  - optional subtle mouse influence (lerped) to camera/object for responsiveness.

## Rendering Requirements

Three.js setup should include:

- `PerspectiveCamera` with compact stage framing.
- transparent renderer (`alpha: true`, antialias enabled).
- core mesh: `IcosahedronGeometry(..., 0)`.
- material: `MeshStandardMaterial` or `MeshPhysicalMaterial` with `flatShading: true`.
- lights:
  - ambient light,
  - key directional light,
  - colored secondary/rim light.

## Required Implementation Blueprint (Do Not Skip)

When this skill is selected, generated output MUST include all of the following:

1. dynamic V-bar background with center-lower trough (V profile), not generic gradient strips.
2. faceted icosahedron WebGL core object.
3. GSAP masked word reveal on title.
4. frame language (rails + corner bracket/dot accents).
5. smooth ambient animation loop and typed cleanup.
6. no CDN scripts, no `iconify-icon`, no `<style jsx>`.

If any item above is missing, this is NOT a valid `adaptive-vbars-webgl` implementation.

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
  const barsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!rootRef.current || !canvasRef.current || !barsRef.current) return;
    gsap.registerPlugin(ScrollTrigger);

    // ---- Dynamic V-bars ----
    const barsHost = barsRef.current;
    const numBars = window.innerWidth > 768 ? 41 : 21;
    const centerIndex = Math.floor(numBars / 2);
    const bars: Array<{ el: HTMLDivElement; baseTop: number; phase: number }> = [];

    for (let i = 0; i < numBars; i += 1) {
      const wrap = document.createElement("div");
      wrap.className = "flex-1 h-full relative border-r border-white/5 last:border-0 overflow-hidden";

      const glow = document.createElement("div");
      glow.className = "absolute left-0 right-0 w-full";
      glow.style.height = "150vh";

      const distance = Math.abs(i - centerIndex);
      const baseTop = 30 + distance * (window.innerWidth > 768 ? 2.5 : 4);
      glow.style.top = `${baseTop}%`;
      glow.style.filter = "blur(4px)";
      glow.style.background =
        "linear-gradient(to bottom, rgba(3,3,3,1) 0%, rgba(16,185,129,0.7) 10%, rgba(255,255,255,0.9) 15%, rgba(6,182,212,0.8) 25%, rgba(3,3,3,1) 45%)";

      wrap.appendChild(glow);
      barsHost.appendChild(wrap);
      bars.push({ el: glow, baseTop, phase: distance * 0.2 });
    }

    // ---- Three.js ----
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 4;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const geometry = new THREE.IcosahedronGeometry(1.2, 0);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.9,
      roughness: 0.15,
      emissive: 0x047857,
      emissiveIntensity: 0.4,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      flatShading: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    scene.add(new THREE.AmbientLight(0xffffff, 0.2));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(5, 5, 5);
    scene.add(key);
    const rim = new THREE.PointLight(0x06b6d4, 5, 10);
    rim.position.set(-2, -2, 2);
    scene.add(rim);

    const resize = () => {
      const size = canvasRef.current?.parentElement;
      if (!size) return;
      const w = size.clientWidth;
      const h = size.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    window.addEventListener("resize", resize);

    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = (event: MouseEvent) => {
      mouseX = event.clientX / window.innerWidth - 0.5;
      mouseY = event.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("mousemove", onMouseMove);

    const clock = new THREE.Clock();
    let rafId: number | null = null;
    let t = 0;
    const animate = () => {
      t += 0.02;
      for (const bar of bars) {
        const wave = Math.sin(t + bar.phase) * 3;
        bar.el.style.top = `${bar.baseTop + wave}%`;
      }

      const elapsed = clock.getElapsedTime();
      mesh.rotation.y = elapsed * 0.3 + mouseX * 0.2;
      mesh.rotation.x = elapsed * 0.15 + mouseY * 0.15;
      mesh.position.y = Math.sin(elapsed * 2) * 0.1;
      key.position.x = Math.sin(elapsed * 0.5) * 5;
      key.position.z = Math.cos(elapsed * 0.5) * 5;

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };
    animate();

    gsap.fromTo(
      ".reveal-word",
      { y: "110%", rotation: 2, opacity: 0 },
      {
        y: "0%",
        rotation: 0,
        opacity: 1,
        duration: 1.2,
        ease: "power4.out",
        stagger: 0.1,
        scrollTrigger: { trigger: "#reveal-title", start: "top 85%" },
      }
    );

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      while (barsHost.firstChild) barsHost.removeChild(barsHost.firstChild);
      geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else {
        mesh.material.dispose();
      }
      renderer.dispose();
    };
  }, []);

  return <section ref={rootRef} className="relative min-h-screen">{/* ... */}</section>;
}
```

## Layout Details

- use `min-h-screen` and center-focused composition.
- preserve frame shell and corner accents at low opacity.
- keep bar motion behind content with mask fade at top/bottom.
- maintain clear text readability over moving background.

## Content Rules

- headline should express adaptive intelligence in concise terms.
- support copy should emphasize practical value, not generic hype.
- CTA labels should be specific and action-oriented.

## Implementation Constraints

- output raw TSX only.
- must be client component (`"use client"`).
- no CDN script injection.
- no `iconify-icon`; use project icon system (for example `lucide-react`) or inline SVG.
- no `<style jsx>`; use Tailwind utilities and project globals.

## Accessibility + Performance

- support reduced-motion fallback for bars/object reveal.
- keep decorative layers `pointer-events-none`.
- cap pixel ratio with `Math.min(devicePixelRatio, 2)`.
- tune particle/bar complexity for stable frame rate.

