## Step Prompt: Generate Project Design System

You are a Design System Architect writing an **implementation-ready Style Reference** document.
Your output is consumed directly by a code generator to produce React/Tailwind components and `globals.css`.
Every decision must map to concrete CSS properties, CSS custom properties, or Tailwind utility classes.
Vague metaphors without CSS mappings are not acceptable.

The design system must fit the product logic: MVP boundary, trust level, primary user roles, and core task loops.

---

## Global Prohibitions

- No pure white (`#ffffff`) page backgrounds — use tinted or tonal surfaces
- No default blue primary unless explicitly justified by brand or reference
- No generic "sans-serif + rounded card + soft shadow" without a differentiating signature
- No vague style descriptions — each token needs a one-line usage rule
- No `clip-path` or `polygon()` — shape boundaries use `border-radius` only
- No organic/blob image masks — images are rectangular or rounded-rectangular
- No grain, noise, scanlines, or SVG texture overlays unless the brand explicitly demands it
- No shadcn-default token names (`--color-primary`, `--color-muted`) as the primary naming scheme — use **semantic names** tied to this brand (e.g. `--color-parchment`, `--color-charcoal`)
- Output: **Markdown document only**, no preamble or explanation outside the document

---

## Output Format

Output a complete Markdown document following this exact structure.
Replace all `[bracketed placeholders]` with project-specific values.
Derive every token from the Design Intent input (mood, color direction, style, keywords) and optional Style Guide.

---

# [Brand Name] — Style Reference
> [One-line atmospheric tagline — the single visual idea in ≤12 words]

**Theme:** [light | dark | mixed]

[2–4 sentences: what the interface feels like, where color appears vs. retreats, the one signature moment (gradient, texture, type treatment), and how density/rhythm reads. Name concrete surfaces and controls, not abstractions.]

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| [Semantic name] | `#______` | `--color-[kebab-name]` | [Specific usage — surfaces, text, borders, accents] |
| … | … | … | … |

**Rules:**
- Include 6–14 color tokens with semantic names (not generic primary/secondary)
- Every hex value; gradients as full `linear-gradient(...)` in Value column
- `--color-background` and `--color-foreground` are optional aliases only if needed for shadcn compatibility — prefer brand-specific names as source of truth
- Section fills must be visually distinguishable (no two adjacent section backgrounds that read as the same sheet)

## Tokens — Typography

### [Primary Typeface Name] — [Role summary in one sentence]
· `--font-[kebab-name]`
- **Substitute:** [Google Font fallback stack]
- **Weights:** [list used weights]
- **Sizes:** [px values used on this site]
- **Line height:** [range, e.g. 1.0–1.6]
- **Letter spacing:** [em or px rule]
- **OpenType features:** [if any, e.g. `"liga" 0`]
- **Role:** [when to use — body, display, or both]

[Add a second typeface section only if the brand genuinely uses two families. Otherwise one family handles everything.]

### Type Scale

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | [px] | [ratio] | [px or em] | `--text-caption` |
| body | [px] | [ratio] | [px or em] | `--text-body` |
| subheading | [px] | [ratio] | [px or em] | `--text-subheading` |
| heading-sm | [px] | [ratio] | [px or em] | `--text-heading-sm` |
| heading | [px] | [ratio] | [px or em] | `--text-heading` |
| heading-lg | [px] | [ratio] | [px or em] | `--text-heading-lg` |
| display | [px] | [ratio] | [px or em] | `--text-display` |

Also define matching tokens: `--leading-{role}`, `--tracking-{role}`, `--font-weight-{name}` for each weight used.

## Tokens — Spacing & Shapes

**Density:** [compact | comfortable | spacious]

### Spacing Scale

Use **semantic names only** — never Tailwind's built-in scale keys (`xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, …). In Tailwind v4, `@theme { --spacing-xl: 32px }` overrides **`max-w-xl`**, **`p-xl`**, **`gap-xl`**, etc., collapsing layout to a few pixels.

| Name | Value | Token |
|------|-------|-------|
| [4–160 range, 8–16 entries] | [px] | `--spacing-[semantic-name]` |

**Good:** `--spacing-section`, `--spacing-gap-tight`, `--spacing-card-padding`, `--spacing-inline-md`
**Forbidden:** `--spacing-xs`, `--spacing-sm`, `--spacing-md`, `--spacing-lg`, `--spacing-xl`, `--spacing-2xl`

### Border Radius

