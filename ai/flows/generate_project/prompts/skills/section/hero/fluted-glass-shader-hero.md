# Component Skill: Hero — Full-Viewport “Fluted Glass” Shader + Logo / Rule / Type Stack

Use this skill when `generateSection` should deliver a **cinematic, edge-to-edge** first screen: a **100% width / height** (or `min-h-screen` **locked**) **WebGL** layer built as a **single orthographic fullscreen quad** whose **fragment shader** simulates **vertical ribbed / fluted glass** (cylinder-slice **normals**, **seams**, **specular** highlights, **refraction**-style **UV nudge**) over a **time-animated** **fluid blob** **field** in a **dark biotic** palette. The **UI** is a **lightweight overlay**: **custom logomark** (SVG) **+** a **vertical rule** **+** **eyebrow** (mono **icon** + **uppercase** **tracking**) **+** a **tight** **display** **headline** with an optional **forced** **line** **break**—**left-aligned** and **spaced** from the top **inset**. **No** **rounded** **bento** **frame**, **no** **GSAP** **word** **masking**, **no** **scroll-driven** text choreography—**unless** the brief layers them in **addition**; this **`id`** is **valid** with **static** **copy** and **only** the **shader** **in** **motion**.

**Scope — hero only:** The reference page is **already** hero-sized; the section **MUST** **not** **pull** in **subsequent** **landings** **blocks**. **If** **global** **nav** or **CTA** **rows** **are** **required**, they **should** be **siblings** in the **page** **layout** **or** the **app** **shell**, **not** **mandatory** **inside** this **section** **for** `fluted-glass-shader-hero`.

## Core Effect

- **Fluted / ribbed** **glass** **read** — **Screen-space** **vertical** **bands** with **a** **normal** **approximation** (rounded **cylinder** **slice**), **darker** **seams**, and **a** **shallow** **horizontal** **UV** **shift** to **mimic** **refraction**.
- **Blob** **field** — **Two** or **more** **radial** **“masses”** **animated** with **`u_time`** (sin/cos), **blended** with **smoothstep** to **mix** **multiple** **base** **colors**; **optional** **core** **glow** and **a** **slow** **vertical** **sweep** **for** **life**.
- **Shading** — **Blinn-Phong**-**style** or **simplified** **spec** **on** the **rib** **normal**; **vignette** to **tighten** **focus** **to** **center** **(optional** **per** **brief**).
- **Overlay** **cluster** — **Vector** **mark** ( **`currentColor`** for **theming** ) **+** **1–2px** **vertical** **bar** with **low** **shadow** **(tokenized)** **+** **eyebrow** in **primary** or **chart** **accent** **role** **+** **h1** in **strong** **foreground** on **void**.

## Visual Language

- **Atmosphere** — **Deep** **algae**-to-**black** **void** with **acid** **or** **lime** **accents** on **chrome**; **all** **RGB** in **GLSL** **should** be **driven** by **uniforms** (or a **small** **palette** **struct**) **so** the **output** can **obey** **shadcn**-**style** **tokens** **or** **brand** **brief**s—**not** the **one-off** **NX9** **greens** in **the** **source**.
- **Figure** / **ground** — **Type** and **icon** are **the** **only** **sharp** **elements**; **keep** **drop** **shadow** on **type** **subtle** **so** the **Shader** **remains** **the** **hero** **(literally** **and** **hierarchically**).

## Structure Requirements

1. **Z-order** — Canvas `absolute` or `fixed` `inset-0` at `z-0`; content `relative` `z-10`. Whether the page uses `overflow: hidden` on `html`/`body` (as in the reference) is a product decision: if a full view lock is not desired, use `min-h-screen` on the section and allow page scroll; avoid trapping focus or scroll in a way that breaks accessibility.
2. **Pointer events** — The source sets `pointer-events-none` on the overlay so the background reads as the focus; if the section includes links or buttons, set `pointer-events-auto` on those elements only.
3. **Logo** — Inline SVG or imported asset; `currentColor` and token-based sizing so the mark matches theme.

## Motion Direction

- **Time** only — **Continuous** **`u_time`** in **rAF** **loop**; **no** **ScrollTrigger** **required** **for** **this** **`id`**.
- **Reduced motion** — Option A: freeze `u_time`; Option B: run the loop at ~0.1× speed. Avoid rapid high-chroma pulsing; cap contrast modulation if the brief requires extra safety.

## WebGL / Three.js

- **Renderer** on the page `<canvas>` or a ref-mounted element; `antialias: false` is acceptable for a single quad.
- **Resize** on `window`: `setSize` and `u_resolution`; cap DPR at 2 to match the reference performance target.

## Required Implementation Blueprint (Do Not Skip)

1. **MUST** implement a full-viewport (or full-bleed) orthographic WebGL background with one fullscreen quad and a custom `ShaderMaterial`.
2. **MUST** in the fragment shader (optionally in sibling `.glsl` files) combine: (a) a vertical **ribbed / fluted** term, (b) a **time-animated** fluid blob (or similar) field mixed with it, and (c) specular and optional vignette so the read is “shaped glass,” even if the math is a modest approximation of the source.
3. **MUST** pass brand-critical color roles (base, mid, bright, highlight) as GLSL `uniform` vectors and document how they map to the design system so generated code does not rely on unlabeled demo `vec3` literals.
4. **MUST** drive `u_time` in a `requestAnimationFrame` loop, render each frame, and on unmount cancel the loop, remove the `resize` listener, and `dispose()` geometry, material, and renderer.
5. **MUST** set `u_resolution` on init and on every resize, and avoid `setSize` with zero width/height.
6. **MUST** build the left cluster as: (a) a brand mark (SVG with `currentColor`), (b) a vertical 1–3px rule using `border` or `bg` tokens, (c) an eyebrow with a small icon (e.g. `Cpu` from `lucide-react`, not Iconify), and (d) a single `h1` (or the heading level the layout requires for a11y).
7. **MUST** load `three` and all icons from the app bundle (no CDN `<script src="https://...">` for Three, Tailwind, or Iconify).

