# Halloween Spooktacular Design System

## 1. Design Philosophy

**Core Principles**: The "Neon Gothic" aesthetic blends the chilling atmosphere of Victorian horror with the electric energy of a modern midnight rave. Every interaction should feel like a step further into a haunted digital forest where high-urgency conversion meets playful immersion.

**The Vibe**: An immersive, nocturnal playground that balances "spooky" and "festive." It feels like a high-end haunted attraction at midnight—dark, mysterious, but pulsating with neon life and inviting energy.

**The Tactile Experience**:
- **Ectoplasmic Glow**: Elements emit a soft, vibrant radiance that cuts through the deep shadows.
- **Worn Stone & Mist**: Backgrounds feature grainy, stone-like textures softened by layered atmospheric fog.
- **Sharp Modernity**: Clean, precise typography and "chamfered" (clipped) edges that suggest gothic architecture reinvented for the digital age.

**Visual Signatures That Make This Unforgettable**:
- **Neon Flicker**: Subtle "faulty wiring" flicker animations on key headlines and CTA buttons.
- **Floating Apparitions**: Micro-animations of bats or ghostly silhouettes that react to scroll depth.
- **Jagged Dividers**: Section transitions that use "torn paper" or "fog-edge" masks instead of straight lines.
- **Slime-Trail Focus**: Interactive elements that leave a faint, glowing green trail or glow when focused/hovered.
- **Dimensional Darkness**: Deep parallax layering where the background moves slower than the content, creating a sense of infinite nocturnal space.

---

## 2. Design Token System (The DNA)

### Colors (provide hex values for all)

```text
background:       #0A090C  // Deep Midnight — Darker than black, slightly purple-tinted charcoal
foreground:       #F2F2F7  // Ghost White — Soft off-white for high readability
card:             #16141A  // Crypt Grey — Slightly lighter than background for elevation
muted:            #2C2833  // Shadow Purple — For disabled states and subtle borders
mutedForeground:  #A19DA8  // Mist Grey — For secondary text and descriptions
accent:           #FF6200  // PUMPKIN NEON — Primary action color, high-energy orange
accentSecondary:  #32FF7E  // SLIME GREEN — Secondary highlights, success states, and "active" indicators
accentTertiary:   #9D50BB  // HAUNTED PURPLE — Decorative gradients and depth
border:           #3D3945  // Iron Gate — Muted purple-grey for subtle containment
input:            #1F1D24  // Cauldron Black — Deep recessed color for form fields
ring:             #32FF7E  // Slime Focus — Vibrant green glow for accessibility
destructive:      #FF3E3E  // Blood Red — Errors and alerts
```

### Typography

**Font Stack**:
- **Display**: `"Creepster", system-ui` — For thematic emphasis and "spooky" callouts.
- **Headings**: `"Syne", sans-serif` — Ultra-modern, wide, and aggressive for a "Gothic Modern" feel.
- **Body**: `"Outfit", sans-serif` — Geometric and highly readable for conversion copy.
- **Accent/Labels**: `"JetBrains Mono", monospace` — For the countdown timer and technical details to add a "glitchy" vibe.

**Scale & Styling**:
- H1: `text-5xl md:text-7xl lg:text-8xl`, `font-extrabold`, `tracking-tighter`, `uppercase`
- H2: `text-3xl md:text-5xl`, `font-bold`, `tracking-tight`
- H3: `text-2xl md:text-3xl`, `font-semibold`
- Body: `text-base md:text-lg`, `leading-relaxed`
- Labels/Code: `text-sm`, `uppercase`, `tracking-widest`, `font-mono`

### Radius & Border

```text
radius.none:   0px
radius.sm:     2px
radius.base:   4px
radius.pill:   9999px
```

**Border Width**: 
- Default: `1px`
- Emphasis: `2px` (used for active neon states)

**Custom Shape**: Components use a `clip-path` for a "clipped corner" (chamfered) look:
`clip-path: polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%)`

### Shadows & Effects

**Custom Shadow Tokens (CSS Variables)**:
```css
--shadow-neon-orange: 0 0 15px rgba(255, 98, 0, 0.4), 0 0 30px rgba(255, 98, 0, 0.2);
--shadow-neon-green: 0 0 15px rgba(50, 255, 126, 0.4), 0 0 30px rgba(50, 255, 126, 0.2);
--shadow-inner-glow: inset 0 0 20px rgba(157, 80, 187, 0.1);
```

**Text Shadows**:
```css
--text-shadow-glow: 0 0 8px rgba(255, 255, 255, 0.5);
--text-shadow-neon: 0 0 12px currentColor;
```

### Textures & Patterns

1. **Midnight Grain** (CSS Overlay):
```css
background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
opacity: 0.05;
pointer-events: none;
```

2. **Gothic Grid**:
```css
background-size: 40px 40px;
background-image: radial-gradient(circle, #3D3945 1px, transparent 1px);
```

---

## 3. Component Stylings

### Buttons

All buttons use: `font-bold`, `uppercase`, `tracking-widest`, `transition-all duration-300`, `relative overflow-hidden`.