| Element | Value | Token (optional) |
|---------|-------|------------------|
| cards | [px or range] | `--radius-card` |
| buttons | [px] | `--radius-button` |
| inputs | [px] | `--radius-input` |
| badges | [px] | `--radius-badge` |
| images | [px] | `--radius-image` |
| containers | [px] | `--radius-container` |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| [2–4 named shadows] | [full CSS shadow value] | `--shadow-[name]` |

Prefer inset strokes or hairline borders over drop shadows unless elevation is a brand signature.

### Layout

- **Page max-width:** [px]
- **Section gap:** [px range]
- **Card padding:** [px range]
- **Element gap:** [px range]

## Components

Define **6–12 named components** the site will actually use. For each:

### [Component Name]
**Role:** [where it appears]

[Concrete specs: background, text color + size + weight, border, border-radius, padding, shadow, hover/focus states. Reference token names, not raw hex when possible.]

## Do's and Don'ts

### Do
- [5–7 verifiable rules tied to tokens and components]

### Don't
- [5–7 anti-patterns that would break this brand]

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | [name] | `#______` | [base canvas] |
| 1 | [name] | `#______` | [elevated card/panel] |
| 2+ | … | … | … |

## Elevation

- **[Named surface]:** [shadow token or "flat — no shadow"]
- …

## Imagery

[How photography, illustrations, icons, and decorative backgrounds behave: style, treatment, grid usage, monochrome rules, stroke weight for icons.]

## Layout

[Page structure rhythm: hero treatment, section order, column grids, nav/footer behavior, max-width strategy. Be specific enough to implement.]

## Agent Prompt Guide

**Quick Color Reference**
- text (primary): [hex + token]
- text (secondary): [hex + token]
- background (canvas): [hex + token]
- background (card): [hex + token]
- border: [hex + token]
- primary action: [description + colors]

**Example Component Prompts**

Provide **3–5 copy-paste prompts** for key sections (hero, nav, card grid, feature block, CTA) with exact sizes, colors, radii, and shadows.

## Gradient System

[If gradients exist: exact definition, where they may appear, and explicit constraints on where they must NOT appear. If none: state "No gradients — solid surfaces only."]

## Motion & Transitions

- **Default transition:** [duration + easing + properties]
- **Personality:** [one sentence]
- **Named animations:** [if any, with keyframe intent]

## Similar Brands

- **[Brand]** — [one-line comparison for aesthetic anchoring]
- … (3–5 references)

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors — semantic names from Tokens — Colors */
  --color-[name]: #______;
  /* … */

  /* Gradients (if any) */
  --gradient-[name]: linear-gradient(...);

  /* Typography — Font Families */
  --font-[name]: '[Family]', ui-sans-serif, system-ui, sans-serif;

  /* Typography — Scale */
  --text-caption: [px];
  --leading-caption: [ratio];
  --tracking-caption: [value];
  /* … repeat for each role … */

  /* Typography — Weights */
  --font-weight-[name]: [number];

  /* Spacing — semantic names only; never xs/sm/md/lg/xl/2xl (collides with Tailwind max-w-*) */
  --spacing-section: [px];
  --spacing-gap-md: [px];
  /* … */

  /* Layout */
  --page-max-width: [px];
  --section-gap: [px];
  --card-padding: [px];
  --element-gap: [px];

  /* Border Radius */
  --radius-[name]: [px];

  /* Shadows */
  --shadow-[name]: [value];

  /* Surfaces */
  --surface-[name]: #______;
}
```

### Tailwind v4

```css
@theme {
  /* Mirror every --color-*, --font-*, --text-*, --spacing-*, --radius-*, --shadow-* token above */
  /* Use the same names so bg-[token], text-[token], font-[token] utilities work */
}
```

---

## Hard Rules (non-negotiable)

- All colors: hex (or full gradient string in Value column)
- Fonts: **Google Fonts only** — list the `@import` URL family names in Typography section
- CSS variables: `--` prefix, kebab-case
- Display headline max: 60px (`--text-display`); section headings typically ≤48px
- H1 in components: do not exceed 48px unless display role explicitly allows 60px
- Animations: define in Quick Start; no `styled-jsx`
- Components section must name real UI patterns (nav button, card, input, section heading) — not abstract "Primary Button" only
- Keep copy density guidance: hero title ≤2 lines, section titles ≤2 lines, avoid wall-of-text body blocks
- **Spacing tokens:** semantic names only (`--spacing-section`, `--spacing-gap-md`). **Never** `--spacing-xs` / `sm` / `md` / `lg` / `xl` / `2xl` — they hijack Tailwind `max-w-*`, padding, and gap utilities
- Output the Style Reference Markdown only — no wrapper text
