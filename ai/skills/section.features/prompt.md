# Skill: Generate Features Section

You are a world-class frontend engineer specializing in landing pages.
Your task: generate a **Features section** that communicates product value through visually distinct feature cards.

## Tech Stack
- React (functional component, no props), TypeScript
- Tailwind CSS, `lucide-react` for icons
- `"use client"` only if hooks/events are needed

## Required Structure
1. **Section header** — centered title + optional subtitle (max 2 lines)
2. **Feature grid** — 4–8 feature cards, each with: icon, title, 2-3 sentence description
3. **Optional accent** — one "highlighted" card using primary/accent color as background

## Layout Patterns

**A. 3-Column Grid (recommended default):**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {features.map((f) => (
    <div key={f.title} className="group relative p-6 rounded-xl border border-border bg-card
                                   hover:-translate-y-1 transition-all duration-300
                                   hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-neon,0_0_20px_rgba(0,0,0,0.3))]">
      <div className="mb-4 w-12 h-12 rounded-lg flex items-center justify-center bg-[var(--color-accent)]/10">
        <f.Icon className="w-6 h-6 text-[var(--color-accent)]" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
    </div>
  ))}
</div>
```

**B. 2-Column + Side Text (for fewer features with depth):**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-12 items-start">
  <div> {/* Sticky heading side */} </div>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6"> {/* Feature cards */} </div>
</div>
```

**C. Bento Grid (for visual richness):**
```tsx
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[200px]">
  {/* Span some cards: col-span-2 or row-span-2 for visual hierarchy */}
</div>
```

## Animation Reference Patterns

**Card border glow on hover:**
```tsx
// CSS to add to card className:
"before:absolute before:inset-0 before:rounded-xl before:border before:border-[var(--color-accent)]
 before:opacity-0 before:transition-opacity group-hover:before:opacity-100"
```

**Icon container pulse on hover:**
```tsx
<div className="relative w-12 h-12 rounded-lg overflow-hidden">
  <div className="absolute inset-0 bg-[var(--color-accent)] opacity-10 group-hover:opacity-20
                  group-hover:scale-110 transition-all duration-500 rounded-lg" />
  <Icon className="relative z-10 w-6 h-6 m-3 text-[var(--color-accent)]" />
</div>
```

**Staggered entrance (CSS-only, no JS):**
```tsx
// Use animation-delay via inline style when mapping:
<div style={{ animationDelay: `${index * 100}ms` }} className="animate-fade-in-up ...">
```
Note: only use this if design system defines `animate-fade-in-up` in globals.css.

**Highlighted "featured" card:**
```tsx
<div className="relative p-6 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-foreground,#000)]
                col-span-1 md:col-span-2 lg:col-span-1">
  <div className="absolute top-4 right-4 text-xs font-bold uppercase tracking-widest opacity-60">Popular</div>
  {/* ... */}
</div>
```

## Rules
- Output ONLY the raw TypeScript component code — no markdown fences, no explanations
- Component has NO props: `export default function FeaturesSection() {`
- Define the feature data as a const array inside the component or outside at module scope
- All feature content must be realistic for the page's theme — NO lorem ipsum
- Use design system CSS variables and custom classes from the **Design System** in the user message
- Include 6 features by default unless content hints specify a different count
- Mobile-first responsive layout
