## Rule: Section Styles

All shared styling belongs in global CSS. Components consume only; they do not define.

### Forbidden in Components

- `<style jsx>`, `<style jsx global>`, CSS-in-JS, or any component-scoped style tag
- `@font-face`, `@keyframes`, global selectors, or reusable effect classes
- Local redefinition of fonts, animations, textures, or glow effects

### Required

- Reuse the design-token and utility surface already defined in `app/globals.css`
- Use `className` for styling; avoid inline layout styles unless required for a visual effect (e.g. dynamic positioning)
- Place shared effects, keyframes, and font roles in `app/globals.css`; reference them via utilities

### Texture & Overlay Constraints

- Grain, noise, scanline, and grid overlay elements must use **very low opacity**: grain ≤ `opacity-[0.03]`, scanlines ≤ `opacity-[0.04]`, grid ≤ `opacity-[0.06]`.
- Never apply texture overlays on top of cards, text blocks, or interactive elements — only on full-bleed section backgrounds.
- If a texture overlay makes the page feel dirty, cluttered, or reduces text readability, remove it entirely. A clean background is always preferable.
- Do not stack multiple texture layers (e.g. grain + scanlines + grid) in the same section.
