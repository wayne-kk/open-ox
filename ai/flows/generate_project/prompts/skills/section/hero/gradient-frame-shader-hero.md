# Component Skill: Hero — Gradient Frame + Three.js Shader Field + GSAP Word Reveal

Rounded dark card (~`75vh` + `min-height`): 1px gradient “chrome” frame, inner orthographic fullscreen quad + time-driven fragment shader (noise + horizontal streak), canvas `mix-blend-mode: screen`, dark scrim for copy. Foreground: icon row + GSAP/ScrollTrigger per-word rise (stagger). **Procedural shader only**—no GLB, particles, or external meshes.

Scope (hero only): this card + WebGL + copy/CTAs. No demo grids, feature strips, or extra sections from reference pages. No `<nav>` or site header inside the section.

## Core Effect

- Gradient frame: outer wrapper uses 1px padding or pseudo + diagonal light-to-transparent gradient; inner clip `rounded-[calc(radius-1px)]`.
- Shader layer: Three.js `WebGLRenderer` (`alpha: true`) in `#webgl-container`; orthographic camera `(-1,1,1,-1,0,1)`; single `PlaneGeometry(2,2)` with `ShaderMaterial`; uniforms `u_time`, `u_resolution` and color roles as `vec3` if needed. Fragment shader: noise mixes void + two accents + horizontal streak; colors from brief via uniforms, not fixed demo RGB.
- Blend + scrim: canvas ~80% opacity, `mix-blend-mode: screen`; above it `bg-gradient-to-t` (strong bottom to lighter top) for readable copy.
- Copy column: small icon + category line (`text-xs`, uppercase, tracking-widest, muted). Lower: `lg:flex-row` — left: stacked display words; each word in `overflow-hidden` + inner span for reveal. Right: paragraph + solid inverted CTA and arrow icon.
- Entrance: words start `translateY(120%)` + slight `rotateZ`; ScrollTrigger ~80% from top; stagger ~0.1s, ease `power3.out`, duration ~1.2s, or Framer Motion if GSAP is disallowed.

## Visual Language

- Atmosphere: infra / API product, cool void, warm or electric accents from primary/accent roles; tunable via uniforms or theme.
- Frame: page background warm off-white or neutral token; hero card is the dark island.

## Structure Requirements

1. DOM order (bottom to top): inner dark `bg` → canvas (z-0) → gradient overlay (z-0) → content column `justify-between` (z-10).
2. Border: double-radius wrapper so stroke is not a separate SVG unless the design system uses one.
3. Headline DOM: each animating word/phrase wraps in `overflow-hidden` + inner `inline-block` for transforms.
4. Resize: on window resize, update renderer size and `u_resolution`; on unmount cancel rAF, remove listeners, dispose geometry, material, renderer.

## Motion Direction

- Shader: continuous `u_time` in rAF; cap DPR (e.g. `min(devicePixelRatio, 2)`).
- Text: ScrollTrigger `start: "top 80%"` (or `85%`) once; no scrub by default.
- Reduced motion: final word state without y/rotate tween; slow or pause shader time; static shader frame acceptable.

## WebGL / Three.js (required for this id)

- Renderer: `alpha: true`, size to container `clientWidth`/`clientHeight` (not `window` unless full-bleed).
- Single fullscreen tri/quad; `depthWrite: false` on material if used as underlay.

## Required Implementation Blueprint (Do Not Skip)

1. MUST: rounded contained block with visible gradient hairline frame and inset dark surface (not full-bleed without card metaphor unless brief drops frame).
2. MUST: orthographic fullscreen quad + custom `ShaderMaterial`, `requestAnimationFrame`, update `u_resolution` on resize; dispose renderer, material, geometry; remove resize listener on unmount.
3. MUST: fragment colors via uniforms (or `u_palette`) bound to design tokens—not fixed demo `vec3`.
4. MUST: canvas `mix-blend-mode: screen` (or equivalent) and tuned opacity for additive read on dark field.
5. MUST: darkening gradient overlay above canvas, below text, for WCAG contrast on headline and CTA.
6. MUST: per-word masked rise (`overflow-hidden` parent, `inline-block` child from translateY 100–120% and small rotateZ to neutral); trigger on enter view with stagger; respect `prefers-reduced-motion`.
7. MUST: flex/grid so at `lg` headline block and subtext + CTA use two-column bottom alignment (`items-end` or tokens).
8. MUST: project icons (e.g. `lucide-react`); MUST NOT use Iconify CDN or raw external icon scripts.
9. MUST NOT: `<nav>` or site headers inside this section.
10. MUST NOT (hero-only): four-card grid, steppers, or stat widgets from reference pages.
11. MUST NOT: CDN scripts for Three, GSAP, Tailwind, Iconify; use npm imports.

If any MUST above is missing, the output is not valid for `gradient-frame-shader-hero`.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client";

