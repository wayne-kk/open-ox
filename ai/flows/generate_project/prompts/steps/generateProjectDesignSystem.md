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
background:       #xxxxxx  // Description
foreground:       #xxxxxx  // Description
card:             #xxxxxx  // Description
muted:            #xxxxxx  // Description
mutedForeground:  #xxxxxx  // Description
accent:           #xxxxxx  // PRIMARY accent — Description
accentSecondary:  #xxxxxx  // SECONDARY accent — Description
accentTertiary:   #xxxxxx  // TERTIARY accent — Description
border:           #xxxxxx  // Description
input:            #xxxxxx  // Description
ring:             #xxxxxx  // Description
destructive:      #xxxxxx  // Description
```

### Typography

**Font Stack** (use Google Fonts only):
- **Display**: `"FontName", fallback` — [rationale]
- **Headings**: `"FontName", fallback` — [rationale]
- **Body**: `"FontName", fallback` — [rationale]
- **Accent/Labels**: `"FontName", fallback` — [rationale]

**Scale & Styling**:
- H1: [tailwind classes], [text transform], [tracking]
- H2: [tailwind classes], [text transform], [tracking]
- H3: [tailwind classes]
- Body: [tailwind classes]
- Labels/Code: [tailwind classes]

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
- [Performance considerations]
- [Any special setup required]

---

## Rules

- All colors must be hex format.
- All fonts must be from Google Fonts.
- All CSS variable names use `--` prefix and kebab-case.
- Tailwind custom class names use realistic, idiomatic naming.
- Be opinionated and specific. Avoid vague descriptions like "use nice colors".
- The document must be detailed enough that a developer can implement it without asking questions.
- Output only the Markdown document.
