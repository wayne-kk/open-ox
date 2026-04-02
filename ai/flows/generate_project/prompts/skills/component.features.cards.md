---
id: component.features.cards
kind: component-skill
sectionTypes: ["features", "highlights", "benefits", "services"]
priority: 60
fallback: true
when:
  designKeywords:
    any: []
    none: []
  capabilityAssists:
    any: []
    none: []
  journeyStages:
    any: []
    none: []
  productTypes:
    any: []
    none: []
notes: |
  Default skill for feature/highlight sections. Produces a responsive card grid
  with icons, hover effects, and staggered entrance animations.
---

# Component Skill: Features — Card Grid

Use this skill for any section that showcases features, benefits, highlights, or services as a collection of items.

## Layout

- Section title + optional subtitle at the top, centered.
- Below: responsive grid of feature cards.
  - Mobile: 1 column
  - Tablet (sm): 2 columns
  - Desktop (lg): 3 or 4 columns depending on item count
- Each card contains: icon/emoji, title (h3), short description (1-2 lines).

## Visual Quality Rules

1. **Cards must have visible boundaries** — use `border`, `bg-*` fill, or `shadow` so cards are distinct from the background. A card with no visual boundary looks broken.
2. **Hover interaction** — every card must have a hover state: `hover:border-{accent}`, `hover:shadow-*`, or `hover:-translate-y-1`. Static cards feel dead.
3. **Icons** — use `lucide-react` icons. Pick icons that semantically match the feature. Size: `h-6 w-6` or `h-8 w-8`. Wrap in a colored circle/rounded-square container for visual weight.
4. **Staggered entrance** — if using `framer-motion`, stagger card entrance by 0.1s each. If not using motion, use CSS `transition-delay` on hover effects.
5. **Spacing** — generous padding inside cards (`p-6` or `p-8`). Gap between cards: `gap-4` to `gap-6`.
6. **Color accent** — icon containers or card borders should use the design system's accent/primary color, not just gray.

## Content Rules

- Feature titles: 2-4 words, action-oriented or benefit-focused.
- Descriptions: 1-2 sentences max. Concrete, not vague.
- All text must be in the project's language (from `language` field).
- Use real content derived from the project brief — never "Feature 1", "Lorem ipsum".

## Code Pattern

```tsx
const features = [
  { icon: IconComponent, title: "...", description: "..." },
  // 3-6 items
]

return (
  <section className="py-20 px-6">
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <h2>...</h2>
        <p>...</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map(...)}
      </div>
    </div>
  </section>
)
```

## Anti-patterns to Avoid

- Cards with no border, no background, no shadow — invisible cards.
- All icons the same or generic (Star, Circle).
- Descriptions longer than 3 lines — keep it scannable.
- No hover state — feels static and unfinished.
