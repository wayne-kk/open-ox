# Skill: Generate Testimonials Section

You are a world-class frontend engineer.
Your task: generate a **Testimonials section** that builds trust through authentic-feeling social proof.

## Tech Stack
- React (functional component, no props), TypeScript
- Tailwind CSS, `lucide-react`
- `"use client"` only if using a carousel with state

## Required Structure
1. **Section header** — title (e.g., "What Our Users Say") + optional aggregate rating badge
2. **Testimonial cards** — 4–8 reviews, each with: quote text, reviewer name, role/company, avatar placeholder, star rating
3. **Attribution** — platform logo or source label (optional)

## Layout Patterns

**A. 3-Column Masonry Grid (default):**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {testimonials.map((t, i) => (
    <figure key={i}
      className="relative p-6 rounded-2xl border border-border bg-card
                 hover:border-[var(--color-accent)]/50 transition-colors duration-300">
      {/* Stars */}
      <div className="flex gap-1 mb-4">
        {Array.from({ length: 5 }).map((_, si) => (
          <Star key={si} className={`w-4 h-4 ${si < t.rating ? "fill-[var(--color-accent)] text-[var(--color-accent)]" : "text-muted-foreground/30"}`} />
        ))}
      </div>
      {/* Quote */}
      <blockquote className="text-sm leading-relaxed text-foreground/80 mb-6">
        "{t.quote}"
      </blockquote>
      {/* Reviewer */}
      <figcaption className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                        bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
          {t.name.charAt(0)}
        </div>
        <div>
          <div className="font-semibold text-sm">{t.name}</div>
          <div className="text-xs text-muted-foreground">{t.role}, {t.company}</div>
        </div>
      </figcaption>
    </figure>
  ))}
</div>
```

**B. Infinite Marquee Scroll (CSS-only, for visual richness):**
```tsx
"use client";

// Requires globals.css to have:
// @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
// .animate-marquee { animation: marquee 30s linear infinite; }

<div className="overflow-hidden">
  <div className="flex gap-6 animate-marquee w-max">
    {/* Duplicate cards twice for seamless loop */}
    {[...testimonials, ...testimonials].map((t, i) => (
      <figure key={i} className="w-80 shrink-0 p-6 rounded-2xl border border-border bg-card">
        {/* ... card content ... */}
      </figure>
    ))}
  </div>
</div>
```

Only use marquee if the design system has an energetic, dynamic style.
Otherwise, use the grid layout.

## Quote Mark Decoration

```tsx
{/* Large decorative quote mark */}
<div aria-hidden className="absolute top-4 right-6 text-6xl font-serif leading-none
                             text-[var(--color-accent)]/15 select-none">
  "
</div>
```

## Aggregate Rating Badge (for section header)

```tsx
<div className="flex items-center gap-3 justify-center mb-12">
  <div className="flex gap-1">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className="w-5 h-5 fill-[var(--color-accent)] text-[var(--color-accent)]" />
    ))}
  </div>
  <span className="font-bold text-lg">4.9/5</span>
  <span className="text-muted-foreground text-sm">from 2,400+ reviews</span>
</div>
```

## Rules
- Output ONLY the raw TypeScript component code — no markdown fences
- Component has NO props — define testimonial data inside the file
- Write 6 realistic testimonials relevant to the page's theme/product
- Each testimonial must feel authentic: specific details, not generic praise
- Apply design system colors, typography, and component styles
- Use `Star` from `lucide-react` for ratings
