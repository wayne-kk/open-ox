# Ghibli-Inspired Movie Showcase Design System

## 1. Design Philosophy

**Core Principles**: The design system centers on "The Human Touch," celebrating the beauty of imperfection and the serenity of nature. It prioritizes emotional resonance over clinical precision, using organic shapes and soft transitions to mimic the experience of a hand-painted storyboard coming to life.

**The Vibe**: This interface feels like a quiet afternoon in a summer meadow. It is nostalgic, airy, and deeply peaceful—evoking the "Ma" (emptiness/stillness) found in Japanese animation where the environment tells as much of the story as the characters.

**The Tactile Experience**:
- **Washi Paper**: The primary surface feels like high-quality, toothy watercolor paper.
- **Ink Bleed**: Interactive elements react with soft, fluid expansions reminiscent of pigment hitting wet paper.
- **Layered Depth**: Using multi-plane parallax to create a sense of looking through a physical multi-plane camera.

**Visual Signatures That Make This Unforgettable**:
- **Organic Edge Masks**: Images and containers never use perfect 90-degree corners; they feature slightly "torn" or hand-brushed edge masks.
- **Floating Motifs**: Subtle, persistent particles (cherry blossoms, soot sprites, or dust motes) that drift across the viewport based on scroll velocity.
- **Watercolor Wash Backgrounds**: Section transitions are defined by soft color bleeds rather than hard lines.
- **Chiselled Typography**: Headlines that feel like they were typeset for a 1980s film poster—elegant, spaced, and timeless.
- **Environmental Lighting**: The site "glows" from within using soft radial gradients that mimic sunlight filtering through leaves (Komorebi).

---

## 2. Design Token System (The DNA)

### Colors (provide hex values for all)

```text
background:       #FDFBF7  // Warm Antique Paper - The base texture
foreground:       #2D302E  // Deep Charcoal Green - Soft black for readability
card:             #F5F0E6  // Sun-bleached Parchment - Secondary container color
muted:            #E8E2D6  // Shadowed Paper - For inactive elements
mutedForeground:  #707571  // Mossy Grey - Subtle text and captions
accent:           #4A7C59  // Forest Canopy - Primary green for CTAs and nature elements
accentSecondary:  #7DB9B6  // Summer Sky - Secondary blue for highlights and links
accentTertiary:   #E9806E  // Sunset Persimmon - Tertiary orange for warmth and urgency
border:           #D9D2C5  // Canvas Thread - Soft separation lines
input:            #F0EDE5  // Inset Paper - For form fields
ring:             #7DB9B6  // Sky Glow - Focus states
destructive:      #C84C4C  // Dried Rose - Error states
```

### Typography

**Font Stack**:
- **Display**: `"Cormorant Garamond", serif` — Used for movie titles and hero statements to evoke classic cinematic elegance.
- **Header**: `"Playfair Display", serif` — High contrast and sophisticated for section headings.
- **Body**: `"Quicksand", sans-serif` — Rounded, soft, and highly legible for long-form storytelling.
- **Label**: `"Montserrat", sans-serif` — Clean, geometric, and spaced-out for technical UI details.

Typography roles are strict:
- **Display** is only for hero wordmarks, mastheads, or singular high-impact text.
- **Header** is the default font for semantic headings `h1`-`h3`.
- **Body** is for paragraph copy and long-form reading.
- **Label** is for badges, eyebrow text, metadata, button labels, form labels, and other compact UI text.

**Scale & Styling**:
- H1: `text-5xl md:text-7xl font-light tracking-tight`, `serif`, `italic`
- H2: `text-3xl md:text-5xl font-medium tracking-normal`, `serif`
- H3: `text-xl md:text-2xl font-semibold tracking-wide`, `serif`
- Body: `text-base md:text-lg leading-relaxed`, `sans-serif`
- Labels: `text-xs md:text-sm font-bold tracking-[0.2em] uppercase`, `sans-serif`

### Radius & Border

```text
radius.none:   0px
radius.sm:     4px
radius.base:   12px
radius.lg:     24px
radius.full:   9999px
```

**Border Width**: Default: `1px`. Emphasis: `2px` (used sparingly for hand-drawn effect).

---

### Shadows & Effects

**Custom Shadow Tokens (CSS Variables)**:
```css
--shadow-watercolor: 0 10px 30px -10px rgba(74, 124, 89, 0.15);
--shadow-paper: 0 2px 5px rgba(0, 0, 0, 0.05), 0 10px 20px rgba(0, 0, 0, 0.02);
--shadow-glow: 0 0 20px rgba(125, 185, 182, 0.3);
```

**Text Shadows**:
```css
--text-shadow-soft: 0 2px 4px rgba(0,0,0,0.1);
--text-shadow-ethereal: 0 0 8px rgba(255,255,255,0.8);
```

### Textures & Patterns

1. **Paper Grain** (Overlay):
```css
.bg-paper-grain {
  background-image: url("https://www.transparenttextures.com/patterns/natural-paper.png");
  background-repeat: repeat;
  opacity: 0.4;
  pointer-events: none;
}
```

2. **Watercolor Bleed Mask**:
```css
.mask-watercolor {
  mask-image: radial-gradient(circle, black 50%, transparent 100%);
  mask-size: 100% 100%;
}
```

