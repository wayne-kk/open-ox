# Component Skill: Hero — Gradient Frame + Three.js Shader Field + GSAP Word Reveal

Use this skill when `generateSection` should deliver a **bento-style marketing hero**: a **large rounded rectangle** (heavy radius) with a **fake 1px “chrome” border** (outer gradient stroke), **dark inner field**, **full-viewport WebGL** as a **single orthographic quad** running a **time-animated fragment shader** (noise + horizontal streak read), `**mix-blend-mode: screen`** on the canvas, a **vignette-style** dark **gradient overlay** on top of the field, and **foreground copy** in **light text** with a **per-word masked rise** driven by **GSAP + ScrollTrigger** (stagger). **Icons and layout** follow a **control-plane / platform** tone. **No GLB geometry, particles, or external 3D assets**—only **procedural shader** output.

**Scope — hero only:** Ship **one** rounded hero block (height ~`75vh`with sensible`min-height`, max width within page grid). **Do not** include the **four-column micro-demo grid**, feature cards, or any `**`siblings** below the hero from source one-pagers. **Do not** place `<nav>`, site headers, or top link rows **inside** this section — only the **card + its inner WebGL + copy** (and CTAs) are in scope; global nav stays in the app shell.

## Core Effect

- **Gradient frame** — Outer wrapper uses a **1px padding** or **pseudo** technique with a **diagonal light-to-transparent** linear gradient so the rounded shape reads as **metallic / glass edge**; inner clip matches `rounded-[calc(radius-1px)]`.
- **Shader layer** — **Three.js** `WebGLRenderer` (`alpha: true`) fills `#webgl-container`; **orthographic** camera `(-1,1,1,-1,0,1)`; **single** `PlaneGeometry(2,2)` with `**ShaderMaterial`**; **uniforms** `u_time`, `u_resolution` (and **color roles** as `vec3` uniforms if needed). **Fragment** shader uses **simplex / classic noise** to mix **three** tonal roles (deep void + two accents) and **horizontal streak** energy; colors **map from brief** via uniforms—**not** hardcoded teal/orange RGB in production.
- **Blend + scrim** — Canvas at **~80% opacity**, `**mix-blend-mode: screen`**; above it, `**bg-gradient-to-t`** from **strong bottom** to lighter top so **body copy** stays readable.
- **Copy column** — Top row: **small icon** + **category line** (`text-xs`, `uppercase`, `tracking-widest`, **muted white**). Lower area: `**lg:flex-row`** — **left**: **stacked wrapped** **display** words in **light** weight, with one phrase in **dimmed** foreground; each **word** sits in `**overflow-hidden`** + inner **span** for the **reveal**. **Right**: **paragraph** + **solid** **inverted** CTA (white on black or **surface** per tokens) with **arrow** icon.
- **Entrance** — **Initial** state for words: `**translateY(120%)`** + slight `**rotateZ`**; **ScrollTrigger** fires when the **hero** enters **~80%** from top; **stagger** ~0.1s, **ease** `power3.out` class, **duration** ~1.2s—**or** equivalent with **Framer Motion** if the project bans GSAP (then document swap in constraints).

## Visual Language

- **Atmosphere** — High-end **infra / API** product: **cool void**, **warm or electric** shader accents from **primary** / **accent** roles; **always** tunable via uniforms or theme map.
- **Frame** — Page **background** is a **warm off-white** or **neutral** surface (token); the **hero card** is the **dark island**—contrast is **in the card**, not the whole viewport.

## Structure Requirements

1. **DOM order** (bottom → top): inner **dark** `bg` → **canvas** (z-0) → **gradient overlay** (z-0) → **content** flex column `justify-between` (z-10).
2. **Border trick** — Implement the **double-radius** wrapper so the **stroke** is **not** a separate SVG unless the design system already uses one.
3. **Headline DOM** — Each **word** (or phrase unit) that animates **independently** **MUST** wrap in `**overflow-hidden`** + inner `**inline-block`** target for the transform.
4. **Resize** — On `**window` `resize`**, update renderer size and `**u_resolution`**; on unmount **cancel** **rAF**, **remove** listeners, `**dispose()`** **geometry**, **material**, **renderer**.

## Motion Direction

- **Shader** — Continuous `**u_time`** increment in the **render loop**; keep **DPR** capped (e.g. `min(devicePixelRatio, 2)`).
- **Text** — **ScrollTrigger** `start: "top 80%"` (or `"top 85%"`) **once**; **no** scrub loop for the default spec.
- **Reduced motion** — Set words to **final** state **without** `y`/`rotate` tween; **pause** or **slow** shader time step if the brief allows; at minimum **static** shader frame is acceptable.

## WebGL / Three.js (required for this id)

- **Renderer**: `alpha: true`, size to **container** `clientWidth`/`clientHeight` (not `window` unless full-bleed).
- **No depth complexity**—single **fullscreen tri/quad**; `**depthWrite: false`** on material if used as **underlay**.

## Required Implementation Blueprint (Do Not Skip)

