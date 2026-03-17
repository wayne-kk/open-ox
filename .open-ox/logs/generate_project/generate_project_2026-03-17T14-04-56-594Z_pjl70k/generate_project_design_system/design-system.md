# Cyber-Night Halloween 2024 Design System

## 1. Design Philosophy

**Core Principles**: The interface embodies the "High-Tech, Low-Life" ethos of the cyberpunk genre. It balances extreme technical precision with gritty, industrial decay, using high-contrast neon light to puncture an obsidian void.

**The Vibe**: An immersive digital terminal found in a rain-slicked alleyway of a futuristic metropolis. It feels electric, urgent, and slightly dangerous—evoking the sensory overload of a Tokyo nightlife district combined with the sterile glow of a hacker’s workstation.

**The Tactile Experience**:
- **Radiant Glass**: Surfaces feel like reinforced polycarbonate screens with internal illumination.
- **Industrial Metal**: Structural elements feel heavy, cold, and laser-cut.
- **Digital Static**: Interactive elements react with micro-glitches and scan-line interference.

**Visual Signatures That Make This Unforgettable**:
- **The "Neural-Link" Glow**: Every interactive element emits a soft, layered Gaussian blur glow in neon hues.
- **Chamfered Geometries**: 45-degree angled corners on buttons and containers instead of standard rounded corners.
- **Scan-Line Overlays**: A subtle, moving horizontal line pattern that mimics old CRT monitors or futuristic HUDs.
- **Glitch Transitions**: Hover states and page entries utilize rapid chromatic aberration and positional shifts.
- **Data-Stream Typography**: Labels and metadata appear as if being decrypted in real-time.

---

## 2. Design Token System (The DNA)

### Colors

```text
background:       #050505  // Deep Obsidian — The void of the city
foreground:       #E0E0E0  // Platinum — High readability against dark backgrounds
card:             #0D0D0F  // Charcoal Glass — Slightly lifted from background
muted:            #1A1A1D  // Industrial Gray — For inactive or background elements
mutedForeground:  #88888F  // Steel — Secondary text and metadata
accent:           #FF00FF  // NEON MAGENTA — Primary call-to-action and energy
accentSecondary:  #00F3FF  // CYAN OVERDRIVE — Secondary info and highlights
accentTertiary:   #BCFF00  // ACID GREEN — Success states and "Online" indicators
border:           #2A2A2F  // Tech-Grip — Structural lines
input:            #121214  // Terminal Black — Input field backgrounds
ring:             #00F3FF  // Cyan Glow — Focus indicators
destructive:      #FF3131  // Critical Red — Error states and warnings
```

### Typography

**Font Stack**:
- **Display**: `"Orbitron", sans-serif` — For a futuristic, geometric sci-fi impact.
- **Header**: `"Rajdhani", sans-serif` — Technical, squared-off letterforms for hierarchy.
- **Body**: `"Inter", sans-serif` — Maximum legibility for long-form event details.
- **Label**: `"JetBrains Mono", monospace` — Evokes code, terminals, and technical readouts.

**Scale & Styling**:
- **H1**: `text-5xl md:text-7xl`, uppercase, font-display, tracking-tighter, italic
- **H2**: `text-3xl md:text-5xl`, uppercase, font-header, tracking-widest
- **H3**: `text-xl md:text-2xl`, font-header, tracking-wide
- **Body**: `text-base md:text-lg`, font-body, leading-relaxed
- **Labels**: `text-xs md:text-sm`, font-label, uppercase, tracking-[0.2em]

### Radius & Border

```text
radius.none:   0px
radius.sm:     2px
radius.base:   4px
```

**Border Width**: 
- Default: `1px`
- Emphasis: `2px` (used for active neon borders)

**Custom Shape (Chamfered Corner)**:
```css
/* Applied via utility class or tailwind plugin */
.clip-cyber {
  clip-path: polygon(0% 0%, 100% 0%, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0% 100%);
}
.clip-cyber-inv {
  clip-path: polygon(15px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 15px);
}
```

### Shadows & Effects

**Custom Shadow Tokens (CSS Variables)**:
```css
--shadow-neon-magenta: 0 0 10px rgba(255, 0, 255, 0.5), 0 0 20px rgba(255, 0, 255, 0.2);
--shadow-neon-cyan: 0 0 10px rgba(0, 243, 255, 0.5), 0 0 20px rgba(0, 243, 255, 0.2);
--shadow-card-glow: inset 0 0 15px rgba(255, 255, 255, 0.05);
```

**Text Shadows**:
```css
--text-shadow-glitch: 2px 0 #FF00FF, -2px 0 #00F3FF;
```

### Textures & Patterns

1. **Scan-Line Overlay**:
```css
.bg-scanlines {
  background: linear-gradient(
    to bottom,
    transparent 50%,
    rgba(0, 0, 0, 0.1) 50%
  );
  background-size: 100% 4px;
}
```

2. **Cyber-Grid**:
```css
.bg-cyber-grid {
  background-image: 
    linear-gradient(rgba(0, 243, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 243, 255, 0.05) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

---

## 3. Component Stylings

### Buttons

**Shared Properties**: Monospace labels, uppercase, tracking-widest, transition-all duration-200.

**Default Variant (Magenta Action)**:
- Background: `#FF00FF`
- Text: `#050505` (Black)
- Hover: Slight scale up, intense magenta glow shadow, subtle glitch animation on text.
- Shape: `clip-cyber`

