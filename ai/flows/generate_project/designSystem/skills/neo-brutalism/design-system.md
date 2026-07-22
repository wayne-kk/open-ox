# Neo-Brutalism Design System

## 1. Design Philosophy

Make interaction legible through thick outlines, flat pop colors, offset shadows, and candid typography. The style should feel energetic and human, but every loud choice must clarify grouping or action. Avoid both raw unstyled HTML and decorative chaos.

## Visual Contract (agent)

### Color roles

- background: #fff1d6
- foreground: #171717
- primary: #ff5c35
- muted: #d8d0ff
- accent: #ffe447
- card: #fff8e8

### Font roles

- display: Bricolage Grotesque
- header: Space Grotesk
- body: Inter

### Bold Factor (max 5)

1. Hero display type may reach `md:text-7xl` with compact leading.
2. Interactive cards use a visible 4px offset shadow.
3. Borders are 2px by default and 3px on primary modules.
4. Each viewport uses no more than three pop colors at once.

### Hero

Use a direct headline, one oversized product or character visual, and a CTA cluster placed on a visibly bordered canvas.

### Surfaces

Alternate cream with lavender or yellow planes; avoid gradients, glass blur, subtle gray borders, and soft ambient shadows.

## 2. Design Token System (The DNA)

```text
--color-background: #fff1d6
--color-foreground: #171717
--color-primary: #ff5c35
--color-primary-foreground: #171717
--color-secondary: #6c63ff
--color-secondary-foreground: #fff8e8
--color-accent: #ffe447
--color-accent-foreground: #171717
--color-muted: #d8d0ff
--color-muted-foreground: #4b4567
--color-destructive: #d92d20
--color-destructive-foreground: #fff8e8
--color-card: #fff8e8
--color-card-foreground: #171717
--color-popover: #fffaf0
--color-popover-foreground: #171717
--color-border: #171717
--color-input: #f1e6cf
--color-ring: #6c63ff
--font-display: "Bricolage Grotesque", ui-sans-serif, sans-serif
--font-header: "Space Grotesk", ui-sans-serif, sans-serif
--font-body: "Inter", ui-sans-serif, sans-serif
```

Use 6px radii on controls and 10px on large modules. The signature shadow is `4px 4px 0 #171717` without blur.

## 3. Component Stylings

### Buttons

Primary buttons use coral, a two-pixel black border, bold text, and an offset shadow that collapses on press.

### Cards

Cards use `border-2 border-foreground bg-card p-5` and the same hard-shadow language.

### Inputs

Inputs use `px-3 py-2`, solid borders, and a visible violet focus ring.

## 4. Layout System

Use a twelve-column grid with occasional one-column offsets. Standard sections use `py-14 md:py-20`; dense application surfaces use `py-10 md:py-14`.

## 5. Anti-Generic Enforcement (The Bold Factor)

1. Offset shadows must communicate pressable or grouped surfaces, not decorate every object.
2. Use blunt section labels and visible content grouping.
3. Avoid generic pastel rounded cards without dark outlines.

## 6. Effects & Animation

Use 120–180ms transforms with direct ease-out timing. Pressed controls translate into their shadows; decorative stickers may rotate two degrees. Disable transforms under reduced motion.

## 7. Iconography

Use lucide-react at 18–22px with 2.25px stroke. Icon containers use solid color fills and dark two-pixel outlines.

## 8. Accessibility

Do not rely on color alone for state, preserve strong focus outlines, maintain WCAG AA text contrast, and keep energetic animation optional.