**Default Variant (Pumpkin Punch)**:
```text
bg-accent text-background hover:bg-white shadow-neon-orange 
hover:scale-105 active:scale-95 chamfered-edges
```

**Secondary Variant (Slime Ghost)**:
```text
border-2 border-accentSecondary text-accentSecondary bg-transparent 
hover:bg-accentSecondary hover:text-background shadow-neon-green
```

**Ghost Variant**:
```text
text-foreground/70 hover:text-accent hover:bg-muted/30
```

### Cards/Containers

**Default Card Variant**:
```text
bg-card border border-border rounded-none p-6 
backdrop-blur-md shadow-inner-glow
hover:border-accentSecondary/50 transition-colors
```

**Highlight Variant**:
```text
bg-gradient-to-br from-card to-muted border-l-4 border-l-accent
shadow-[10px_10px_0px_0px_rgba(255,98,0,0.1)]
```

### Inputs

```text
bg-input border-border text-foreground rounded-none 
focus:ring-2 focus:ring-accentSecondary focus:border-transparent
placeholder:text-mutedForeground transition-all
```

---

## 4. Layout Strategy

**Grid Patterns**:
- **Hero**: Single-column centered with floating side-elements for maximum impact.
- **Features**: 3-column asymmetric grid (alternating heights) to feel "unsettled" yet organized.
- **Pricing/Offers**: Stark, vertical "tombstone" cards with heavy shadows.

**Spacing**: 
- Base unit: `4px`
- Section Padding: `py-24` (large vertical breathing room to allow "mist" and "parallax" effects to breathe).

**Asymmetry Requirements**:
- Use `odd:rotate-1` and `even:-rotate-1` on feature cards to create a slightly chaotic, festive look.
- Images should have "jagged" borders using CSS `clip-path`.

---

## 5. Non-Genericness (The Bold Factor)

1. **The "Glitch" Countdown**: The timer doesn't just count; digits occasionally "flicker" or shift 2px horizontally like a haunted VHS tape.
2. **Interactive Fog**: A Canvas-based or CSS-gradient fog layer that follows the mouse cursor subtly at the bottom of the screen.
3. **Slime Scrollbar**: A custom scrollbar that is `accentSecondary` with a glowing thumb.
4. **Typography Displacement**: Large display headings (H1) use a mix of "Creepster" for the first letter and "Syne" for the rest of the word.
5. **Vignette Border**: A permanent, subtle radial gradient overlay that darkens the edges of the viewport, forcing focus to the center content.

---

## 6. Effects & Animation

**Motion Feel**: Snappy but "fluid." Elements should feel like they are floating in a thick atmosphere.

**Transitions**:
```css
--transition-main: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
--transition-fast: all 0.2s ease-out;
```

**Keyframe Animations**:
```css
@keyframes flicker {
  0%, 19.999%, 22%, 62.999%, 64%, 64.999%, 70%, 100% { opacity: 1; }
  20%, 21.999%, 63%, 63.999%, 65%, 69.999% { opacity: 0.4; text-shadow: none; }
}

@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-15px); }
  100% { transform: translateY(0px); }
}

@keyframes slime-drip {
  0% { height: 0; }
  100% { height: 100%; }
}
```

---

## 7. Iconography

**Icon Library**: `lucide-react`

**Style**: `stroke-width: 1.5px`. Icons should always be accompanied by a subtle glow of their parent color.

**Icon Containers**: 
- Icons are placed inside "circular saw" or "hexagonal" frames with a `bg-muted` background and an `accentSecondary` border.

---

## 8. Responsive Strategy

**Typography Scaling**:
- **H1**: `4rem` (Mobile) → `6rem` (Tablet) → `8rem` (Desktop)
- **Body**: `1rem` (Mobile) → `1.125rem` (Desktop)

**Layout Changes**:
- **Mobile**: Single column, sticky CTA "Book Now" bar at the bottom.
- **Desktop**: Multi-column with parallax background layers enabled.

**Maintained Elements**:
- The "Neon Flicker" and "Midnight Grain" stay consistent across all devices.

---

## 9. Accessibility

**Contrast**: Ensure all neon text on dark backgrounds meets WCAG AA standards (minimum 4.5:1). Use white text inside neon orange buttons for better contrast.

**Focus States**:
```css
.focus-ring {
  outline: none;
  box-shadow: 0 0 0 3px #32FF7E;
}
```

**Reduced Motion**: 
- Disable "Floating Apparitions" and "Typography Displacement" if `prefers-reduced-motion` is active.
- Replace "Flicker" with a static glow.

---

## 10. Implementation Notes

- **Tailwind Config**: Extend `colors` with the custom hex codes and `animation` with the `flicker` and `float` keyframes.
- **Performance**: Use `will-change: transform` on parallax elements but keep them limited to avoid over-taxing mobile browsers.
- **Layering**: Use `z-index` carefully: 
  - `z-0`: Background/Mist
  - `z-10`: Content/Cards
  - `z-20`: Floating particles/Bats
  - `z-30`: Navigation/Modals
- **Images**: Apply a `grayscale(0.2) contrast(1.1) sepia(0.2)` filter to all photos to make them feel "haunted" and cohesive with the palette.