**Secondary Variant (Cyan Outline)**:
- Background: Transparent
- Border: `1px solid #00F3FF`
- Text: `#00F3FF`
- Hover: Background becomes `#00F3FF`, text becomes `#050505`.

**Ghost Variant**:
- Text: `#88888F`
- Hover: Text: `#E0E0E0`, background: `rgba(255, 255, 255, 0.05)`

### Cards/Containers

**Default Card Variant**:
- Background: `#0D0D0F`
- Border: `1px solid #2A2A2F`
- Top-left accent: 15px cyan horizontal line.
- Shadow: `var(--shadow-card-glow)`

**Highlight Card (Active Schedule/Feature)**:
- Border: `1px solid #FF00FF`
- Background: `linear-gradient(135deg, #0D0D0F 0%, #1A001A 100%)`

### Inputs

- Background: `#121214`
- Border: `1px solid #2A2A2F`
- Font: `font-label`
- Focus: Border color `#00F3FF`, box-shadow `var(--shadow-neon-cyan)`.
- Placeholder: `#4A4A4F`

---

## 4. Layout Strategy

**Grid Patterns**:
- **Hero/Header**: Asymmetrical 12-column grid. Text usually left-aligned with graphical "noise" or 3D elements on the right.
- **Content Sections**: Centered 8-column layout for readability, flanked by decorative vertical "data-lines".

**Spacing**: 
- Base Unit: `8px`
- Section Padding: `py-24` (desktop), `py-16` (mobile).

**Asymmetry Requirements**:
- Use `ml-auto` or `mr-auto` on section headers to create a zig-zag rhythm as the user scrolls.
- Decorative elements (corner brackets) should only appear on one or two corners of a container, never all four.

---

## 5. Non-Genericness (The Bold Factor)

1. **The Glitch Header**: The main H1 "CYBER-NIGHT" must have a CSS-driven glitch animation that triggers every 5-8 seconds.
2. **Vertical Navigation Labels**: Side-docked social links or section indicators rotated 90 degrees.
3. **Animated Borders**: Use `conic-gradient` to create a "running light" effect around the registration form.
4. **Data-Readout Metadata**: Small, flickering text next to headings like `[SEC_LEVEL: ALPHA]` or `[SYSTEM_TIME: 2024.10.31]`.
5. **Chromatic Aberration on Scroll**: A very subtle RGB split effect applied to the entire page body that intensifies slightly during fast scrolling.

---

## 6. Effects & Animation

**Motion Feel**: Snappy, mechanical, and high-frequency. Avoid "soft" or "bouncy" easings; prefer `cubic-bezier(0.19, 1, 0.22, 1)` (Expo Out).

**Transitions**:
```css
--transition-fast: all 0.15s cubic-bezier(0.23, 1, 0.32, 1);
--transition-standard: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
```

**Keyframe Animations**:
```css
@keyframes flicker {
  0% { opacity: 0.9; }
  5% { opacity: 0.4; }
  10% { opacity: 0.9; }
  15% { opacity: 1; }
  80% { opacity: 0.9; }
  100% { opacity: 1; }
}

@keyframes glitch-anim {
  0% { clip: rect(44px, 9999px, 56px, 0); transform: skew(0.5deg); }
  20% { clip: rect(12px, 9999px, 88px, 0); transform: skew(0.2deg); }
  /* ... more steps ... */
}
```

---

## 7. Iconography

**Icon Library**: `lucide-react`

**Style**: Stroke width `1.5px`. Use icons with sharp angles.

**Icon Containers**: Icons should be wrapped in a square border with a slight glow of `accentSecondary`.

---

## 8. Responsive Strategy

**Typography Scaling**:
- **Display**: `4rem` (Mobile) → `6rem` (Tablet) → `8rem` (Desktop)
- **Headers**: Scale down by 20% on mobile to prevent awkward wrapping.

**Layout Changes**:
- **Schedule**: Vertical timeline on mobile → Horizontal "railway" view on desktop.
- **Navigation**: Hidden behind a full-screen "System Overlay" on mobile.

---

## 9. Accessibility

**Contrast**: All text must maintain a minimum 4.5:1 ratio. Use `foreground` (#E0E0E0) on `background` (#050505).

**Focus States**:
```css
.focus-ring {
  outline: none;
  box-shadow: 0 0 0 2px #050505, 0 0 0 4px #00F3FF;
}
```

**Reduced Motion**: 
- Disable glitch animations and chromatic aberration if `(prefers-reduced-motion: reduce)` is detected.

---

## 10. Implementation Notes

- Use `Tailwind CSS` for all utility styling.
- Define custom colors in `tailwind.config.js` using the hex codes provided.
- Custom fonts should be loaded via `next/font/google`.
- All shared typography, `@keyframes`, and texture classes must live in `app/globals.css`.
- Use `framer-motion` for complex glitch and reveal animations.
- Avoid large images; prefer SVGs and CSS patterns to maintain "digital" sharpness and performance.
- Use `backdrop-blur-md` on navigation and cards for the "Glassmorphism" effect.