import { Cpu, ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function GradientFrameShaderHero() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const webglRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<() => void>(() => {});

  useEffect(() => {
    const container = webglRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2);
    renderer.setPixelRatio(dpr);

    const uniforms = {
      u_time: { value: 0 },
      u_resolution: {
        value: new THREE.Vector2(container.clientWidth, container.clientHeight),
      },
      u_color_void: { value: new THREE.Vector3(0.02, 0.02, 0.04) },
      u_color_a: { value: new THREE.Vector3(0, 0.45, 0.55) },
      u_color_b: { value: new THREE.Vector3(0.95, 0.25, 0) },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `/* full-screen */ varying vec2 vUv; void main() { vUv=uv; gl_Position=vec4(position,1.0); }`,
      fragmentShader: `/* use noise + mix(u_color_*, u_time) — from spec */ uniform vec2 u_resolution; /* … */ void main() { gl_FragColor=vec4(0,0,0,1); }`,
      depthWrite: false,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    container.appendChild(renderer.domElement);

    const setSize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      uniforms.u_resolution.value.set(w, h);
    };
    setSize();
    const onResize = () => setSize();
    window.addEventListener("resize", onResize);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      uniforms.u_time.value += 0.01;
      renderer.render(scene, camera);
    };
    tick();

    cleanupRef.current = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      mesh.geometry.dispose();
      material.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
    return cleanupRef.current;
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.querySelectorAll(".reveal-word").forEach((el) => {
        gsap.set(el, { y: 0, rotateZ: 0 });
      });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.set(".reveal-word", { y: "120%", rotateZ: 2 });
      gsap.to(".reveal-word", {
        y: "0%",
        rotateZ: 0,
        duration: 1.2,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: { trigger: root, start: "top 80%" },
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="relative w-full">
      <section className="hero-section relative mb-0 h-[75vh] min-h-[600px] w-full overflow-hidden rounded-[2rem] p-px shadow-xl">
        <div
          className="pointer-events-none absolute inset-0 z-0 rounded-[2rem]"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.05) 100%)",
          }}
        />
        <div className="relative h-full w-full overflow-hidden rounded-[calc(2rem-1px)] bg-card">
          <div
            ref={webglRef}
            className="absolute inset-0 z-0 h-full w-full opacity-80 mix-blend-screen"
            aria-hidden
          />
          <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
          <div className="absolute inset-0 z-10 flex flex-col justify-between p-8 text-primary-foreground md:p-14 lg:p-20">
            <div className="flex items-center gap-2 text-primary-foreground/80">
              <Cpu className="size-4 text-primary" strokeWidth={1.5} aria-hidden />
              <span className="text-xs font-normal uppercase tracking-widest">
                Eyebrow from brief
              </span>
            </div>
            <div className="mt-auto flex flex-col items-start justify-between gap-12 lg:flex-row lg:items-end">
              <div className="max-w-4xl flex-1">
                <h1 className="flex flex-wrap items-center gap-x-4 gap-y-2 text-5xl font-light leading-[1.05] tracking-tighter text-primary-foreground md:text-7xl lg:text-8xl">
                  <span className="inline-block overflow-hidden pb-[0.1em]">
                    <span className="reveal-word inline-block">Headline one</span>
                  </span>
                  <span className="hidden h-0 w-full md:block" aria-hidden />
                  <span className="inline-block overflow-hidden pb-[0.1em]">
                    <span className="reveal-word inline-block">Headline two</span>
                  </span>
                  <span className="inline-block overflow-hidden pb-[0.1em]">
                    <span className="reveal-word inline-block text-primary-foreground/50">
                      Accent phrase
                    </span>
                  </span>
                </h1>
              </div>
              <div className="flex max-w-md flex-col gap-8 pb-2">
                <p className="text-sm font-light leading-relaxed text-primary-foreground/60 md:text-base">
                  Subcopy from brief
                </p>
                <a
                  className="group inline-flex w-max items-center justify-center gap-2 rounded-md bg-primary-foreground px-7 py-3.5 text-sm font-normal text-foreground transition-colors hover:bg-muted"
                  href="#"
                >
                  Primary CTA
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
```

Skeleton fixes: use valid `className="hidden h-0 w-full md:block"` on the line-break span; replace placeholder `fragmentShader` with real noise/streak GLSL and tokenized color uniforms; map `bg-card`, `text-primary-foreground`, etc. to the active theme. If GSAP is unavailable, use Framer Motion with staggered `variants` and `whileInView` while keeping the masked word DOM structure.

## Layout Details

- Card height: `75vh` + `min-h-[600px]` avoids too-short laptops; tune tokens on small viewports if copy is dense in one column.
- Padding `p-8` to `lg:p-20` gives space around the GPU field.

## Content Rules

- Eyebrow: capability or product pillar; headline: three beats (two bright lines, one dim); subcopy: B2B precision; CTA: verb + noun (framework, workspace, control plane).

## Implementation Constraints

- Bundle `three` and `gsap` if used; tree-shake; never `eval` shader strings from user input.
- Next.js `dynamic` import for the client block if SSR must not touch WebGL.

## Accessibility + Performance

- Decorative canvas: `aria-hidden`; single `h1` in section; CTA uses a real `href` when possible.
- Cap DPR; `antialias: false` is acceptable for a fullscreen quad; test on mobile; optional static poster if WebGL fails when the brief allows.

If the background is only CSS or video with no custom GLSL field, the output does not match this id.