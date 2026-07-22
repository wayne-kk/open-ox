# Quiet Luxury Design System

## 1. Design Philosophy

Express exclusivity through proportion, material restraint, cinematic media, and editorial typography rather than gold ornament everywhere. Use warm alabaster, oxblood, charcoal, and a muted metallic accent. The memorable signature is measured whitespace, thin rules, asymmetric photography, and slow confident transitions.

## Visual Contract (agent)

### Color roles

- background: #f2ede4
- foreground: #221d19
- primary: #5c1822
- muted: #ddd3c5
- accent: #9d7b3f
- card: #e9e1d6

### Font roles

- display: Cormorant Garamond
- header: Manrope
- body: Manrope

### Bold Factor (max 5)

1. Hero display type may reach `md:text-7xl` with generous line-height control.
2. One cinematic rectangular image dominates the first viewport.
3. Metallic gold is limited to rules, small marks, and focus details.
4. Section spacing may reach `md:py-32` on storytelling pages.

### Hero

Use an asymmetric editorial composition with restrained copy, one decisive action, and a large edge-aligned photograph.

### Surfaces

Alternate alabaster and warm stone; avoid generic cream cards, gold gradients, glass panels, and pill-heavy UI.

## 2. Design Token System (The DNA)

```text
--color-background: #f2ede4
--color-foreground: #221d19
--color-primary: #5c1822
--color-primary-foreground: #fff9ef
--color-secondary: #2e2925
--color-secondary-foreground: #fff9ef
--color-accent: #9d7b3f
--color-accent-foreground: #17130f
--color-muted: #ddd3c5
--color-muted-foreground: #6f655b
--color-destructive: #8f2525
--color-destructive-foreground: #fff9ef
--color-card: #e9e1d6
--color-card-foreground: #221d19
--color-popover: #f8f3eb
--color-popover-foreground: #221d19
--color-border: #9e9284
--color-input: #e4dbcf
--color-ring: #5c1822
--font-display: "Cormorant Garamond", ui-serif, serif
--font-header: "Manrope", ui-sans-serif, sans-serif
--font-body: "Manrope", ui-sans-serif, sans-serif
```

Use 2px radii for editorial controls and 8px for large media frames. Shadows stay subtle and warm; one-pixel rules provide structure.

## 3. Component Stylings

### Buttons

Primary buttons use oxblood, alabaster text, compact corners, and generous horizontal padding. Secondary actions use underlined text or a thin border.

### Cards

Cards are editorial modules with `border-t border-border py-6`.

### Inputs

Inputs use `px-3 py-3` and a visible oxblood focus ring.

## 4. Layout System

Use a twelve-column grid with asymmetrical media spans and narrow text measures. Standard sections use `py-20 md:py-28`; transactional areas use `py-14 md:py-20`.

## 5. Anti-Generic Enforcement (The Bold Factor)

1. Luxury comes from scale, photography, and spacing—not repeated gold badges.
2. At least one section pairs oversized serif type with disciplined sans-serif metadata.
3. Avoid rounded SaaS cards, icon grids, and busy multi-CTA clusters.

## 6. Effects & Animation

Use 220–360ms ease-out transitions and restrained image scale no greater than 1.02. No bounce, glow, or continuous animation. Remove transforms under reduced motion.

## 7. Iconography

Use lucide-react at 16–18px with 1.25px stroke. Icons appear without containers unless a small oxblood square communicates an action.

## 8. Accessibility

Maintain WCAG AA contrast, preserve readable serif sizes, provide strong keyboard focus, and ensure cinematic media always includes meaningful alternatives.
