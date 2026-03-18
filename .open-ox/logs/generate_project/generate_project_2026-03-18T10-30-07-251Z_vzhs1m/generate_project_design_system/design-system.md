# Marvel Cinematic Universe: Movie Launch Experience Design System

## 1. Design Philosophy

**Core Principles**: The interface is a digital extension of the silver screen—high-stakes, high-contrast, and high-energy. It prioritizes "Impact over Information," using scale and motion to evoke the awe of a superhero entrance while maintaining a lethal focus on conversion (ticket sales).

**The Vibe**: "Opening Night Energy." It feels like standing in a premium IMAX theater just as the lights dim—a mix of high-tech "Stark-era" sophistication and raw, comic-book power. It is gritty yet polished, dark yet vibrant.

**The Tactile Experience**:
- **Brushed Vibranium**: Metallic surfaces with subtle anisotropic reflections and micro-textures.
- **Energy Flux**: Interactive elements that "glow" or "pulse" as if powered by an Arc Reactor or cosmic energy.
- **Comic Ink**: Sharp, heavy-weighted borders and halftone dot patterns that pay homage to the source material.

**Visual Signatures That Make This Unforgettable**:
- **The "Hero" Angle**: Frequent use of 15-degree diagonal slashes and skewed containers to create a sense of forward motion and action.
- **Anamorphic Flares**: Subtle horizontal lens flare effects (CSS gradients) that trigger on scroll or hover.
- **Halftone Overlays**: Low-opacity dot patterns used in backgrounds to add "texture" to flat dark surfaces.
- **The Red Pulse**: A signature "Marvel Red" glow that emanates from primary CTAs, acting as the visual heartbeat of the site.
- **Cinematic Letterboxing**: Use of wide-aspect ratio containers and "black bars" for media sections to frame content like a film.

---

## 2. Design Token System (The DNA)

### Colors

```text
background:       #050505  // Deepest Cinematic Black
foreground:       #FFFFFF  // Pure White for maximum legibility
card:             #121212  // Dark Slate/Grey for secondary containers
muted:            #1A1A1A  // Desaturated dark for backgrounds
mutedForeground:  #A1A1AA  // Silver-grey for secondary text
accent:           #ED1D24  // MARVEL RED — The primary brand driver
accentSecondary:  #C0C0C0  // METALLIC SILVER — For borders and highlights
accentTertiary:   #00D4FF  // ENERGY BLUE — Neon accent for HUD/Tech elements
border:           #27272A  // Subtle division
input:            #18181B  // Dark input fields
ring:             #ED1D24  // Red focus rings
destructive:      #7F1D1D  // Dark Red for errors
```

### Typography

**Font Stack**:
- **Display**: `"Bebas Neue", sans-serif` — The iconic "Marvel" look; condensed, bold, and authoritative.
- **Header**: `"Oswald", sans-serif` — Strong, variable-width headers that feel cinematic and modern.
- **Body**: `"Inter", sans-serif` — Maximum readability on dark backgrounds for long-form lore.
- **Label**: `"Space Mono", monospace` — For "Dossier" data, tech readouts, and metadata.

Typography roles:
- **Display** is only for hero wordmarks, section titles, and massive "Power Words."
- **Header** is for h1-h3, providing a punchy, news-headline feel.
- **Body** is for the synopsis and character bios.
- **Label** is for the "Get Tickets" secondary text, timestamps, and character stats.

**Scale & Styling**:
- **H1**: `text-6xl md:text-8xl`, `font-display`, `uppercase`, `tracking-tighter`
- **H2**: `text-4xl md:text-6xl`, `font-display`, `uppercase`, `tracking-tight`
- **H3**: `text-2xl md:text-3xl`, `font-header`, `uppercase`, `italic`
- **Body**: `text-base md:text-lg`, `font-body`, `leading-relaxed`
- **Labels**: `text-xs md:text-sm`, `font-label`, `uppercase`, `tracking-widest`

### Radius & Border

```text
radius.none:   0px
radius.sm:     2px
radius.base:   4px
radius.accent: 12px // Used for primary "hero" buttons
```

**Border Width**: 
- Default: `1px`
- Heavy: `4px` (for comic-style separation)

**Custom Shape**: 
Buttons and featured cards use a `clip-path` to create "chamfered" (angled) corners:
`clip-path: polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0% 30%);`

### Shadows & Effects

**Custom Shadow Tokens (CSS Variables)**:
```css
--shadow-glow-red: 0 0 20px rgba(237, 29, 36, 0.4);
--shadow-glow-blue: 0 0 15px rgba(0, 212, 255, 0.3);
--shadow-metallic: inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 4px 10px rgba(0, 0, 0, 0.5);
```

**Text Shadows**:
```css
--text-shadow-hero: 2px 2px 0px #ED1D24, 4px 4px 0px rgba(0,0,0,1);
```

### Textures & Patterns

1. **Halftone Dot Pattern** (Background overlay):
```css
background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 0);
background-size: 20px 20px;
```

2. **Scanline Tech Overlay** (Dossier texture):
```css
background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
background-size: 100% 2px, 3px 100%;
```

---

## 3. Component Stylings

### Buttons

All buttons use: `font-display`, `uppercase`, `transition-all`, `duration-300`.

**Default Variant (Marvel Red)**:
```text
bg-[#ED1D24] text-white border-b-4 border-red-800 hover:bg-red-500 hover:translate-y-[-2px] active:translate-y-[0px] shadow-[var(--shadow-glow-red)]
```

