# Acid Halloween 2024 Design System

## 1. Design Philosophy

**Core Principles**: The Acid Halloween 2024 experience is a collision of 90s rave nostalgia and futuristic digital decay. It prioritizes sensory overload, high-velocity visual communication, and a "digital-first" brutalist structure that feels both premium and underground.

**The Vibe**: An illegal warehouse rave held inside a liquid-metal supercomputer. It’s electric, vibrating, and unapologetically loud. Think *The Matrix* meets a 1994 Berlin techno flyer, filtered through a modern Gen-Z lens.

**The Tactile Experience**:
- **Liquid Chrome**: Smooth, reflective, and distorted surfaces that feel like molten mercury.
- **Digital Grain**: A persistent photographic noise that suggests analog film or low-bitrate CCTV footage.
- **Neon Friction**: High-contrast edges that feel like they might "sting" if touched, using vibrant fluorescent glows.

**Visual Signatures That Make This Unforgettable**:
- **Warped Perspective**: Text and containers that appear stretched or pulled by gravitational forces.
- **Scanline Overlays**: A subtle horizontal grid mimicking old CRT monitors.
- **Chromatic Aberration**: Slight color bleeding (red/blue offsets) on high-impact headings.
- **Aggressive Borders**: Heavy, 2px to 4px solid borders with "cut" corners or stepped offsets.
- **Kinetic Typography**: Constant subtle movement in decorative text to simulate a "trip."

---

## 2. Design Token System (The DNA)

### Colors (Hex Values)

```text
background:       #050505  // Deep Grainy Black — The void
foreground:       #F5F5F5  // Off-White — High-contrast readability
card:             #0A0A0A  // Near-Black — Subtle elevation from background
muted:            #1A1A1A  // Dark Gray — For secondary structural elements
mutedForeground:  #A1A1AA  // Medium Gray — For less important text
accent:           #CCFF00  // ACID GREEN — The primary brand punch
accentSecondary:  #BF00FF  // ELECTRIC PURPLE — High-energy secondary
accentTertiary:   #FF007F  // HOT PINK — Urgency and CTAs
border:           #333333  // Dark Border — Low visibility structure
input:            #111111  // Input Background — Recessed feel
ring:             #CCFF00  // Focus Ring — Acid Green
destructive:      #FF3B3B  // Bright Red — Error states
```

### Typography

**Font Stack**:
- **Display**: `"Syne", sans-serif` — Ultra-modern, wide, and aggressive for hero moments.
- **Header**: `"Archivo Black", sans-serif` — Heavy, masculine, and high-impact.
- **Body**: `"Inter", sans-serif` — Clean, neutral, and highly readable against dark backgrounds.
- **Label**: `"JetBrains Mono", monospace` — The "hacker/tech" aesthetic for metadata and UI labels.

**Scale & Styling**:
- **H1**: `text-5xl md:text-8xl`, uppercase, tracking-tighter, font-header
- **H2**: `text-4xl md:text-6xl`, uppercase, tracking-tight, font-header
- **H3**: `text-2xl md:text-3xl`, font-header
- **Body**: `text-base md:text-lg`, font-body, leading-relaxed
- **Labels**: `text-xs md:text-sm`, uppercase, tracking-widest, font-label

### Radius & Border

```text
radius.none:   0px
radius.sm:     2px
radius.base:   4px
radius.full:   9999px
```

**Border Width**: 
- Default: `1px`
- Emphasis: `3px` (used for primary buttons and main section containers)

**Custom Shape**: `clip-path: polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)` — The "Octagon-Cut" for buttons and cards.

### Shadows & Effects

**Custom Shadow Tokens (CSS Variables)**:
```css
--shadow-acid: 0 0 15px 2px rgba(204, 255, 0, 0.4);
--shadow-purple: 0 0 20px 2px rgba(191, 0, 255, 0.3);
--shadow-chrome: inset 0 0 10px rgba(255, 255, 255, 0.2);
```

**Text Shadows**:
```css
--ts-glitch: 2px 0 #FF007F, -2px 0 #BF00FF;
--ts-neon: 0 0 8px #CCFF00;
```

### Textures & Patterns

1. **Digital Grain** (Overlay):
```css
.bg-grain {
  background-image: url("https://grainy-gradients.vercel.app/noise.svg");
  filter: contrast(150%) brightness(100%);
}
```

2. **CRT Scanlines**:
```css
.bg-scanlines {
  background: linear-gradient(
    rgba(18, 16, 16, 0) 50%,
    rgba(0, 0, 0, 0.25) 50%
  ),
  linear-gradient(
    90deg,
    rgba(255, 0, 0, 0.06),
    rgba(0, 255, 0, 0.02),
    rgba(0, 0, 255, 0.06)
  );
  background-size: 100% 2px, 3px 100%;
}
```

---

## 3. Component Stylings

### Buttons

