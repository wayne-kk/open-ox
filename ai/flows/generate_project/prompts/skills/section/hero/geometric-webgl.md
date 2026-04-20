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

- **Header/Nav**:
  - Left: compact logo mark + wordmark.
  - Middle (desktop): 3 concise nav links.
  - Right (mobile): menu icon button.
- **Hero Main**:
  - Full-height area below header.
  - Absolute WebGL canvas container filling hero.
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

- Mouse movement softly influences rotation/position (lerped target vector).
- Mesh has slow autonomous rotation and gentle vertical floating motion.
- `requestAnimationFrame` render loop.
- Handle resize: camera aspect + renderer size update.
- Cleanup on unmount: remove listeners, cancel RAF, dispose renderer/geometry/material.

## Layout Details

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
