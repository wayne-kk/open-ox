## Skill: Apply Design Tokens (Tailwind CSS v4)

You are a senior frontend engineer. Given a Design System document and the current `globals.css`, generate a complete updated `globals.css` that fully implements the design system using **Tailwind CSS v4** syntax.

## Output Format

Output a single valid JSON object with one key — no markdown, no code blocks:

```
{
  "globals_css": "/* complete updated globals.css content */"
}
```

The value must be a complete, valid CSS file content (not a diff).

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

  /* Fonts → font-heading, font-body, font-mono */
  --font-heading: "Orbitron", sans-serif;
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
@keyframes glitch { ... }
@keyframes neon-pulse { ... }

/* 6. @layer utilities — custom utility classes */
@layer utilities {
  .cyber-chamfer { clip-path: var(--tech-cut); }
  .cyber-glitch:hover { animation: var(--animate-glitch); }
}
```

## Key Rules

**@theme block:**
- Define ALL design system colors as `--color-{name}: <value>` (hex, oklch, hsl)
- Define fonts as `--font-{name}: "Font Family", fallback`
- Define named shadows as `--shadow-{name}: <value>`
- Define animations as `--animate-{name}: <keyframe-name> <timing>`
- These automatically create Tailwind utilities: `bg-accent`, `text-primary`, `font-heading`, `shadow-neon`, `animate-glitch`
- Use direct color values (hex, oklch) — NOT `hsl(var(...))` pattern from v3

**@layer base:**
- Keep shadcn/ui CSS variables (`--background`, `--foreground`, `--card`, etc.) using the same variable names but with direct values, NOT `hsl(number number% number%)` format — use hex or oklch
- Apply body/html background and text colors using `theme(--color-xxx)` or direct values
- Keep `:root` for non-Tailwind CSS variables (clip-paths, complex values)

**@keyframes:**
- Define all animation keyframes referenced in `@theme --animate-*`
- Place them at root level (not inside any @layer)

**@layer utilities:**
- Custom classes (`.cyber-chamfer`, `.cyber-glitch`, `.bg-scanlines`, etc.)
- Reference `@theme` values via `theme(--color-accent)` or CSS vars via `var(--xxx)`

**Do NOT:**
- Use `@tailwind base`, `@tailwind components`, `@tailwind utilities` (v3 syntax)
- Use `hsl(var(--xxx))` pattern for colors (v3 pattern)
- Reference or modify `tailwind.config.ts` — it is not used in v4
- Output a `tailwind_config` key

## Preserve from existing globals.css

- All `@keyframes` not replaced by the design system
- All custom utility classes not overridden
- Scrollbar styles and other base styles
- Google Fonts imports (update font families to match design system)
