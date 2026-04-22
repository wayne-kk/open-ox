# Component Skill: Hero - Flowing Wisps WebGL

Use this skill when generating a hero section with a full-viewport WebGL background made of flowing wave wisps, plus a restrained glass capsule nav and centered product copy.

## Core Effect

Build a full-viewport hero with:

- near-dark base and subtle structural texture.
- full-screen fragment-shader wisps (multi-layer wave glow) behind content.
- compact glass pill navigation in the top region.
- centered headline, support copy, and two-action CTA group.

Keep the implementation self-contained in one section component.

## Visual Language

1. Atmosphere: dark technical canvas with soft luminous trails.
2. Palette strategy: use design-system roles (`background`, `foreground`, `primary`, `muted`) or theme variables; do not hardcode reference palette values.
3. Surfaces: restrained glassmorphism for nav and optional secondary CTA.
4. Rhythm: smooth, continuous flow motion (ambient, not noisy or chaotic).

## Structure Requirements

- **Background Layer**
  - absolute/fixed full-bleed canvas (`inset-0`) for WebGL rendering.
  - optional blend/opacity wrapper for subtle integration with content.
- **Foreground Shell**
  - top-centered pill nav with logo mark + concise links.
  - hero copy block centered with clear vertical hierarchy.
  - primary CTA + secondary CTA in a compact group.
- **Readability Layer**
  - use a soft dark overlay or radial fade so moving wisps never reduce text legibility.

## Motion Direction

Use two motion channels:

1. shader runtime motion:
  - animate layered sine/cosine wave paths over time.
  - blend multiple wisps with varying phase/frequency for depth.
2. UI micro-motion:
  - subtle hover transitions on nav links and CTAs.
  - avoid heavy parallax or aggressive camera moves.

## Rendering Requirements

Raw WebGL implementation should include:

- vertex shader for full-screen quad.
- fragment shader with:
  - normalized UV using `u_resolution`,
  - time-driven wave deformation (`u_time`),
  - multi-pass or looped wisp accumulation.
- uniforms at minimum: `u_time`, `u_resolution`.
- full-screen quad buffer and `TRIANGLE_STRIP` draw path.
- resize handling that updates viewport and uniforms.

Color logic must remain theme-driven:

- expose color controls through uniforms and/or CSS variables (for example `--hero-accent-a`, `--hero-accent-b`) mapped from brief tokens.
- treat shader colors as placeholders, not fixed brand colors from source snippets.

## Required Implementation Blueprint (Do Not Skip)

When this skill is selected, generated output MUST include:

1. a full-screen WebGL canvas background for the hero.
2. flowing multi-layer wisp lines (not static gradients).
3. shader loop using `u_time` + `u_resolution`.
4. glass pill nav + centered headline/copy/CTA composition.
5. cleanup safety:
   - cancel animation frame,
   - remove resize listeners,
   - delete GL resources created by the section (program/shaders/buffers when managed manually).
6. no CDN scripts, no `iconify-icon`, no `<style jsx>`.

If any item above is missing, this is NOT a valid `flowing-wisps-webgl` implementation.

## Reference TSX Skeleton (Adapt, Do Not Copy Blindly)

```tsx
"use client";

import { useEffect, useRef } from "react";

export default function HeroSection() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!rootRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const gl = canvas.getContext("webgl");
    if (!gl) return;

    const vsSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Map accent colors to design tokens/variables in production code.
    const fsSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec3 u_accentA;
      uniform vec3 u_accentB;

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        uv.y -= 0.5;
        uv.x *= u_resolution.x / max(u_resolution.y, 1.0);

        vec3 finalColor = vec3(0.0);
        for (float i = 1.0; i <= 6.0; i++) {
          float t = u_time * 0.3 + i * 0.15;
          float y = sin(uv.x * (1.5 + i * 0.2) + t) * 0.15 * cos(t * 0.5);
          y += cos(uv.x * (1.0 + i * 0.3) - t * 0.8) * 0.1;
          float glow = (0.0015 * i) / max(abs(uv.y - y), 0.0008);
          vec3 wispColor = mix(u_accentA, u_accentB, clamp(i / 6.0, 0.0, 1.0));
          finalColor += wispColor * glow;
        }
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const compileShader = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    if (!buffer) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uResolution = gl.getUniformLocation(program, "u_resolution");
    const uAccentA = gl.getUniformLocation(program, "u_accentA");
    const uAccentB = gl.getUniformLocation(program, "u_accentB");

    const readAccent = (name: string, fallback: [number, number, number]) => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      if (!raw) return fallback;
      const parts = raw.split(",").map((v) => Number(v.trim()));
      return parts.length === 3 && parts.every((v) => Number.isFinite(v))
        ? ([parts[0], parts[1], parts[2]] as [number, number, number])
        : fallback;
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    let rafId: number | null = null;
    const render = (time: number) => {
      if (uTime) gl.uniform1f(uTime, time * 0.001);
      if (uResolution) gl.uniform2f(uResolution, canvas.width, canvas.height);

      const accentA = readAccent("--hero-accent-a", [0.08, 0.45, 0.38]);
      const accentB = readAccent("--hero-accent-b", [0.65, 0.72, 0.9]);
      if (uAccentA) gl.uniform3f(uAccentA, accentA[0], accentA[1], accentA[2]);
      if (uAccentB) gl.uniform3f(uAccentB, accentB[0], accentB[1], accentB[2]);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafId = window.requestAnimationFrame(render);
    };
    rafId = window.requestAnimationFrame(render);

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return <section ref={rootRef} className="relative min-h-screen">{/* ... */}</section>;
}
```

## Layout Details

- keep `min-h-screen` hero with centered composition and generous vertical breathing room.
- place canvas below content (`z-0`) and UI layers above (`z-10+`).
- keep nav compact (`max-w-2xl` style capsule) to preserve focus on headline.
- maintain CTA grouping in one row on desktop and stacked on mobile.

## Content Rules

- headline should express capability/clarity in 2-5 words.
- support copy should communicate practical value, not hype.
- CTAs should be action-oriented (`Get Started`, `Try Demo`, `View API` style).

## Implementation Constraints

- output raw TSX only.
- must be client component (`"use client"`).
- no CDN script injection.
- no `iconify-icon`; use project icon system (for example `lucide-react`) or inline SVG.
- no `<style jsx>`; use Tailwind utilities and project globals.
- do not hardcode reference snippet colors as mandatory outputs; map accents to brief/design tokens.

## Accessibility + Performance

- support reduced-motion fallback (freeze or heavily reduce wisp animation).
- keep decorative layers `pointer-events-none`.
- throttle complexity on low-end devices (lower wave count or update frequency).
- guard WebGL unsupported cases with a static gradient fallback layer.
