## Rule: Section Styles

All shared styling belongs in global CSS. Components consume only; they do not define.

### Forbidden in Components

- `<style jsx>`, `<style jsx global>`, CSS-in-JS, or any component-scoped style tag — causes build errors in Next.js App Router
- `@font-face`, `@keyframes`, global selectors, or reusable effect classes
- Local redefinition of fonts, animations, textures, or glow effects that already exist in `globals.css`

### Tailwind v4 Usage

The project uses Tailwind CSS v4. All design tokens are defined in `globals.css` via `@theme` and **automatically** become Tailwind utility classes:

- Colors: `bg-primary`, `text-primary`, `border-accent`, `bg-background`, `text-foreground`, etc.
- Fonts: `font-display`, `font-header`, `font-body`, `font-label`
- Shadows: `shadow-glow`, `shadow-soft`, `shadow-neon`, etc.
- Animations: `animate-float`, `animate-pulse-neon`, etc.

Use these native Tailwind utilities directly. Do NOT use custom prefixed helper classes.

For composite effects (glass, scanlines, clip-paths, etc.), prefer Tailwind utilities and arbitrary values (`bg-*`, `backdrop-blur-*`, `[clip-path:*]`, gradients, opacity, blend modes) instead of custom prefixed class names.

### Required

- Use `className` with Tailwind utilities for all styling
- Prefer Tailwind utility classes for layout, spacing, color, and typography
- For keyframe animations not in globals.css, use Tailwind's `animate-[name_duration_easing]` arbitrary value syntax instead of defining new keyframes
- Avoid inline layout styles unless required for a visual effect (e.g. dynamic positioning)

### Texture & Overlay Constraints

- Grain, noise, scanline, and grid overlay elements must use **very low opacity**: grain ≤ `opacity-[0.03]`, scanlines ≤ `opacity-[0.04]`, grid ≤ `opacity-[0.06]`.
- Never apply texture overlays on top of cards, text blocks, or interactive elements — only on full-bleed section backgrounds.
- If a texture overlay makes the page feel dirty, cluttered, or reduces text readability, remove it entirely. A clean background is always preferable.
- Do not stack multiple texture layers (e.g. grain + scanlines + grid) in the same section.
