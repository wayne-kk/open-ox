## Skill: Apply Design Tokens (Tailwind CSS v4)

You are a senior frontend engineer. Given a Design System document and the current `globals.css`, generate a complete updated `globals.css` that fully implements the design system using **Tailwind CSS v4** syntax.

## Output Format

Output the complete, updated CSS file content wrapped in a ` ```css ` code block.
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

/* 3. @theme block — design tokens that become Tailwind utility classes */
@theme {
  /* Colors → bg-accent, text-accent, border-accent, etc. */
  --color-accent: #FF00FF;
  --color-primary: #1A1A2E;
  --color-background: #050505;

  /* Fonts → font-display, font-header, font-body */
  --font-display: "Orbitron", sans-serif;
  --font-header: "Orbitron", sans-serif;
  --font-body: "Inter", sans-serif;

  /* Shadows → shadow-neon, shadow-glow, etc. */
  --shadow-neon: 0 0 15px rgba(255, 0, 255, 0.5), 0 0 30px rgba(255, 0, 255, 0.2);

  /* Animations → animate-glitch, animate-pulse-neon, etc. */
  --animate-glitch: glitch 0.3s cubic-bezier(.25,.46,.45,.94) both infinite;
  --animate-neon-pulse: neon-pulse 2s ease-in-out infinite alternate;
}

/* 4. @layer base — global resets, :root vars for non-Tailwind values, body styles */
@layer base {
  :root {
    /* CSS vars not tied to Tailwind utilities (clip-paths, complex gradients, etc.) */
    --tech-cut: polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%);
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

/* 6. @layer utilities — custom classes mirroring tokens (required, see rules below) */
@layer utilities {
  /* Design-system aliases: same tokens as @theme / :root, explicit classNames for stable usage */
  .ds-font-display { font-family: theme(--font-display); }
  .ds-font-header { font-family: theme(--font-header); }
  .ds-font-body { font-family: theme(--font-body); }
  .ds-font-label { font-family: theme(--font-label); }
  .ds-shadow-neon { box-shadow: theme(--shadow-neon); }
  .ds-animate-glitch { animation: theme(--animate-glitch); }
  .ds-chamfer { clip-path: var(--tech-cut); }
}
```

## Key Rules

**@theme block:**
- Define ALL design system colors as `--color-{name}: <value>` (hex, oklch, hsl)
- Define fonts as `--font-{name}: "Font Family", fallback`
- Define named shadows as `--shadow-{name}: <value>`
- Define animations as `--animate-{name}: <keyframe-name> <timing>`
- **Do not** put custom `--transition-*` values in `@theme` if they are full shorthands like `all 0.6s cubic-bezier(...)` — Tailwind v4’s theme compiler can throw **CssSyntaxError**. Put those on `:root` inside `@layer base` instead
- `@theme` also creates Tailwind utilities (`bg-accent`, `shadow-neon`, etc.) — still add the **`.ds-*` mirrors** in `@layer utilities` (required)
- Use direct color values (hex, oklch) — NOT `hsl(var(...))` pattern from v3

**@layer base:**
- Keep shadcn/ui CSS variables (`--background`, `--foreground`, `--card`, etc.) using the same variable names but with direct values, NOT `hsl(number number% number%)` format — use hex or oklch
- Apply body/html background and text colors using `theme(--color-xxx)` or direct values
- Keep `:root` for non-Tailwind CSS variables (clip-paths, complex values)
- **Do not** add `h1`–`h6` selectors with `color` (or any heading-level color rules). Heading color comes from components via utilities (`text-foreground`, etc.), not global base styles.

**@keyframes:**
- Define all animation keyframes referenced in `@theme --animate-*`
- The **first identifier** in each `--animate-*` value must match the `@keyframes` name exactly (e.g. `--animate-float: float 3s ...` requires `@keyframes float { ... }`)
- Place them at root level (not inside any @layer)

**@layer utilities — custom classNames (required):**

You may define **any** tokens in `@theme` or `:root`, but you **must** also emit matching **custom utility classes** so generated sections can use stable, design-system-prefixed `className` values (Tailwind’s auto-utilities from `@theme` alone are not enough for a single obvious API in prompts).

- **Prefix:** use **`ds-`** (design system): `.ds-shadow-soft`, `.ds-animate-float`, `.ds-text-accent`, etc.
- **Mirror every meaningful token** from the design spec (skip only ultra-internal one-offs):
  - For each **`--font-*`** in `@theme`: `.ds-font-{name} { font-family: theme(--font-{name}); }`
  - For each **`--shadow-*`** in `@theme`: `.ds-shadow-{name} { box-shadow: theme(--shadow-{name}); }`
  - For each **`--animate-*`** in `@theme`: `.ds-animate-{name} { animation: theme(--animate-{name}); }`
  - For key **`--color-*`** used for text/background/border in the design system: add `.ds-text-{name}`, `.ds-bg-{name}`, `.ds-border-{name}` using `color` / `background-color` / `border-color` with `theme(--color-{name})` as appropriate
  - For **`:root`-only** vars (`--transition-*`, clip-paths, gradients, etc.): `.ds-{name}` or a semantic name from the brief, using `var(--...)`
- **Design-specific effects** (scanlines, glitch hover, grain): still add semantic `.ds-*` or brief-driven names (e.g. `.ds-scanlines`, `.ds-glitch-hover`) that compose tokens
- **Do not** rely only on Tailwind’s implicit utilities; always provide the **`.ds-*` parallel** for every token category you introduce (fonts, shadows, animations, key semantic colors)

**Do NOT:**
- Output a JSON structure.
- Output anything outside the ` ```css ` code block.
- Use `@tailwind base`, `@tailwind components`, `@tailwind utilities` (v3 syntax)
- Use `hsl(var(--xxx))` pattern for colors (v3 pattern)
- Reference or modify `tailwind.config.ts` — it is not used in v4
- Generate `h1`, `h2`, `h3`, `h4`, `h5`, `h6` rules that set `color` (or any global heading color / typography color for headings). Omit them entirely.

## Preserve from existing globals.css

- All `@keyframes` not replaced by the design system
- All custom utility classes not overridden
- Scrollbar styles and other base styles
- Google Fonts imports (update font families to match design system)