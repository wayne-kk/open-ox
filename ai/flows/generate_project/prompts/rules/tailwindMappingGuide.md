## Rule: Design System → Tailwind CSS v4 Mapping Guide

The Style Reference (`design-system.md`) is the single source of truth. A separate build step converts it into `globals.css` with Tailwind v4 tokens. When writing component classes, follow these mapping rules:

**Colors** — Semantic color names from **Tokens — Colors** map directly to Tailwind utilities:

- `--color-parchment` → `bg-parchment`, `text-parchment`, `border-parchment`
- Pattern: `--color-{semantic-name}` in `@theme` → `bg-{name}`, `text-{name}`, `border-{name}`

**Fonts** — Font token names map to `font-{name}`:

- `--font-inter` → `font-inter`; use whatever names the Style Reference defines

**Typography scale** — When defined as `--text-body`, `--leading-body`, etc., prefer Tailwind arbitrary values or component-level classes documented in the Style Reference Components section.

**Shadows** — Named shadows map to `shadow-{name}`:

- `--shadow-subtle` → `shadow-subtle`

**Animations** — Named animations map to `animate-{name}`:

- `--animate-enter` → `animate-enter`

**Surfaces** — Use surface tokens from the Surfaces table via their color utilities (`bg-parchment` for canvas, etc.)

**Custom effects** — Use Tailwind utilities/arbitrary values (no prefixed helper classes):

- Glass/blur → `backdrop-blur-*`, translucent backgrounds
- Gradients → use `--gradient-*` from `:root` via `bg-[var(--gradient-hero)]` or arbitrary values

**Max-width / line length (critical with custom spacing tokens)** — Tailwind v4 binds `max-w-xs` … `max-w-xl` to **`--spacing-*`**. Design-system tokens like `--spacing-xl: 32px` shrink `max-w-xl` to 32px. For body copy and hero subcopy:

- Prefer **`max-w-[36rem]`** (~576px), **`max-w-[50ch]`**, or **`max-w-prose`**
- Avoid **`max-w-xl`**, **`max-w-lg`**, **`max-w-md`**, **`max-w-sm`** when `@theme` may define spacing tokens
- Page shells may still use **`max-w-7xl`** / **`max-w-[1400px]`** (container scale) or explicit **`max-w-[…]`** arbitrary values

**Spacing tokens in `@theme`** — Use semantic names only (`--spacing-section`, `--spacing-gap-md`). **Never** `--spacing-xl`, `--spacing-lg`, etc.

**Do NOT** define inline CSS variables, @keyframes, or custom classes that duplicate design system tokens. Trust that the Tailwind utilities exist.
