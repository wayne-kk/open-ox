## Step Prompt: Generate Project Design System

You are a Design System Architect writing a **short, implementation-ready Style Reference**.
Downstream code generators use this document to produce React/Tailwind components and `globals.css`.
Every decision must map to concrete CSS properties, CSS custom properties, or Tailwind utility classes.
Vague metaphors without CSS mappings are not acceptable.

**Job (non-negotiable):** deliver **one visual signature + implementable tokens**. Not a brand encyclopedia.
Visual quality comes from a sharp signature and accurate role tokens — not from long component catalogs or competitor lists.

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
- Do **not** invent a large set of brand-only color names as the primary API — role tokens below are canonical; brand aliases are optional extras
- Output: **Markdown document only**, no preamble or explanation outside the document

---

## Output Format

Output a complete Markdown document following this exact structure.
Replace all `[bracketed placeholders]` with project-specific values.
Derive every token from the Design Intent input (mood, color direction, style, keywords) and optional Style Guide.
Keep the whole document **tight** — prefer tables and bullets over prose.

---

# [Brand Name] — Style Reference

## Signature

**Thesis:** [≤12 words — the single visual idea]

**Theme:** [light | dark | mixed]

**Signature moment:** [Exactly ONE of: type treatment | gradient | surface material | motion]. State where it appears (e.g. hero headline, CTA edge, nav hairline) and the CSS/Tailwind mapping in one sentence.]

**Material:** [e.g. ink-on-paper | soft glass | hard chrome | editorial matte]
- [CSS mapping 1]
- [CSS mapping 2]
- [CSS mapping 3 — optional]

**Density & contrast:** [compact | comfortable | spacious] — [where contrast is high vs restrained]

**Never:**
- [anti-pattern 1 — verifiable]
- [anti-pattern 2]
- [anti-pattern 3]

[Optional: 1–2 sentences naming concrete surfaces/controls. Do not restate the six fields.]

## Tokens — Colors (dual-track)

**Canonical role tokens** (required — these are what Agents and `@theme` use):

| Role | Hex | Token | Usage |
|------|-----|-------|-------|
| background | `#______` | `--color-background` | page canvas |
| foreground | `#______` | `--color-foreground` | primary text |
| primary | `#______` | `--color-primary` | primary actions / key accents |
| primary-foreground | `#______` | `--color-primary-foreground` | text on primary |
| secondary | `#______` | `--color-secondary` | secondary fills / quiet accents |
| muted | `#______` | `--color-muted` | quiet surfaces |
| muted-foreground | `#______` | `--color-muted-foreground` | secondary text |
| accent | `#______` | `--color-accent` | highlight / signature accent |
| border | `#______` | `--color-border` | hairlines, dividers |
| card | `#______` | `--color-card` | elevated panels |
| ring | `#______` | `--color-ring` | focus rings |

**Brand aliases (optional, 0–4):** same hex as a role above — for prose only, e.g. `--color-parchment` → same value as `--color-background`. Do not invent aliases that lack a role mapping.

**Rules:**
- Every Value is hex (gradients belong under Gradient / `:root`, not as fake `--color-*`)
- Primary must not be generic Tailwind blue unless brand/reference demands it
- Adjacent section fills must read as distinct surfaces (use Surfaces)

## Tokens — Typography

### Families

Define **1 family** by default; add a second only if the brand truly needs display vs body contrast.

| Role | Family (Google Fonts) | Token | Weights | When |
|------|----------------------|-------|---------|------|
| display | `[Name]` | `--font-display` | […] | hero / display |
| header | `[Name]` | `--font-header` | […] | section titles |
| body | `[Name]` | `--font-body` | […] | body copy |
| label | `[Name]` | `--font-label` | […] | UI labels, nav, buttons |

List the Google Fonts `@import` family names used.

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

Also define `--leading-{role}`, `--tracking-{role}`, and `--font-weight-{name}` for weights used.
Display max **60px**; section headings typically **≤48px**.

## Tokens — Spacing & Shape

**Density:** [must match Signature]

### Spacing (semantic names only)

Never use Tailwind scale keys (`xs`/`sm`/`md`/`lg`/`xl`/`2xl`/…) — they hijack `max-w-*`, `p-*`, `gap-*`.

| Name | Value | Token |
|------|-------|-------|
| section | [px] | `--spacing-section` |
| gap-tight | [px] | `--spacing-gap-tight` |
| gap-md | [px] | `--spacing-gap-md` |
| card-padding | [px] | `--spacing-card-padding` |
| [1–4 more semantic] | [px] | `--spacing-[semantic]` |

