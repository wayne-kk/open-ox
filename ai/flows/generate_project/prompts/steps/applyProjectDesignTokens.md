## Skill: Apply Design Tokens (Tailwind CSS v4)

You are a senior frontend engineer. Given a **Style Reference** design system document and the current `globals.css`, generate a complete updated `globals.css` that fully implements the design system using **Tailwind CSS v4** syntax.

The design system uses semantic token names (e.g. `--color-parchment`, `--color-charcoal`, `--font-inter`) defined in the **Quick Start** section. Mirror those exact names into `@theme`.

## Output Format

Output the complete, updated CSS file content wrapped in a ````css` code block.
Do not output JSON, do not output diffs, and do not provide any explanation outside the code block.

```css
/* complete updated globals.css content */
```

## Tailwind v4 Structure

```css
/* 1. Google Fonts import (if needed) */
@import url('https://fonts.googleapis.com/css2?family=...');

/* 2. Tailwind v4 entry — replaces @tailwind base/components/utilities */
@import "tailwindcss";

/* 3. @theme block — design tokens that AUTOMATICALLY become Tailwind utility classes */
@theme {
  /* Colors → automatically generates: bg-parchment, text-charcoal, border-linen-border */
  --color-parchment: #fcfbf8;
  --color-charcoal: #1c1c1c;

  /* Fonts → automatically generates: font-inter, font-display (use names from Style Reference) */
  --font-inter: "Inter", ui-sans-serif, system-ui, sans-serif;

  /* Shadows → automatically generates: shadow-neon, shadow-glow */
  --shadow-neon: 0 0 15px rgba(255, 0, 255, 0.5), 0 0 30px rgba(255, 0, 255, 0.2);

  /* Animations → automatically generates: animate-glitch, animate-neon-pulse */
  --animate-glitch: glitch 0.3s cubic-bezier(.25,.46,.45,.94) both infinite;
  --animate-neon-pulse: neon-pulse 2s ease-in-out infinite alternate;
}

/* 4. @layer base — global resets, :root vars for non-Tailwind values, body styles */
@layer base {
  :root {
    /* CSS vars NOT tied to Tailwind utilities (complex gradients, transitions, composited effects, etc.) */
    --transition-pop: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  html, body {
    background-color: theme(--color-background);
    color: theme(--color-foreground);
    font-family: theme(--font-body);
  }
  /* Example: transitions live on :root → reference with var(), not theme() */
  .interaction-surface {
    transition: var(--transition-pop);
  }
}

/* 5. @keyframes — referenced by @theme animations */
@keyframes glitch { /* ... */ }
@keyframes neon-pulse { /* ... */ }

/* 6. @layer utilities — ONLY for effects Tailwind utilities cannot express cleanly */
@layer utilities {
  .fx-glass { backdrop-filter: blur(12px); background: rgba(255,255,255,0.1); }
  .fx-radial-soft {
    background-image: radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.18), transparent 55%);
  }
}
```

## CRITICAL: Do NOT duplicate Tailwind auto-utilities

Tailwind v4 `@theme` tokens **automatically** generate utility classes. You MUST NOT create manual mirrored classes for tokens that Tailwind already handles:


| @theme token            | Auto-generated Tailwind utility                | DO NOT create                                              |
| ----------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| `--color-parchment: #xxx` | `bg-parchment`, `text-parchment`, `border-parchment` | custom mirrors like `.bg-parchment-alt` |
| `--color-charcoal: #xxx`  | `bg-charcoal`, `text-charcoal`, `border-charcoal`    | custom mirrors for the same token meaning |
| `--font-inter: "..."`      | `font-inter`                                         | redundant font mirror classes              |
| `--shadow-glow: ...`    | `shadow-glow`                                  | redundant shadow mirror classes                            |
| `--shadow-soft: ...`    | `shadow-soft`                                  | redundant shadow mirror classes                            |
| `--animate-float: ...`  | `animate-float`                                | redundant animation mirror classes                         |
| `--animate-pulse: ...`  | `animate-pulse`                                | redundant animation mirror classes                         |

## CRITICAL: Spacing token names must NOT collide with Tailwind scale keys

In Tailwind v4, **`max-w-xs` through `max-w-xl`** resolve from **`--spacing-*`**, not container width. If `@theme` defines `--spacing-xl: 32px`, then **`max-w-xl` becomes 32px** — body copy collapses to one word per line.

| Forbidden in `@theme` | Breaks utilities |
| --------------------- | ---------------- |
| `--spacing-xs`, `--spacing-sm`, `--spacing-md`, `--spacing-lg`, `--spacing-xl` | `max-w-xs` … `max-w-xl`, matching `p-*`, `m-*`, `gap-*`, `w-*`, `h-*` |
| `--spacing-2xl`, `--spacing-3xl`, … | same-scale padding/gap utilities when those keys exist |