1. **MUST** implement the **hero** as a **rounded** (large radius) **contained** block with a **visible gradient “hairline” frame** and **inset** dark surface—**not** a full-bleed edge-to-edge without the card metaphor unless the brief explicitly drops the frame.
2. **MUST** mount a **Three.js** **orthographic** **fullscreen quad** with a **custom `ShaderMaterial`**, **animate** with `**requestAnimationFrame`**, and **update `u_resolution`** on **resize**; **MUST** **dispose** renderer, **material**, **geometry**, and **remove** `resize` listener on unmount.
3. **MUST** expose **fragment** accent / void **colors** via **uniforms** (or a single `u_palette` struct) so **generated code** can **bind** design tokens / brief—not **fixed** GLSL `vec3` constants copied from a demo.
4. **MUST** set the **canvas** layer to `**mix-blend-mode: screen`** (or project-approved equivalent) and **tuned opacity** so it reads **additive** over the **dark** inner field.
5. **MUST** add a **darkening gradient overlay** (stronger at **bottom** or per brief) **above** the canvas, **below** text, so **WCAG**-level contrast is achievable for **headline and CTA**.
6. **MUST** implement **per-word (or per-unit) masked rise**: **parent** `overflow-hidden`, **child** `inline-block` with **from** `**translateY(100%–120%)`** and **small** `**rotateZ`** **to** **neutral**; **MUST** trigger on **enter view** (ScrollTrigger, **IntersectionObserver**, or `whileInView`) with **stagger**; **MUST** respect `**prefers-reduced-motion`**.
7. **MUST** use `**flex` / `grid`** so on `**lg`** the **headline block** and **subtext + CTA** sit in a **two-column** **bottom** alignment (`items-end` or matching token).
8. **MUST** use project **icons** (e.g. `**lucide-react`**) for eyebrow, CTA arrow, and any chrome—MUST NOT use `**iconify-icon`**, **CDN** Iconify, or **unstyled** **external** **icon** scripts.
9. **MUST NOT** include `<nav>`, site headers, or top navigation links inside this section (only the rounded hero card + copy + CTAs).
10. **MUST** (hero-only) **not** output the **four-card** feature grid, **steppers**, or **stat** widgets from reference marketing pages.
11. **MUST NOT** add `**<script src="https://…">`** for **Three, GSAP, Tailwind, or Iconify**; **import** from `**npm`** packages (`three`, `gsap` if used) in the app bundle.

If any of the **MUST** items is missing, the output is **not** valid for `gradient-frame-shader-hero`.

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
                Core Architecture
              </span>
            </div>
            <div className="mt-auto flex flex-col items-start justify-between gap-12 lg:flex-row lg:items-end">
              <div className="max-w-4xl flex-1">
                <h1 className="flex flex-wrap items-center gap-x-4 gap-y-2 text-5xl font-light leading-[1.05] tracking-tighter text-primary-foreground md:text-7xl lg:text-8xl">
                  <span className="inline-block overflow-hidden pb-[0.1em]">
                    <span className="reveal-word inline-block">Commanding</span>
                  </span>
                  <span className="hidden h-0 w-full md:block" aria-hidden />
                  <span className="inline-block overflow-hidden pb-[0.1em]">
                    <span className="reveal-word inline-block">High-Stakes</span>
                  </span>
                  <span className="inline-block overflow-hidden pb-[0.1em]">
                    <span className="reveal-word inline-block text-primary-foreground/50">
                      Infrastructures
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
                  Initialize Framework
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

**Fix the skeleton in doc:** replace the broken `className "` on the line-break `span` with a valid `className="hidden h-0 w-full md:block"`; replace placeholder `**fragmentShader`** with the project’s real noise/streak GLSL, keeping **color uniforms**; map `**bg-card`**, `**text-primary-foreground`**, etc., to the active theme. If GSAP is unavailable, use `**motion` / `framer-motion**` with **staggered** `variants` and `**whileInView`**—still **must** satisfy the **masked** **structure**.

## Layout Details

- **Card height** `75vh` + `**min-h-[600px]`** avoids **too-short** **laptops**; adjust via tokens on **small** **heights** if the brief is **dense** with **one** **column** **only**.
- **Padding** `p-8` → `lg:p-20` keeps **air** around **GPU** field.

## Content Rules

- Eyebrow: **capability** or **product pillar**; headline: **three beats** (two **white**, one **dim**); subcopy: **B2B** **precision**; CTA: **action verb** + **noun** (framework, workspace, control plane).

## Implementation Constraints

- **Bundled** `three` + `gsap` (if used); **Tree-shake** where possible; **no** `eval` of shader strings from **user** **input** in production.
- **Next.js** `dynamic` import for the **client** **block** if **SSR** must not touch **WebGL** **context**.

## Accessibility + Performance

- **Decorative** **canvas** `aria-hidden`; **h1** is the **sole** top-level **heading** in the **section**; **CTA** is a **link** with **real** `href` when possible.
- **GPU**: **DPR** cap, **antialias: false** acceptable for **full-screen** **quad**; **test** **battery** on **mobile**—optional **static** **poster** **image** **fallback** when **WebGL** **fails** (brief may require).

If the **background** is **only** **CSS** **or** **video** with **no** **custom** **GLSL** **field**, the output does **not** match this `id`.