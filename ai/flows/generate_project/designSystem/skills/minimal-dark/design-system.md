# Minimal Dark Design System

## 1. Design Philosophy

Create atmospheric depth through layered charcoal surfaces, generous negative space, and a single warm amber signal. The interface should feel calm and premium rather than neon, glossy, or aggressively futuristic. The signatures are near-black tonal layers, hairline borders, restrained amber illumination, and geometric typography.

## Visual Contract (agent)

### Color roles

- background: #0a0a0f
- foreground: #f4f4f5
- primary: #f59e0b
- muted: #1a1a24
- accent: #fbbf24
- card: #12121a

### Font roles

- display: Space Grotesk
- header: Space Grotesk
- body: Inter

### Bold Factor (max 5)

1. Hero `font-display` may reach `md:text-6xl`, never larger.
2. Amber glow stays local to the primary action at opacity below 35%.
3. Cards use distinct slate layers and one-pixel borders, not generic gray panels.
4. Decorative grids may appear in the hero only at opacity below 6%.

### Hero

Use a spacious split or centered composition with one product visual floating over a radial amber ambience.

### Surfaces

Alternate #0a0a0f and #12121a sections; avoid pure black, blue gradients, and bright glass sheets.

## 2. Design Token System (The DNA)

```text
--color-background: #0a0a0f
--color-foreground: #f4f4f5
--color-primary: #f59e0b
--color-primary-foreground: #181106
--color-secondary: #20202b
--color-secondary-foreground: #f4f4f5
--color-accent: #fbbf24
--color-accent-foreground: #181106
--color-muted: #1a1a24
--color-muted-foreground: #a1a1aa
--color-destructive: #ef4444
--color-destructive-foreground: #fff7ed
--color-card: #12121a
--color-card-foreground: #f4f4f5
--color-popover: #181820
--color-popover-foreground: #f4f4f5
--color-border: #2d2d38
--color-input: #20202b
--color-ring: #f59e0b
--font-display: "Space Grotesk", ui-sans-serif, sans-serif
--font-header: "Space Grotesk", ui-sans-serif, sans-serif
--font-body: "Inter", ui-sans-serif, sans-serif
```

Radius is 8px for controls and 14px for cards. Shadows are deep and diffuse; borders carry most separation.

## 3. Component Stylings

### Buttons

Primary buttons use amber, dark text, `rounded-lg`, and a short glow on hover. Secondary buttons remain transparent with a subtle border.

### Cards

Cards use `bg-card border border-border p-5`; tonal borders carry most separation.

### Inputs

Inputs use explicit `px-3 py-2` and a visible amber focus ring.

## 4. Layout System

Use a twelve-column desktop grid, six columns on tablet, and one column on mobile. Standard sections use `py-16 md:py-24`; dense product areas may use `py-12 md:py-16`.

## 5. Anti-Generic Enforcement (The Bold Factor)

1. Every first viewport includes one amber focal point and at least two visible surface depths.
2. Headlines use Space Grotesk with tight tracking; body copy never uses display type.
3. Avoid equal-sized bento card carpets and repeated glowing borders.

## 6. Effects & Animation

Use 160–220ms ease-out transitions. A hero ambience may breathe slowly; standard cards only change border and translate up at most 2px. Respect reduced motion.

## 7. Iconography

Use lucide-react at 18–20px with 1.75px stroke. Icon containers use dark tonal backgrounds and amber only for active states.

## 8. Accessibility

Maintain WCAG AA contrast, visible two-pixel focus rings, keyboard-operable controls, and a reduced-motion alternative for every ambient animation.