**DO:** write design-system spacing as semantic tokens only, e.g. `--spacing-section: 96px`, `--spacing-gap-md: 16px`, `--spacing-card-padding: 24px`.

**DO NOT:** emit `--spacing-xl`, `--spacing-lg`, or any Tailwind scale duplicate from the Style Reference. If the design system mistakenly lists them, **rename** to semantic names in the output CSS (e.g. `--spacing-xl` → `--spacing-section-gap`).

**Component authors** should prefer **`max-w-[36rem]`**, **`max-w-[50ch]`**, or **`max-w-prose`** for readable line length — not `max-w-xl` / `max-w-lg` / `max-w-md` when custom spacing tokens may exist.

*Only create minimal custom utility classes for effects that Tailwind CANNOT auto-generate:**

- Composite effects combining multiple properties (glass, radial-glow stacks, layered gradients)
- Pseudo-element effects (::before/::after based textures)
- Complex hover/focus states that compose multiple tokens
- Transition shorthands stored in `:root` (not in `@theme`)

## Key Rules

**@theme block:**

- Define ALL design system colors from **Tokens — Colors** as `--color-{semantic-name}: <value>` (hex, oklch, hsl)
- Define fonts as `--font-{name}: "Font Family", fallback` using names from the Style Reference
- Also mirror typography scale tokens if present: `--text-{role}`, `--leading-{role}`, `--tracking-{role}`
- Define spacing as `--spacing-{semantic-name}` and radii as `--radius-{name}` when listed in Quick Start — **never** use Tailwind scale keys (`xs`, `sm`, `md`, `lg`, `xl`, `2xl`, …) for spacing; rename collisions to semantic names before writing `@theme`
- Define named shadows as `--shadow-{name}: <value>`
- Define animations as `--animate-{name}: <keyframe-name> <timing>`
- **Do not** put custom `--transition-`* values in `@theme` if they are full shorthands like `all 0.6s cubic-bezier(...)` — Tailwind v4's theme compiler can throw **CssSyntaxError**. Put those on `:root` inside `@layer base` instead
- Use direct color values (hex, oklch) — NOT `hsl(var(...))` pattern from v3

**`theme()` vs `var()` (common build failure):**

- `theme(--foo)` only resolves tokens **`@theme { --foo: ... }`**. Correct examples: `theme(--color-background)`, `theme(--font-body)`.
- Names on **`:root` only** (e.g. `--transition-mechanical`, custom easings) must use **`var(--transition-mechanical)`**, never `theme(...)`. Otherwise Tailwind raises *Could not resolve value for theme function* and **`pnpm build` fails**.

**@layer base:**

- Keep shadcn/ui CSS variables (`--background`, `--foreground`, `--card`, etc.) **mapped from** the semantic tokens in the Style Reference (e.g. `--background: var(--color-parchment)` or direct hex from Surfaces table)
- Apply body/html background and text colors using `theme(--color-xxx)` or direct values
- Keep `:root` for non-Tailwind CSS variables (complex values, transitions, composited effects)
- **Do not** add `h1`–`h6` selectors with `color` (or any heading-level color rules). Heading color comes from components via utilities (`text-foreground`, etc.), not global base styles.

**@keyframes:**

- Define all animation keyframes referenced in `@theme --animate-`*
- The **first identifier** in each `--animate-`* value must match the `@keyframes` name exactly (e.g. `--animate-float: float 3s ...` requires `@keyframes float { ... }`)
- Place them at root level (not inside any @layer)

**@layer utilities — ONLY for non-Tailwind effects:**

- Use neutral semantic names (for example `fx-`* / `clip-`*) only when truly necessary
- Do NOT mirror `@theme` tokens — Tailwind already generates those utilities
- Keep this section minimal — most design tokens need zero custom classes

**Do NOT:**

- Use `theme(--transition-*)` or `theme(--any-name)` unless that exact `--any-name:` is declared inside **`@theme`**. For `:root` transitions use `transition: var(--transition-xxx);`
- Create mirrored utility classes that duplicate Tailwind auto-utilities from `@theme`
- Output a JSON structure
- Output anything outside the ````css` code block
- Use `@tailwind base`, `@tailwind components`, `@tailwind utilities` (v3 syntax)
- Use `hsl(var(--xxx))` pattern for colors (v3 pattern)
- Reference or modify `tailwind.config.ts` — it is not used in v4
- Generate `h1`, `h2`, `h3`, `h4`, `h5`, `h6` rules that set `color`
- Define `--spacing-xs`, `--spacing-sm`, `--spacing-md`, `--spacing-lg`, `--spacing-xl`, or other Tailwind scale duplicates in `@theme` (breaks `max-w-*` and layout utilities)

## Preserve from existing globals.css

- All `@keyframes` not replaced by the design system
- All custom utility classes not overridden
- Scrollbar styles and other base styles
- Google Fonts imports (update font families to match design system)

