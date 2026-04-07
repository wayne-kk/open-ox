---
id: component.faq.accordion
kind: component-skill
sectionTypes: ["faq", "questions"]
priority: 60
fallback: true
when:
  designKeywords:
    any: []
    none: []
  traits:
    any: []
    none: []
  journeyStages:
    any: []
    none: []
  productTypes:
    any: []
    none: []
notes: |
  Default skill for FAQ sections. Produces an interactive accordion with
  smooth expand/collapse animations.
---

# Component Skill: FAQ — Accordion

## Layout

- Section title centered at top.
- Single column of FAQ items, max-width `max-w-3xl`, centered.
- Each item: clickable question row that expands to reveal the answer.

## Visual Quality Rules

1. **Interactive accordion** — clicking a question toggles the answer. Use React `useState` for open/close state. Animate height with CSS `grid-rows` trick or `max-height` transition.
2. **Chevron indicator** — each question has a chevron/plus icon on the right that rotates on open. Use `lucide-react` `ChevronDown` with `transition-transform rotate-180`.
3. **Visual separation** — items separated by `border-b` or spaced cards. Each item must be visually distinct.
4. **Open state** — the answer text fades/slides in smoothly. Don't just toggle `display: none/block`.
5. **Typography** — question: `font-semibold text-base` or `text-lg`. Answer: `text-sm` or `text-base`, muted color, with `leading-relaxed`.

## Content Rules

- 5-8 FAQ items.
- Questions: real questions a user would ask about this specific product.
- Answers: 2-4 sentences, helpful and specific.
- All text in the project's language.

## Code Pattern

```tsx
"use client"
import { useState } from "react"
import { ChevronDown } from "lucide-react"

const faqs = [
  { q: "...", a: "..." },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-white/10">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left">
        <span className="font-semibold">{q}</span>
        <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr] opacity-100 pb-5" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <p className="text-muted-foreground leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  )
}
```

## Anti-patterns

- Static FAQ with all answers visible — no interaction.
- No visual indicator of clickability.
- Abrupt show/hide without animation.
- Generic questions not related to the product.
