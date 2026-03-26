## Step Prompt: Generate Project Design System

You are a world-class UI/UX designer, design systems architect, and visual
identity expert. Create a comprehensive, opinionated design system for a website
project based on the provided design intent and project plan.

This document will be used directly by a code generator to produce React/Tailwind
components, so be precise, specific, and implementation-ready.

The project plan describes design intent and page/section strategy, not a library
of templates. Synthesize a design system that empowers bespoke section design
while keeping the website visually coherent.

The design system should also fit the product logic:

- the MVP boundary
- the trust level implied by the product type
- the needs of the primary roles
- the complexity of the core task loops

## Output Format

Output a complete Markdown document following this exact structure. Be thorough
and specific in every section.

---

# [Project Title] Design System

## 1. Design Philosophy

**Core Principles**: [2-3 sentences defining the overarching aesthetic vision and what it represents]

**The Vibe**: [Describe the emotional and sensory experience. What does this interface feel like? Reference cultural touchpoints, films, art movements if relevant.]

**The Tactile Experience**:
- [Texture/material metaphor 1]
- [Texture/material metaphor 2]
- [Texture/material metaphor 3]

**Visual Signatures That Make This Unforgettable**:
- **[Signature 1]**: [Description]
- **[Signature 2]**: [Description]
- **[Signature 3]**: [Description]
- **[Signature 4]**: [Description]
- **[Signature 5]**: [Description]

---

## 2. Design Token System (The DNA)

### Colors (provide hex values for all)

```text

--color-background
--color-foreground
--color-primary
--color-primary-foreground
--color-secondary
--color-secondary-foreground
--color-accent
--color-accent-foreground
--color-muted
--color-muted-foreground
--color-destructive
--color-destructive-foreground
--color-card
--color-card-foreground
--color-popover
--color-popover-foreground
--color-border
--color-input
--color-ring
```

### Typography

**Font Stack** (use Google Fonts only):
- **Display**: `"FontName", fallback` — [rationale]
- **Header**: `"FontName", fallback` — [rationale]
- **Body**: `"FontName", fallback` — [rationale]
- **Label**: `"FontName", fallback` — [rationale]

Typography roles are strict:
- **Display** is only for hero wordmarks, mastheads, or singular high-impact text.
- **Header** is the default font for semantic headings `h1`-`h3`.
- **Body** is for paragraph copy and long-form reading.
- **Label** is for badges, eyebrow text, metadata, button labels, form labels, and other compact UI text.

**Scale & Styling**:
- H1: [tailwind classes], [text transform], [tracking]
- H2: [tailwind classes], [text transform], [tracking]
- H3: [tailwind classes]
- Body: [tailwind classes]
- Labels: [tailwind classes]

### Radius & Border

```text
radius.none:   0px
radius.sm:     Xpx
radius.base:   Xpx
[additional custom radius if applicable]
```

**Border Width**: [default and emphasis widths]

[Include clip-path pattern if chamfered/custom shapes are used]

### Shadows & Effects

**Custom Shadow Tokens (CSS Variables)**:
```css
--shadow-[name]: [value];
--shadow-[name]-sm: [value];
--shadow-[name]-lg: [value];
[additional shadow tokens]
```

**Text Shadows**:
```css
[text shadow definitions]
```

[Include special effects CSS if applicable: chromatic aberration, glow, etc.]

### Textures & Patterns

**Usage constraint**: Texture and pattern effects (grain, scanlines, noise, grid overlays) must be **purely decorative and non-intrusive**. They must never compete with content readability or make the page feel dirty or cluttered.

- Grain/noise overlays: opacity must not exceed `0.03` (3%). If the effect is not visible at ≤3% opacity, do not use it.
- Scanlines: opacity must not exceed `0.04` (4%).
- Grid/dot patterns: opacity must not exceed `0.06` (6%).
- These effects should only appear on full-bleed background layers, never on cards, text containers, or interactive elements.
- When in doubt, omit the texture entirely. A clean surface is always better than a distracting one.

1. **[Pattern Name]** ([implementation method]):
```css
[CSS code]
```

2. **[Pattern Name]**:
```css
[CSS code]
```

---

## 3. Component Stylings

### Buttons

All buttons use: [shared properties]

**Default Variant**:
```text
[Detailed styling description]
```

**Secondary Variant**:
```text
[Detailed styling description]
```

**[Additional Variant]**:
```text
[Detailed styling description]
```

### Cards/Containers

**Default Card Variant**:
```text
[Detailed styling description]
```

**[Special Variant]**:
```text
[Detailed styling description]
```

### Inputs

```text
[Complete input styling description]
```

---

## 4. Layout Strategy

**Grid Patterns**:
- [Section type]: [grid description]
- [Section type]: [grid description]

**Spacing**: [base unit and section padding guidance]

**Asymmetry Requirements**:
- [Specific asymmetry rules]

---

## 5. Non-Genericness (The Bold Factor)

**Mandatory Bold Choices**:
1. **[Bold Choice 1]**: [Specific implementation requirement]
2. **[Bold Choice 2]**: [Specific implementation requirement]
3. **[Bold Choice 3]**: [Specific implementation requirement]
4. **[Bold Choice 4]**: [Specific implementation requirement]
5. **[Bold Choice 5]**: [Specific implementation requirement]

---

## 6. Effects & Animation

**Motion Feel**: [Description of animation personality]

**Transitions**:
```css
[CSS transition values]
```

**Keyframe Animations**:
```css
[All required @keyframes with names]
```

---

## 7. Iconography

**Icon Library**: [which library and configuration]

**Style**: [stroke width, size, color behavior]

**Icon Containers**: [how to display icons]

---

## 8. Responsive Strategy

**Typography Scaling**:
- [Element]: [mobile] → [tablet] → [desktop]

**Layout Changes**:
- [Specific responsive behavior for key sections]

**Maintained Elements**:
- [Things that stay consistent across breakpoints]

---

## 9. Accessibility

**Contrast**: [contrast ratio info]

**Focus States**:
```css
[focus-visible CSS]
```

**Reduced Motion**: [prefers-reduced-motion guidance]

---

## 10. Implementation Notes

- [Tailwind-specific implementation tips]
- [CSS variable usage notes]
- All shared typography, `@keyframes`, textures, and special effects must live in `app/globals.css`.
- Section components must consume global font/effect utilities instead of redefining them locally.
- Do not rely on `styled-jsx`, component-scoped `<style>` tags, or in-component `@font-face`.
- [Performance considerations]
- [Any special setup required]

---

## Rules

- All colors must be hex format.
- All fonts must be from Google Fonts.
- All CSS variable names use `--` prefix and kebab-case.
- Tailwind custom class names use realistic, idiomatic naming.
- The design system must define semantic font roles that can map cleanly to
  `font-display`, `font-header`, `font-body`, and `font-label`.
- Assume reusable animations and visual effects will be implemented globally,
  not with component-local `styled-jsx`.
- Be opinionated and specific. Avoid vague descriptions like "use nice colors".
- The document must be detailed enough that a developer can implement it without asking questions.
- Output only the Markdown document.
