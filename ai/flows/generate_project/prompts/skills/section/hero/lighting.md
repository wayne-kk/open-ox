# Component Skill: Hero — Lighting / Shader

Use this skill when generating a hero section that features a WebGL-based lightning, shimmer, or ambient glow effect as the primary visual. The hero should feel immersive, tech-forward, and customizable.

## Design Principles

1. **Code-generated visuals** — The main visual is 100% code (WebGL shaders), not images. Emphasize that it can be customized.
2. **Interactive control** — Provide at least one interactive control (e.g. hue slider) so users can adjust the effect.
3. **Layered depth** — Combine shader layer, gradient orbs, and content in clear z-order. Content must remain readable.
4. **Dark-first** — Lighting effects read best on dark backgrounds. Default to black or near-black.

## Non-Negotiable Acceptance Checklist

When this skill is selected, the generated section MUST satisfy all items below:

1. Must be a client component with `"use client"`.
2. Must include real WebGL shader/runtime logic (`canvas.getContext("webgl" | "webgl2")` + shader setup), not only Canvas2D imitation.
3. Must expose at least one interactive control that changes lighting color (e.g., hue slider).
4. Must wire the control to rendering state/uniforms (e.g., `uHue` or equivalent).

## Structure Requirements

- **Headline**: 6–12 words. Use `font-display`. Strong, memorable wordmark or tagline.
- **Subheading**: 1–2 sentences. Use `font-body`. Clarify the value and that the effect is customizable.
- **CTA block**: Primary and optional secondary CTA. Use `font-body` with label-style utilities (size/weight/tracking).
- **Interactive control**: Hue slider or similar to adjust the lightning color. Use `ElasticHueSlider` pattern (see Implementation Reference).
- **Feature badges**: Optional floating labels (e.g. "React", "Tailwind", "Shaders") positioned around the hero. Use `FeatureItem` pattern.
- **Visual layer**: WebGL `Lightning` canvas as a section-local background layer; optional gradient orbs and geometric accents for depth.

## Layout Patterns

- **Section-local overlay**: Shader background must stay inside the section wrapper and follow the section brief's rhythm/spacing.
- **Feature badges**: Position 2–4 feature labels (name + value) at corners or sides with staggered animation. Use `position` classes like `left-0 top-40`, `right-1/4 top-24`.
- **No shell takeover**: Do not introduce standalone navigation/app-shell structures inside the section.

## Typography Hierarchy

- `font-display` → Hero headline.
- `font-header` → Subheadline, gradient text.
- `font-body` → Supporting copy, descriptions.
- `font-body` with label-style utilities (`text-xs`/`text-sm`, `font-medium`, `tracking-`*) → Slider label, CTA text, feature badges.

## Technical Requirements

- **Client Component**: Must use `"use client"` — uses `useState`, `useRef`, `useEffect`, `framer-motion`, and WebGL.
- **Dependencies**: `framer-motion`. No extra shader libs; use raw WebGL.
- **WebGL**: Vertex + fragment shaders for lightning effect. Support `uHue`, `uSpeed`, `uIntensity`, `uSize`, `uXOffset` uniforms.
- **Responsive**: Canvas fills container; resize on `window.resize`. Ensure text and controls scale on mobile.

## Visual Impact

- Use design tokens where possible; shader colors can be driven by hue (0–360) for flexibility.
- Contrast: White or light text on dark. Ensure WCAG AA for headline and CTA.
- Depth: Layered divs — dark overlay, gradient orbs, Lightning canvas, planet/sphere, then content.
- Motion: Staggered `framer-motion` for feature badges and content; spring animations for slider thumb.

## Constraints

- Output only raw TSX. No markdown fences, no prose.
- Must be a Client Component (`"use client"`).
- Use realistic copy. Fix typos (e.g. "feel free" not "fill free").
- Mobile-first: readable text, touch-friendly slider, collapsible nav.
- Must preserve the target section's layout contract: `w-full` section wrapper, inner container, and brief-defined spacing density.
- Do not default to `min-h-screen` unless explicitly required by the section brief.

## Implementation Reference

When implementing, use or adapt the following patterns. Output path: `components/ui/hero-lighting.tsx` (or project-specific path).

### ElasticHueSlider

- Native `<input type="range">` for accessibility; overlay custom track/fill/thumb for styling.
- `framer-motion` for thumb scale on drag; `AnimatePresence` for value display.
- Props: `value`, `onChange`, `min`, `max`, `step`, `label`.

### Lightning (WebGL)

- Full-screen canvas; vertex shader for fullscreen quad; fragment shader for FBM noise + hue-based color.
- Uniforms: `iResolution`, `iTime`, `uHue`, `uXOffset`, `uSpeed`, `uIntensity`, `uSize`.
- `hsv2rgb` in shader for hue control. `requestAnimationFrame` loop; cleanup on unmount.

### FeatureItem

- `name`, `value`, `position` (Tailwind position classes). Dot + glow + text. Hover scale.

### HeroSection

- State: `mobileMenuOpen`, `lightningHue`.
- Layout: feature badges (optional) → main content (slider, eyebrow CTA, headline, subhead, CTA) → background (overlay, orbs, Lightning, geometry).
- Wire `lightningHue` to `Lightning` component and `ElasticHueSlider`.

### Dependencies

```bash
npm install framer-motion
```

### Tailwind

Ensure `@import "tailwindcss"` (or equivalent) in globals. No extra config required for this skill.

### Fragment Shader (Lightning effect)

```glsl
precision mediump float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uHue;
uniform float uXOffset;
uniform float uSpeed;
uniform float uIntensity;
uniform float uSize;

vec3 hsv2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return c.z * mix(vec3(1.0), rgb, c.y);
}
float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
mat2 rotate2d(float t) { float c = cos(t), s = sin(t); return mat2(c, -s, s, c); }
float noise(vec2 p) {
  vec2 ip = floor(p), fp = fract(p);
  float a = hash12(ip), b = hash12(ip + vec2(1,0)), c = hash12(ip + vec2(0,1)), d = hash12(ip + vec2(1,1));
  vec2 t = smoothstep(0.0, 1.0, fp);
  return mix(mix(a,b,t.x), mix(c,d,t.x), t.y);
}
float fbm(vec2 p) {
  float v = 0.0, amp = 0.5;
  for (int i = 0; i < 10; i++) { v += amp * noise(p); p *= rotate2d(0.45); p *= 2.0; amp *= 0.5; }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  uv = 2.0 * uv - 1.0;
  uv.x *= iResolution.x / iResolution.y;
  uv.x += uXOffset;
  uv += 2.0 * fbm(uv * uSize + 0.8 * iTime * uSpeed) - 1.0;
  float dist = abs(uv.x);
  vec3 baseColor = hsv2rgb(vec3(uHue / 360.0, 0.7, 0.8));
  vec3 col = baseColor * pow(mix(0.0, 0.07, hash11(iTime * uSpeed)) / dist, 1.0) * uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
```