---

## 3. Component Stylings

### Buttons

All buttons use: `transition-all duration-500 ease-out font-label uppercase tracking-widest`

**Default Variant (Forest CTA)**:
```text
Background: #4A7C59; Color: #FDFBF7; Border-radius: 9999px;
Hover: Background: #3E674A; Transform: translateY(-2px); Shadow: --shadow-watercolor;
```

**Secondary Variant (Sky Link)**:
```text
Background: transparent; Color: #4A7C59; Border: 1px solid #4A7C59;
Hover: Background: #7DB9B6; Color: #FDFBF7; Border-color: #7DB9B6;
```

**Ghost Variant**:
```text
Background: transparent; Color: #707571;
Hover: Color: #4A7C59; Background: rgba(74, 124, 89, 0.05);
```

### Cards/Containers

**Default Card Variant**:
```text
Background: #F5F0E6; Border: 1px solid #D9D2C5; Padding: 2rem;
Shadow: --shadow-paper; Radius: 12px;
```

**Character Profile Card**:
```text
Background: transparent; Border: none; Text-align: center;
Image: Custom hand-drawn border mask; Transition: Scale on hover;
```

### Inputs

```text
Background: #F0EDE5; Border-bottom: 2px solid #D9D2C5;
Focus: Border-bottom-color: #7DB9B6; Outline: none;
Label: font-label text-xs uppercase text-mutedForeground;
```

---

## 4. Layout Strategy

**Grid Patterns**:
- **Hero Section**: Centered typography with multi-layered parallax backgrounds.
- **Gallery/Character Sections**: Asymmetric masonry grids to feel less "corporate" and more "scrapbook."

**Spacing**: Base unit `8px`. Section padding: `clamp(4rem, 10vh, 10rem)`.

**Asymmetry Requirements**:
- Images should often be slightly offset from their background decorative blobs.
- Text blocks should use generous, uneven margins to create a "breathable" feel.

---

## 5. Non-Genericness (The Bold Factor)

**Mandatory Bold Choices**:
1. **Custom Mouse Cursor**: A soft, semi-transparent watercolor circle that grows and changes color based on what it hovers over.
2. **Horizontal Scroll Lore**: The "World & Lore" section uses horizontal scrolling to mimic the unrolling of an ancient scroll.
3. **Animated SVG Borders**: Buttons and cards feature borders that look like they are being traced in real-time.
4. **Vignette Overlays**: Every page has a soft, warm radial vignette to focus the user's eye on the center content.
5. **Soundscape Integration**: Subtle, toggleable ambient nature sounds (wind, birds) that respond to scroll depth.

---

## 6. Effects & Animation

**Motion Feel**: Fluid, drifting, and momentum-based. Avoid "snappy" or "bounce" easing. Use "soft-in-soft-out."

**Transitions**:
```css
--transition-slow: all 0.8s cubic-bezier(0.25, 0.1, 0.25, 1);
--transition-medium: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
```

**Keyframe Animations**:
```css
@keyframes float {
  0% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-15px) rotate(2deg); }
  100% { transform: translateY(0px) rotate(0deg); }
}

@keyframes drift {
  0% { transform: translateX(-10%) opacity(0); }
  50% { opacity: 0.3; }
  100% { transform: translateX(110%) opacity(0); }
}

@keyframes watercolor-expand {
  from { clip-path: circle(0% at 50% 50%); }
  to { clip-path: circle(150% at 50% 50%); }
}
```

---

## 7. Iconography

**Icon Library**: `lucide-react`

**Style**: Stroke width `1.25px` (thin and delicate). All icons should be colored using `accent` or `mutedForeground`.

**Icon Containers**: Icons should never be bare; they should sit atop a soft watercolor "splat" (a low-opacity radial gradient).

---

## 8. Responsive Strategy

**Typography Scaling**:
- H1: `4xl` (Mobile) → `6xl` (Tablet) → `8xl` (Desktop)
- Body: `16px` (Mobile) → `18px` (Desktop)

**Layout Changes**:
- **Mobile**: Single column, vertical scroll only. Parallax intensity reduced for performance.
- **Desktop**: Asymmetric offsets, complex parallax layers, and hover-triggered watercolor bleeds.

---

## 9. Accessibility

**Contrast**: All text must maintain a minimum 4.5:1 ratio against the paper background. Use `foreground` (#2D302E) for all primary reading copy.

**Focus States**:
```css
.focus-ring:focus-visible {
  outline: 2px solid var(--accent-secondary);
  outline-offset: 4px;
  border-radius: var(--radius-sm);
}
```

**Reduced Motion**: All floating and parallax animations must be wrapped in `@media (prefers-reduced-motion: no-preference)`.

---

## 10. Implementation Notes

- All shared typography, `@keyframes`, and the `.bg-paper-grain` texture must live in `app/globals.css`.
- Use `framer-motion` for all parallax and drifting elements to ensure smooth interpolation.
- The `bg-paper-grain` overlay should be a fixed `div` with `z-index: 50` and `pointer-events-none`.
- Images should use `object-cover` and be wrapped in a container with `overflow-hidden` and a custom `mask-image`.
- **Performance**: High-resolution watercolor assets should be lazy-loaded and served in `.webp` format.