**Secondary Variant (Metallic/Ghost)**:
```text
bg-transparent border-2 border-white/20 hover:border-white text-white backdrop-blur-sm
```

**Tech Variant (Cyan/HUD)**:
```text
border border-[#00D4FF] text-[#00D4FF] font-label text-xs hover:bg-[#00D4FF]/10 shadow-[var(--shadow-glow-blue)]
```

### Cards/Containers

**Default Card Variant (The Comic Frame)**:
```text
bg-[#121212] border-l-4 border-[#ED1D24] p-6 shadow-xl relative overflow-hidden
```

**Dossier Variant (Character Profile)**:
```text
bg-black border border-white/10 hover:border-[#00D4FF]/50 transition-colors group
```

### Inputs

```text
bg-[#1A1A1A] border border-white/10 text-white font-body px-4 py-3 focus:outline-none focus:border-[#ED1D24] focus:ring-1 focus:ring-[#ED1D24] placeholder:text-zinc-600
```

---

## 4. Layout Strategy

**Grid Patterns**:
- **Hero Grid**: A 12-column grid with heavy use of `col-span-12 md:col-span-8` for primary content to leave "breathing room" for background visuals.
- **Character Roster**: CSS Grid with `grid-cols-1 md:grid-cols-3 lg:grid-cols-4`, using `aspect-[2/3]` for poster-style cards.

**Spacing**: 
- Base unit: `4px`
- Section Padding: `py-24 md:py-32` (large vertical gaps to create a "chapters" feel).

**Asymmetry Requirements**:
- Section headers should alternate between left-aligned and right-aligned.
- Background decorative elements (slashes) should be rotated at `-15deg` or `15deg`.

---

## 5. Non-Genericness (The Bold Factor)

1. **The "Redline" Scroll Progress**: A thick Marvel Red line at the top of the screen that grows as the user scrolls.
2. **Cinematic Parallax Layers**: Characters in the grid should have a subtle translate-y effect that moves at a different speed than the background text.
3. **Glitch Hover Effect**: On hover, character images should have a brief "RGB split" or "glitch" animation.
4. **The "Buy Tickets" Persistent Glow**: The primary navigation CTA should have a slow, breathing pulse animation (`opacity: 0.8` to `1.0`).
5. **Impactful Typography Overlays**: Large Display text that sits *behind* character images but *in front* of the background (Z-index layering).

---

## 6. Effects & Animation

**Motion Feel**: Snappy, energetic, and heavy. Objects shouldn't just "fade"; they should "slam" or "slide" into place with a slight bounce.

**Transitions**:
```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-impact: 500ms cubic-bezier(0.19, 1, 0.22, 1);
```

**Keyframe Animations**:
```css
@keyframes pulse-red {
  0% { box-shadow: 0 0 0 0 rgba(237, 29, 36, 0.7); }
  70% { box-shadow: 0 0 0 15px rgba(237, 29, 36, 0); }
  100% { box-shadow: 0 0 0 0 rgba(237, 29, 36, 0); }
}

@keyframes glitch {
  0% { transform: translate(0); }
  20% { transform: translate(-2px, 2px); }
  40% { transform: translate(-2px, -2px); }
  60% { transform: translate(2px, 2px); }
  80% { transform: translate(2px, -2px); }
  100% { transform: translate(0); }
}

@keyframes scanline {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}
```

---

## 7. Iconography

**Icon Library**: `lucide-react`

**Style**: Stroke width `1.5px`. Icons are generally encased in a circle or square with a metallic border.

**Icon Containers**: 
- Social icons: Simple circles with hover-fill in Marvel Red.
- Tech icons (HUD): Cyan color with a small drop shadow glow.

---

## 8. Responsive Strategy

**Typography Scaling**:
- **H1**: `text-5xl` (Mobile) → `text-7xl` (Tablet) → `text-9xl` (Desktop)
- **Body**: `text-sm` (Mobile) → `text-base` (Tablet) → `text-lg` (Desktop)

**Layout Changes**:
- **Mobile**: Single column layout; "Get Tickets" button becomes a fixed bottom bar.
- **Desktop**: Multi-layered parallax; horizontal media scrollers.

**Maintained Elements**:
- The "Marvel Red" accent color and bold Bebas Neue headings must never be compromised for size.

---

## 9. Accessibility

**Contrast**: All text must maintain a 4.5:1 ratio against backgrounds. Pure white on `#050505` provides 21:1.

**Focus States**:
```css
.focus-ring:focus-visible {
  outline: 2px solid #ED1D24;
  outline-offset: 4px;
}
```

**Reduced Motion**:
- If `prefers-reduced-motion` is detected, disable parallax and glitch effects; replace with simple fades.

---

## 10. Implementation Notes

- **Global CSS**: All `@keyframes`, custom fonts, and textures must live in `app/globals.css`.
- **Performance**: Use `next/image` for all character assets with `priority` for hero images to ensure LCP is fast.
- **Layering**: Use `z-index` intentionally. 
  - `z-0`: Background/Textures
  - `z-10`: Background Text (Display)
  - `z-20`: Character Images
  - `z-30`: Foreground Text/UI
  - `z-40`: Navigation
  - `z-50`: Modals/Ticket Overlays
- **Tailwind Extension**: Extend `tailwind.config.js` with the custom colors and font families defined in Section 2.