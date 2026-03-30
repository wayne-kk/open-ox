# Ghibli World Design System

## 1. Design Philosophy

**Core Principles**: The design system is built on the Japanese concept of "Ma" (the pure space between things) and "Mono no aware" (the pathos of things). It prioritizes emotional resonance over clinical efficiency, emphasizing organic shapes, breathable layouts, and a sense of wonder.

**The Vibe**: Imagine a quiet afternoon in a sun-drenched library overlooking a lush valley. It feels nostalgic, like a childhood memory of a summer day, blending the tactile warmth of physical parchment with the ethereal clarity of a clear blue sky.

**The Tactile Experience**:
- **Woven Parchment**: Surfaces feel like heavy-weight watercolor paper with a slight tooth.
- **Painted Light**: Color transitions mimic the bleeding of watercolors on a damp canvas.
- **The Wind’s Breath**: Interactive elements respond with a lightness and fluidity, as if caught in a gentle breeze.

**Visual Signatures That Make This Unforgettable**:
- **Hand-Drawn Irregularity**: Subtle variations in border-radius and line weights to avoid "perfect" digital geometry.
- **Thematic Bleeds**: Background colors that softly shift between sections (e.g., from Forest Green to Sky Blue) like a landscape painting.
- **Floating Motifs**: Small, decorative elements (soot sprites, petals, or clouds) that drift subtly in the background.
- **Cinematic Framing**: Use of wide letterboxing and intentional "Ma" (negative space) to focus the eye on high-resolution film stills.
- **Serif Elegance**: High-contrast typography that mirrors the literary roots of Miyazaki’s storytelling.

---

## 2. Design Token System (The DNA)

### Colors (hex values)

```text
--color-background: #FDFBF7;           /* Warm Parchment */
--color-foreground: #2D3436;           /* Deep Charcoal-Blue */
--color-primary: #3E5C41;              /* Forest Canopy Green */
--color-primary-foreground: #FDFBF7;   /* Parchment on Green */
--color-secondary: #8ECAE6;            /* Summer Sky Blue */
--color-secondary-foreground: #2D3436; 
--color-accent: #E07A5F;               /* Sunset Terracotta */
--color-accent-foreground: #FDFBF7;
--color-muted: #E9E4D9;                /* Aged Paper */
--color-muted-foreground: #636E72;     /* Stone Grey */
--color-destructive: #D63031;          /* Fire Spirit Red */
--color-destructive-foreground: #FDFBF7;
--color-card: #FAF7F2;                 /* Slightly lighter parchment */
--color-card-foreground: #2D3436;
--color-popover: #FDFBF7;
--color-popover-foreground: #2D3436;
--color-border: #D1CEC5;               /* Graphite/Pencil line */
--color-input: #E9E4D9;
--color-ring: #3E5C41;                 /* Primary Green ring */
```

### Typography

**Font Stack**:
- **Display**: `"Playfair Display", serif` — For an elegant, cinematic, and slightly antique feel.
- **Header**: `"EB Garamond", serif` — Timeless, literary, and highly readable for storytelling.
- **Body**: `"Lora", serif` — A contemporary serif with roots in calligraphy, perfect for long-form reading.
- **Label**: `"Quicksand", sans-serif` — Rounded, friendly, and organic; used for metadata and UI controls.

Typography roles:
- **Display**: Hero titles, large pull-quotes.
- **Header**: Section titles, film titles.
- **Body**: Descriptions, thematic deep-dives, character bios.
- **Label**: Buttons, navigation links, dates, category tags.

**Scale & Styling**:
- H1: `text-5xl md:text-7xl font-display tracking-tight leading-tight`
- H2: `text-3xl md:text-4xl font-header tracking-normal italic`
- H3: `text-xl md:text-2xl font-header font-semibold`
- Body: `text-base md:text-lg font-body leading-relaxed text-foreground/90`
- Labels: `text-xs md:text-sm font-label font-bold uppercase tracking-widest`

### Radius & Border

```text
radius.none:   0px
radius.sm:     4px
radius.base:   12px
radius.lg:     24px
radius.organic: 40% 60% 70% 30% / 40% 50% 60% 40%  /* For decorative blobs */
```

**Border Width**: 
- Default: `1px` (Pencil-thin)
- Emphasis: `2px` (Brush-stroke)

### Shadows & Effects

**Custom Shadow Tokens (CSS Variables)**:
```css
--shadow-ghibli: 0 10px 30px -10px rgba(62, 92, 65, 0.15);
--shadow-ghibli-sm: 0 4px 12px rgba(0, 0, 0, 0.05);
--shadow-ghibli-lg: 0 20px 50px -15px rgba(0, 0, 0, 0.1);
--shadow-inner-paper: inset 0 2px 4px 0 rgba(0, 0, 0, 0.02);
```

**Text Shadows**:
```css
--text-shadow-glow: 0 0 15px rgba(253, 251, 247, 0.8);
```

### Textures & Patterns

1. **Paper Grain** (SVG Filter Overlay):
```css
.bg-paper-texture {
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3ExternalLink %3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.025;
  pointer-events: none;
}
```

