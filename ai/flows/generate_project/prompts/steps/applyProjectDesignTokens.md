## Step Prompt: Apply Project Design Tokens

You are a senior frontend engineer. Given a design system document and the current
`globals.css`, generate a complete updated `globals.css` that fully implements
the design system using Tailwind CSS v4 syntax.

## Output Format

Output a single valid JSON object with one key. Do not include markdown fences,
explanations, or additional keys.

```json
{
  "globals_css": "/* complete updated globals.css content */"
}
```

The value must be a complete, valid CSS file content, not a diff.

## Tailwind v4 Structure

```css
/* 1. Google Fonts import (if needed) */
@import url('https://fonts.googleapis.com/css2?family=...');

/* 2. Tailwind v4 entry */
@import "tailwindcss";

/* 3. @theme block */
@theme {
  --color-accent: #FF00FF;
  --color-primary: #1A1A2E;
  --color-background: #050505;
  --font-display: "Orbitron", sans-serif;
  --font-header: "Orbitron", sans-serif;
  --font-body: "Inter", sans-serif;
  --font-label: "Rajdhani", sans-serif;
  --shadow-neon: 0 0 15px rgba(255, 0, 255, 0.5), 0 0 30px rgba(255, 0, 255, 0.2);
  --animate-glitch: glitch 0.3s cubic-bezier(.25,.46,.45,.94) both infinite;
}

/* 4. @layer base */
@layer base {
  :root {
    --tech-cut: polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%);
  }
  html, body {
    background-color: theme(--color-background);
    color: theme(--color-foreground);
    font-family: theme(--font-body);
  }
  h1, h2, h3 {
    font-family: theme(--font-header);
  }
}

/* 5. @keyframes */
@keyframes glitch { ... }

/* 6. @layer utilities */
@layer utilities {
  .cyber-chamfer { clip-path: var(--tech-cut); }
}
```

## Key Rules

- Define all design system colors as `--color-{name}` in `@theme`.
- Define fonts as `--font-{name}` and expose semantic roles for
  `display`, `header`, `body`, and `label`.
- Define shadows as `--shadow-{name}`.
- Define animations as `--animate-{name}`.
- Keep shadcn-style semantic variables such as `--background`, `--foreground`,
  `--card`, and `--border` in `@layer base`.
- Put shared `@keyframes`, texture classes, font roles, and reusable effects in
  `globals.css`, not in components.
- Do not generate anything that requires `<style jsx>` or component-scoped style tags.
- Ensure `h1`, `h2`, and `h3` default to the header font in `@layer base`.
- Ensure the generated CSS supports semantic utility usage for `font-display`,
  `font-header`, `font-body`, and `font-label`.
- Preserve useful existing keyframes, utilities, and scrollbar styles unless the
  design system clearly replaces them.
- Do not use Tailwind v3 directives like `@tailwind base`.
- Do not return `tailwind_config` or any extra output.