### Radius & Shadow

| Token | Value | Role |
|-------|-------|------|
| `--radius-card` | [px] | cards / panels |
| `--radius-button` | [px] | buttons |
| `--radius-input` | [px] | inputs |
| `--radius-image` | [px] | media |
| `--shadow-[name]` | [CSS] | 1–3 named shadows (prefer hairline/inset unless elevation is the signature) |

**Layout numbers:** page max-width [px]; section gap [px]; card padding [px]; element gap [px].

## Surfaces

| Level | Name | Hex | Maps to role | Purpose |
|-------|------|-----|--------------|---------|
| 0 | [name] | `#______` | background / muted | base canvas |
| 1 | [name] | `#______` | card | elevated panel |
| 2+ | … | … | … | … |

## Gradient

[If any: exact `linear-gradient(...)` / `radial-gradient(...)` strings, token names `--gradient-[name]`, where allowed, where forbidden.]
[If none: `No gradients — solid surfaces only.`]

## Motion

- **Default transition:** [duration + easing + properties] → token `--transition-default` if needed
- **Personality:** [one sentence]
- **Named animations:** [0–2, with keyframe intent] — only if they serve the Signature moment

## Imagery

[3–6 bullets: photo/illustration/icon treatment, monochrome rules, stroke weight. No grain/noise unless Signature demands it.]

## Signature Components

Define **exactly these four** recipes. Reference **role tokens** (`primary`, `foreground`, …), not only brand aliases. Specs must be concrete (size, weight, radius, padding, hover).

### Hero type + CTA cluster
**Role:** first viewport headline + support + primary/secondary CTA  
[Specs: type role/size/weight/line-length; where Signature moment lands; CTA pair behavior]

### Primary button
**Role:** main action  
[Specs: bg/fg tokens, radius, padding, border, hover/focus — gradient only if Signature says so]

### Card / panel
**Role:** content grouping  
[Specs: surface level, border, radius, shadow or flat, padding]

### Nav bar
**Role:** global chrome  
[Specs: bar surface, link type/color, divider/hairline, scroll/sticky behavior if relevant]

## Do's and Don'ts

### Do
- [3–5 rules tied to Signature + role tokens]

### Don't
- [3–5 anti-patterns — include generic SaaS card grid if it fights this brand]

## Quick Start

### `@theme` — role tokens (Tailwind utilities)

```css
@theme {
  /* Mirror EVERY required --color-* role and --font-* role above with the same names */
  --color-background: #______;
  --color-foreground: #______;
  --color-primary: #______;
  /* … remaining roles … */
  --font-display: "[Family]", ui-sans-serif, system-ui, sans-serif;
  --font-header: "…";
  --font-body: "…";
  --font-label: "…";
  /* optional: --text-*, --spacing-*, --radius-*, --shadow-*, --animate-* */
}
```

### `:root` — non-utility values only

```css
:root {
  /* Gradients, transition shorthands, composites — NOT duplicated role colors */
  --gradient-[name]: linear-gradient(...); /* if any */
  --transition-default: [shorthand]; /* if any */
}
```

**Consumers must use `var(--token)` in CSS — never `theme(--token)`.**  
Role colors/fonts live in `@theme` so `bg-primary`, `text-foreground`, `font-body` work. Gradients/transitions stay on `:root` and are referenced with `var(--gradient-*)` / `var(--transition-*)`.

---

## Hard Rules (non-negotiable)

- All solid colors: hex; gradients as full gradient strings under Gradient / `:root`
- Fonts: **Google Fonts only** — list `@import` family names under Typography
- CSS variables: `--` prefix, kebab-case
- Canonical color API = the **role token** table; aliases are optional and must map 1:1 to a role
- Display headline max: 60px (`--text-display`); H1 in components ≤48px unless display role allows 60px
- Spacing tokens: semantic names only — **never** `--spacing-xs|sm|md|lg|xl|2xl`
- Exactly **one** Signature moment; exactly **four** Signature Components
- No Similar Brands list, no long component encyclopedia, no Agent Prompt Guide section
- Animations: only if they serve Signature; no `styled-jsx`
- Copy density: hero title ≤2 lines, section titles ≤2 lines, avoid wall-of-text body
- Output the Style Reference Markdown only — no wrapper text
