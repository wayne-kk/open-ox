## Rule: Design System → Tailwind CSS v4 Mapping Guide

The design system is the single source of truth. A separate build step converts it into `globals.css` with Tailwind v4 tokens. When writing component classes, follow these mapping rules:

**Colors** — Design system color names map directly to Tailwind utilities:

- A color named "accent" / "primary" / "background" etc. → use `bg-accent`, `text-primary`, `border-background` etc.
- Pattern: `--color-{name}` in @theme → `bg-{name}`, `text-{name}`, `border-{name}`

**Fonts** — Font names map to `font-{name}`:

- "display" font → `font-display`, "body" font → `font-body`, "header" font → `font-header`

**Shadows** — Named shadows map to `shadow-{name}`:

- "glow" shadow → `shadow-glow`, "soft" shadow → `shadow-soft`

**Animations** — Named animations map to `animate-{name}`:

- "float" animation → `animate-float`, "pulse" animation → `animate-pulse`

**Custom effects** — Use Tailwind utilities/arbitrary values (no prefixed helper classes):

- Glass/blur effects → `backdrop-blur-`*, translucent backgrounds, border/opacity utilities
- Clip-path shapes → `[clip-path:polygon(...)]`
- Texture overlays → gradients/noise via Tailwind utilities and arbitrary values

**Do NOT** define inline CSS variables, @keyframes, or custom classes that duplicate design system tokens. Trust that the Tailwind utilities exist.