All buttons use: `font-label`, `uppercase`, `font-bold`, `transition-all duration-200`, `active:scale-95`

**Default Variant (Acid)**:
- Background: `#CCFF00`
- Text: `#050505`
- Border: `2px solid #050505`
- Hover: `box-shadow: 6px 6px 0px #BF00FF` (Offset shadow effect)

**Outline Variant**:
- Background: `transparent`
- Text: `#CCFF00`
- Border: `2px solid #CCFF00`
- Hover: `background: #CCFF00`, `text: #050505`

### Cards/Containers

**Default Card Variant**:
- Background: `#0A0A0A`
- Border: `1px solid #333333`
- Padding: `p-6`
- Effect: Subtle `bg-grain` overlay.

**Chrome Section**:
- Background: `linear-gradient(135deg, #e0e0e0 0%, #ffffff 45%, #7a7a7a 50%, #f5f5f5 55%, #b0b0b0 100%)`
- Text: `#050505` (Inverted contrast)
- Effect: High-gloss metallic feel.

### Inputs

- Background: `#111111`
- Border: `1px solid #333333`
- Focus Border: `#CCFF00`
- Text Color: `#F5F5F5`
- Corner: `radius.none` (Sharp)

---

## 4. Layout Strategy

**Grid Patterns**:
- **Hero**: Single column, centered, with elements breaking out of the 12-column container.
- **Features**: 2-column or 3-column masonry grid with varying card heights to create visual "noise."

**Spacing**: 
- Base unit: `4px`
- Section Padding: `py-24` (Mobile: `py-16`) to allow the visuals room to breathe.

**Asymmetry Requirements**:
- Section headers should be offset (e.g., `-ml-4` or `rotate-[-1deg]`).
- Use "brutalist" gaps: `gap-0` with borders touching, or `gap-12` for extreme separation.

---

## 5. Non-Genericness (The Bold Factor)

1. **Horizontal Scrolling Text**: Large marquee banners running at different speeds in opposite directions.
2. **The "Glitch" Hero**: The main event title must have a hover-triggered RGB split effect.
3. **Cursor Follower**: A custom cursor that is a high-contrast circle (Acid Green) with `mix-blend-mode: difference`.
4. **Distorted Borders**: Containers that aren't perfect rectangles—using `clip-path` to create jagged, "torn" edges.
5. **Color Flash**: On scroll triggers, briefly flash the background from Black to Acid Green to create a "strobe" effect.

---

## 6. Effects & Animation

**Motion Feel**: Jittery, fast, and high-energy. Avoid smooth "ease-in-out"; use `steps()` or `cubic-bezier(0.19, 1, 0.22, 1)`.

**Transitions**:
```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-brutal: 50ms steps(2);
```

**Keyframe Animations**:
```css
@keyframes glitch-anim {
  0% { clip-path: inset(10% 0 30% 0); transform: translate(-5px, -2px); }
  20% { clip-path: inset(50% 0 10% 0); transform: translate(5px, 2px); }
  40% { clip-path: inset(20% 0 60% 0); transform: translate(-2px, 5px); }
  100% { clip-path: inset(0 0 0 0); transform: translate(0); }
}

@keyframes marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
```

---

## 7. Iconography

**Icon Library**: `lucide-react`

**Style**: 
- Stroke Width: `1.5px`
- Size: Standard `24px` but scaled to `48px` for feature blocks.
- Color: Always `accent` or `foreground`. Never muted.

**Icon Containers**: 
- Icons should sit inside a `border-2 border-accent` square box with `45-degree` rotated corners.

---

## 8. Responsive Strategy

**Typography Scaling**:
- **H1**: `4rem` (Mobile) → `6rem` (Tablet) → `9rem` (Desktop)
- **Body**: `1rem` (Mobile) → `1.125rem` (Desktop)

**Layout Changes**:
- **Mobile**: Single column stack, marquee speed increased to feel faster on smaller screens.
- **Desktop**: Overlapping absolute-positioned elements for maximum "acid" distortion.

---

## 9. Accessibility

**Contrast**: All text must maintain a minimum 4.5:1 ratio. Acid Green (#CCFF00) on Black (#050505) provides a massive 13.5:1 ratio.

**Focus States**:
```css
*:focus-visible {
  outline: 3px solid #CCFF00;
  outline-offset: 4px;
}
```

**Reduced Motion**: 
- If `prefers-reduced-motion` is detected, disable marquee animations and RGB glitch effects. Replace with static high-contrast equivalents.

---

## 10. Implementation Notes

- All shared typography, `@keyframes`, and `bg-grain` utilities live in `app/globals.css`.
- Use `framer-motion` for complex scroll-linked distortions.
- The `bg-scanlines` should be a fixed `::after` element on the `body` with `pointer-events-none`.
- Use Tailwind's `group-hover` for synchronized glitch effects on cards.
- **Performance**: Use CSS `will-change: transform` for the marquee and glitch animations to ensure 60fps on mobile.