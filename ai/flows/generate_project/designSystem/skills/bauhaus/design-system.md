# Bauhaus Design System

## 1. Design Philosophy

Form follows function, but function may be expressed with unapologetic geometry. Use an asymmetric grid, primary color blocks, heavy rules, and circles or rectangles whose placement reinforces hierarchy. The result should feel constructed and rational, not like random Memphis decoration.

## Visual Contract (agent)

### Color roles

- background: #f2eadb
- foreground: #161616
- primary: #d62d20
- muted: #d9d0c0
- accent: #f2c230
- card: #e8dfcf

### Font roles

- display: Archivo Black
- header: Archivo
- body: IBM Plex Sans

### Bold Factor (max 5)

1. Hero display type may reach `md:text-7xl` within a hard-edged grid.
2. Use one red block and one yellow or blue geometric counterweight above the fold.
3. Borders may reach 3px on signature modules.
4. Rotation is limited to decorative labels at six degrees or less.

### Hero

Build an asymmetric poster composition with headline, rectangular media, and restrained primary geometry that never obscures content.

### Surfaces

Alternate warm canvas and solid primary blocks; avoid gradients, glass, organic blobs, and soft shadow cards.

## 2. Design Token System (The DNA)

```text
--color-background: #f2eadb
--color-foreground: #161616
--color-primary: #d62d20
--color-primary-foreground: #fff8e8
--color-secondary: #2456a6
--color-secondary-foreground: #fff8e8
--color-accent: #f2c230
--color-accent-foreground: #161616
--color-muted: #d9d0c0
--color-muted-foreground: #554f47
--color-destructive: #a61912
--color-destructive-foreground: #fff8e8
--color-card: #e8dfcf
--color-card-foreground: #161616
--color-popover: #f8f0e1
--color-popover-foreground: #161616
--color-border: #161616
--color-input: #e2d8c7
--color-ring: #2456a6
--font-display: "Archivo Black", ui-sans-serif, sans-serif
--font-header: "Archivo", ui-sans-serif, sans-serif
--font-body: "IBM Plex Sans", ui-sans-serif, sans-serif
```

Use 0–4px radii. Elevation is flat; use two- or three-pixel borders and offset color planes instead of blur shadows.

## 3. Component Stylings

### Buttons

Primary buttons use solid red, black borders, square corners, and a two-pixel offset on hover.

### Cards

Cards use explicit grid placement and `border-2 border-foreground p-5`.

### Inputs

Inputs use `px-3 py-2`, square corners, and a blue focus ring.

## 4. Layout System

Use a twelve-column grid with deliberate asymmetry and strong alignment lines. Standard sections use `py-14 md:py-20`; geometric decorations must align to columns.

## 5. Anti-Generic Enforcement (The Bold Factor)

1. Every page uses a repeatable circle/rectangle/rule visual grammar.
2. Primary colors occupy large, intentional planes rather than tiny badge accents.
3. No rounded-card bento grids or decorative geometry disconnected from layout.

## 6. Effects & Animation

Use crisp 140–200ms transitions, short linear slides, and small rotations only on decorative marks. No spring bounce, blur reveal, or ambient glow. Respect reduced motion.

## 7. Iconography

Use lucide-react at 18–20px with 2px stroke. Icons sit in square bordered containers or directly beside labels.

## 8. Accessibility

Never place text across overlapping geometry, preserve WCAG AA contrast on every primary block, and maintain obvious keyboard focus states.
