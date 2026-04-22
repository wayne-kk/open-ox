## Skill: Apply Design Tokens (Tailwind CSS v4)

You are a senior frontend engineer. Given a Design System document and the current `globals.css`, generate a complete updated `globals.css` that fully implements the design system using **Tailwind CSS v4** syntax.

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
  /* Colors → automatically generates: bg-accent, text-accent, border-accent */
  --color-accent: #FF00FF;
  --color-primary: #1A1A2E;
  --color-background: #050505;

  /* Fonts → automatically generates: font-display, font-header, font-body */
  --font-display: "Orbitron", sans-serif;
  --font-header: "Orbitron", sans-serif;
  --font-body: "Inter", sans-serif;

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
| `--color-primary: #xxx` | `bg-primary`, `text-primary`, `border-primary` | custom mirrors like `.bg-primary-alt`, `.text-primary-alt` |
| `--color-accent: #xxx`  | `bg-accent`, `text-accent`, `border-accent`    | custom mirrors for the same token meaning                  |
| `--font-display: "..."` | `font-display`                                 | redundant font mirror classes                              |
| `--font-header: "..."`  | `font-header`                                  | redundant font mirror classes                              |
| `--font-body: "..."`    | `font-body`                                    | redundant font mirror classes                              |
| `--shadow-glow: ...`    | `shadow-glow`                                  | redundant shadow mirror classes                            |
| `--shadow-soft: ...`    | `shadow-soft`                                  | redundant shadow mirror classes                            |
| `--animate-float: ...`  | `animate-float`                                | redundant animation mirror classes                         |
| `--animate-pulse: ...`  | `animate-pulse`                                | redundant animation mirror classes                         |


*Only create minimal custom utility classes for effects that Tailwind CANNOT auto-generate:**

- Composite effects combining multiple properties (glass, radial-glow stacks, layered gradients)
- Pseudo-element effects (::before/::after based textures)
- Complex hover/focus states that compose multiple tokens
- Transition shorthands stored in `:root` (not in `@theme`)

## Key Rules

**@theme block:**

- Define ALL design system colors as `--color-{name}: <value>` (hex, oklch, hsl)
- Define fonts as `--font-{name}: "Font Family", fallback`
- Define named shadows as `--shadow-{name}: <value>`
- Define animations as `--animate-{name}: <keyframe-name> <timing>`
- **Do not** put custom `--transition-`* values in `@theme` if they are full shorthands like `all 0.6s cubic-bezier(...)` — Tailwind v4's theme compiler can throw **CssSyntaxError**. Put those on `:root` inside `@layer base` instead
- Use direct color values (hex, oklch) — NOT `hsl(var(...))` pattern from v3

**@layer base:**

- Keep shadcn/ui CSS variables (`--background`, `--foreground`, `--card`, etc.) using the same variable names but with direct values, NOT `hsl(number number% number%)` format — use hex or oklch
- Apply body/html background and text colors using `theme(--color-xxx)` or direct values
- Keep `:root` for non-Tailwind CSS variables (complex values, transitions, composited effects)
- **Do not** add `h1`–`h6` selectors with `color` (or any heading-level color rules). Heading color comes from components via utilities (`text-foreground`, etc.), not global base styles.

**@keyframes:**

- Define all animation keyframes referenced in `@theme --animate-`*
- The **first identifier** in each `--animate-`* value must match the `@keyframes` name exactly (e.g. `--animate-float: float 3s ...` requires `@keyframes float { ... }`)
- Place them at root level (not inside any @layer)

**@layer utilities — ONLY for non-Tailwind effects:**

- Use neutral semantic names (for example `fx-`* / `clip-*`) only when truly necessary
- Do NOT mirror `@theme` tokens — Tailwind already generates those utilities
- Keep this section minimal — most design tokens need zero custom classes

**Do NOT:**

- Create mirrored utility classes that duplicate Tailwind auto-utilities from `@theme`
- Output a JSON structure
- Output anything outside the ````css` code block
- Use `@tailwind base`, `@tailwind components`, `@tailwind utilities` (v3 syntax)
- Use `hsl(var(--xxx))` pattern for colors (v3 pattern)
- Reference or modify `tailwind.config.ts` — it is not used in v4
- Generate `h1`, `h2`, `h3`, `h4`, `h5`, `h6` rules that set `color`

## Preserve from existing globals.css

- All `@keyframes` not replaced by the design system
- All custom utility classes not overridden
- Scrollbar styles and other base styles
- Google Fonts imports (update font families to match design system)

