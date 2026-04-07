---
id: component.pricing.table
kind: component-skill
sectionTypes: ["pricing", "plans"]
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
  Default skill for pricing sections. Produces a responsive pricing card layout
  with a highlighted recommended plan and clear feature comparison.
---

# Component Skill: Pricing — Card Table

## Layout

- Section title + subtitle centered at top.
- 2-4 pricing cards in a row (responsive: stack on mobile).
- One card visually highlighted as "recommended" / "popular" — larger scale, accent border, or badge.

## Visual Quality Rules

1. **Card differentiation** — the recommended plan must be visually distinct: `scale-105`, accent `border-2`, a "推荐" / "Popular" badge, or elevated shadow.
2. **Price typography** — price number is the largest text in the card (`text-4xl` or `text-5xl`). Currency symbol and period ("/月", "/year") are smaller.
3. **Feature list** — each plan has a checklist of features. Use checkmark icons (✓) for included, muted/crossed for excluded. Align lists across cards for easy comparison.
4. **CTA button** — every card has a CTA. The recommended plan's CTA uses the primary/accent filled style; others use outline.
5. **Card boundaries** — clear borders or backgrounds. Cards must be visually contained.

## Content Rules

- Plan names: short (1-2 words): "免费", "专业", "企业" or "Starter", "Pro", "Enterprise".
- Prices: realistic for the product type. Use the project's language for currency/period.
- Features: 4-8 per plan, concrete and specific to the product.
- All text in the project's language.

## Code Pattern

```tsx
const plans = [
  { name: "...", price: "...", period: "...", features: [...], cta: "...", highlighted: false },
  { name: "...", price: "...", period: "...", features: [...], cta: "...", highlighted: true },
  { name: "...", price: "...", period: "...", features: [...], cta: "...", highlighted: false },
]
```

## Anti-patterns

- All cards look identical — no visual hierarchy.
- Price text same size as description — no emphasis.
- Missing CTA on any card.
- Feature lists with vague items like "高级功能" without specifics.