2. **Watercolor Wash** (CSS Gradient):
```css
.bg-watercolor {
  background: radial-gradient(circle at top left, var(--color-secondary), transparent 40%),
              radial-gradient(circle at bottom right, var(--color-primary), transparent 40%),
              var(--color-background);
  background-blend-mode: soft-light;
}
```

---

## 3. Component Stylings

### Buttons

All buttons use: `transition-all duration-500 ease-out font-label uppercase tracking-widest`

**Default Variant (Primary)**:
```text
bg-primary text-primary-foreground rounded-full px-8 py-3 
hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-ghibli
```

**Secondary Variant (Outline)**:
```text
border border-primary text-primary bg-transparent rounded-full px-8 py-3
hover:bg-primary hover:text-primary-foreground
```

**Ghost Variant**:
```text
text-muted-foreground hover:text-primary transition-colors px-4 py-2
```

### Cards/Containers

**Default Card Variant**:
```text
bg-card border border-border/50 rounded-base p-6 
shadow-ghibli-sm hover:shadow-ghibli transition-shadow
```

**Immersive Work Card**:
```text
relative aspect-[2/3] overflow-hidden rounded-base group
- Image scales slightly on hover (scale-105)
- Overlay appears with a soft watercolor gradient
- Title uses Playfair Display font
```

### Inputs

```text
bg-muted/50 border-b border-border text-foreground font-body
focus:outline-none focus:border-primary focus:bg-muted
transition-all duration-300 px-4 py-2
```

---

## 4. Layout Strategy

**Grid Patterns**:
- **Asymmetric Masonry**: Used for character galleries and "Thematic Discovery" grids to feel curated rather than automated.
- **Storybook Column**: A centered 800px column for long-form biographical text (The Legacy).

**Spacing**: 
- Base unit: `4px`
- Section padding: `py-16 md:py-32` (Prioritize large vertical breathing room).

**Asymmetry Requirements**:
- Cards in a grid should have slightly alternating `border-radius` (using `:nth-child` logic).
- Hero imagery should often bleed off one side of the screen to suggest a world beyond the frame.

---

## 5. Non-Genericness (The Bold Factor)

1. **"The Ma Principle"**: Force minimum 120px margins between major content blocks. If it feels "too empty," it’s probably just right.
2. **Watercolor Transitions**: Use `mask-image` with a feather-edged brush texture to transition between image sections and solid colors.
3. **Animated Line-Work**: SVG "pencil" lines that draw themselves when a section enters the viewport.
4. **Vertical Typography**: Use `writing-mode: vertical-rl` for small decorative labels or sidebars to nod to Japanese aesthetics.
5. **Dynamic Skybox**: The background sky color (Sky Blue to Sunset Orange) shifts based on the user's local time or the "mood" of the film being viewed.

---

## 6. Effects & Animation

**Motion Feel**: Float-like, organic, slow-decay. Avoid "snappy" or "bouncy" animations.

**Transitions**:
```css
--transition-soft: all 0.6s cubic-bezier(0.22, 1, 0.36, 1);
--transition-float: transform 3s ease-in-out infinite alternate;
```

**Keyframe Animations**:
```css
@keyframes float {
  from { transform: translateY(0px) rotate(0deg); }
  to { transform: translateY(-15px) rotate(2deg); }
}

@keyframes watercolor-bleed {
  from { opacity: 0; filter: blur(20px); }
  to { opacity: 1; filter: blur(0px); }
}
```

---

## 7. Iconography

**Icon Library**: `lucide-react`

**Style**: Stroke width `1.25px` (thin, delicate).

**Icon Containers**: Icons should never be in heavy boxes. Place them inside soft, low-opacity circles or simply floating next to text.

---

## 8. Responsive Strategy

**Typography Scaling**:
- **Display**: `4rem` (Mobile) → `6rem` (Tablet) → `8rem` (Desktop)
- **Body**: `1rem` (Mobile) → `1.125rem` (Desktop)

**Layout Changes**:
- Mobile: Single column, high-contrast imagery.
- Desktop: Multi-layered parallax, floating decorative elements.

---

## 9. Accessibility

**Contrast**: All text colors maintain a minimum 4.5:1 ratio against the parchment background.

**Focus States**:
```css
.focus-ring {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
}
```

**Reduced Motion**: 
- Disable floating animations and parallax if `prefers-reduced-motion` is detected.
- Replace watercolor "bleeds" with simple fades.

---

## 10. Implementation Notes

- **Tailwind**: Extend the theme with `fontFamily: { display: ['Playfair Display'], header: ['EB Garamond'], body: ['Lora'], label: ['Quicksand'] }`.
- **Global CSS**: The `.bg-paper-texture` must be applied to a fixed `::after` element on the `body` to ensure it covers all scrolling content without moving.
- **Images**: Use `object-cover` with `hover:scale-110 transition-transform duration-[2000ms]` for a slow, cinematic zoom.
- **Performance**: Use CSS `will-change: transform` on parallax elements but keep them limited to avoid layout thrashing.
- **Ma-Utility**: Create a custom utility class `.py-ghibli` that applies `padding-top: 10vh; padding-bottom: 10vh;`.