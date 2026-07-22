# Newsprint Design System

## 1. Design Philosophy

Treat the page as a contemporary printed edition: typographic hierarchy, disciplined rules, narrow measures, and deliberate editorial density. The signature is not vintage decoration; it is the authority created by masthead scale, serif contrast, numbered departments, and structured columns.

## Visual Contract (agent)

### Color roles

- background: #f3efe5
- foreground: #171512
- primary: #a6291f
- muted: #ded7c8
- accent: #c24932
- card: #ebe5d8

### Font roles

- display: Cormorant Garamond
- header: Libre Franklin
- body: Source Serif 4

### Bold Factor (max 5)

1. Masthead display type may reach `md:text-7xl` with tight leading.
2. Section divisions use visible one-pixel ink rules.
3. One lead story may span two columns; supporting stories remain compact.
4. Red appears only on edition markers, links, and primary actions.

### Hero

Compose the first viewport like a front page: masthead, edition line, lead headline, and one rectangular editorial image.

### Surfaces

Use warm paper tones and ink rules; avoid floating rounded cards, soft shadows, gradients, and glass effects.

## 2. Design Token System (The DNA)

```text
--color-background: #f3efe5
--color-foreground: #171512
--color-primary: #a6291f
--color-primary-foreground: #fff8eb
--color-secondary: #d6cebd
--color-secondary-foreground: #171512
--color-accent: #c24932
--color-accent-foreground: #fff8eb
--color-muted: #ded7c8
--color-muted-foreground: #625b50
--color-destructive: #8f1d16
--color-destructive-foreground: #fff8eb
--color-card: #ebe5d8
--color-card-foreground: #171512
--color-popover: #f8f3e9
--color-popover-foreground: #171512
--color-border: #514b42
--color-input: #e5ded0
--color-ring: #a6291f
--font-display: "Cormorant Garamond", ui-serif, serif
--font-header: "Libre Franklin", ui-sans-serif, sans-serif
--font-body: "Source Serif 4", ui-serif, serif
```

Corners are square or 2px. Shadows are prohibited; hierarchy comes from borders, scale, weight, and whitespace.

## 3. Component Stylings

### Buttons

Primary buttons are compact ink-red rectangles with uppercase Libre Franklin labels.

### Cards

Cards are border-separated story modules without elevation.

### Inputs

Inputs use a paper fill, `px-3 py-2`, a dark bottom rule, and an explicit red focus outline.

## 4. Layout System

Use a twelve-column editorial grid with visible gutters. Standard sections use `py-12 md:py-16`; reading measures stay near 62ch and captions stay close to media.

## 5. Anti-Generic Enforcement (The Bold Factor)

1. Use a real masthead hierarchy and edition metadata above the fold.
2. At least one section uses multi-column editorial composition on desktop.
3. Do not convert articles into generic rounded SaaS cards.

## 6. Effects & Animation

Motion is restrained: 150ms color and underline transitions only. Headlines and images do not float or parallax. Respect reduced motion by removing all nonessential transitions.

## 7. Iconography

Use lucide-react at 16–18px with 1.5px stroke. Icons are functional marks placed directly on paper surfaces without decorative containers.

## 8. Accessibility

Keep body text at least 16px, maintain readable line height, ensure ink/paper contrast meets WCAG AA, and provide strong keyboard focus indicators.