If any **MUST** item is missing, the output is **not** valid for `fluted-glass-shader-hero`.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client";

import { Cpu } from "lucide-react";
import { useEffect, useRef } from "react";
import * as THREE from "three";

// Import fragment+vertex as raw strings in your bundler, or from .glsl files.
const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float u_time;
  uniform vec2 u_resolution;
  uniform vec3 u_color_dark;
  uniform vec3 u_color_mid;
  uniform vec3 u_color_bright;
  uniform vec3 u_color_highlight;
  varying vec2 vUv;
  // ... implement flutes + blobs + spec + vignette; map colors from uniforms only.
  void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
`;

export function FlutedGlassShaderHero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    const dpr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(dpr);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          u_time: { value: 0 },
          u_resolution: { value: new THREE.Vector2(1, 1) },
          u_color_dark: { value: new THREE.Vector3(0.01, 0.06, 0.02) },
          u_color_mid: { value: new THREE.Vector3(0.1, 0.4, 0.05) },
          u_color_bright: { value: new THREE.Vector3(0.3, 0.7, 0.1) },
          u_color_highlight: { value: new THREE.Vector3(0.6, 0.85, 0.2) },
        },
      }),
    );
    scene.add(mesh);

    const mat = mesh.material as THREE.ShaderMaterial;
    const t0 = performance.now();

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      mat.uniforms.u_resolution.value.set(w, h);
    };

    const loop = (t: number) => {
      frameRef.current = requestAnimationFrame(loop);
      mat.uniforms.u_time.value = (t - t0) * 0.001;
      renderer.render(scene, camera);
    };

    resize();
    window.addEventListener("resize", resize);
    frameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      mesh.geometry.dispose();
      mat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <section className="relative h-screen w-full overflow-hidden bg-background text-foreground">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 block h-full w-full"
        aria-hidden
      />
      <main className="pointer-events-none relative z-10 h-full w-full p-8 md:p-16 lg:p-[4.5rem]">
        <div className="flex items-start gap-5 md:gap-7 lg:gap-8">
          <svg
            className="size-14 shrink-0 text-primary-foreground drop-shadow-2xl md:size-20 lg:size-[5.25rem]"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M16 8C19.5 14.5 25.5 18 32 18C38.5 18 44.5 14.5 48 8C52.5 10.5 54.5 12.5 56 16C49.5 19.5 46 25.5 46 32C46 38.5 49.5 44.5 56 48C54.5 51.5 52.5 53.5 48 56C44.5 49.5 38.5 46 32 46C25.5 46 19.5 49.5 16 56C11.5 53.5 9.5 51.5 8 48C14.5 44.5 18 38.5 18 32C18 25.5 14.5 19.5 8 16C9.5 12.5 11.5 10.5 16 8ZM32 24L40 32L32 40L24 32L32 24Z"
            />
          </svg>
          <div className="mt-0.5 h-[76px] w-[3px] shrink-0 bg-border drop-shadow-xl md:mt-1 md:h-[104px] md:w-1 lg:mt-1.5 lg:h-[116px]" />
          <div className="mt-1 flex flex-col gap-1.5 md:mt-1.5 md:gap-2">
            <div className="flex items-center gap-1.5 md:gap-2">
              <Cpu className="size-3.5 text-primary md:size-4" strokeWidth={1.5} />
              <span className="text-xs font-medium uppercase tracking-[0.15em] text-primary drop-shadow-md md:text-sm md:tracking-[0.2em]">
                Product pillar
              </span>
            </div>
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-primary-foreground drop-shadow-2xl md:text-6xl lg:text-7xl">
              Brand
              <br />
              Name
            </h1>
          </div>
        </div>
      </main>
    </section>
  );
}
```

Bind `u_color_*` from CSS variables or a theme hook in production; the `Vector3` values in the skeleton are structural stand-ins only. Replace the placeholder `fragmentShader` with the full ribbed-glass + blob GLSL (ported from the user snippet).

## Layout Details

- Generous padding (e.g. `p-8` scaling to `lg:px-[72px]` in the source) creates a safe gutter; add safe-area insets if the brief targets notched devices.

## Content Rules

- Eyebrow: infrastructure or product-pillar phrasing; headline: one or two lines (product + role)—all from the brief, not a fixed product codename from the sample.

## Implementation Constraints

- No Iconify or unbounded inline `<script>` from CDN. `three` must be a `package.json` dependency.

## Accessibility + Performance

- Mark the canvas decorative with `aria-hidden`. Keep a single logical `h1` in the view unless a parent layout already provides the page title.
- Cap DPR at 2. Optionally use a static WebP poster if WebGL context creation fails (when the brief allows degradation).

A hero that uses only static CSS or video without this ribbed GLSL field does **not** satisfy `fluted-glass-shader-hero`.
