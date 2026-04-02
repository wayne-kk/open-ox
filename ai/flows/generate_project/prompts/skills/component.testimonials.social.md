---
id: component.testimonials.social
kind: component-skill
sectionTypes: ["testimonials", "reviews", "social-proof"]
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
  Default skill for testimonial/review sections. Produces quote cards with
  avatars, names, roles, and optional star ratings.
---

# Component Skill: Testimonials — Social Proof

## Layout Options (pick one based on count)

- **3 cards**: grid `sm:grid-cols-3`, equal height.
- **4+ cards**: horizontal scroll carousel or 2-row grid.
- **1-2 cards**: large centered quote with prominent avatar.

## Visual Quality Rules

1. **Quote marks** — use large decorative quote marks (`"` or `❝`) as a visual element. Size `text-4xl` to `text-6xl`, accent color, low opacity.
2. **Avatar** — circular, `h-12 w-12` or `h-14 w-14`. Use initials in a colored circle as placeholder (since we can't use real photos). Background color derived from the person's name hash.
3. **Attribution** — name in bold, role/company in muted text below. Always include both.
4. **Card style** — subtle border or background fill. Optional: left accent border in primary color.
5. **Star rating** — optional. If used, show filled/empty stars with `lucide-react` Star icon.

## Content Rules

- Quotes: 1-3 sentences. Specific and believable — mention the product/feature by name.
- Names: realistic for the project's target audience and language.
- Roles: specific ("产品经理 @ 字节跳动", "CTO at Stripe"), not generic ("用户").
- 3-6 testimonials total.
- All text in the project's language.

## Code Pattern

```tsx
const testimonials = [
  { quote: "...", name: "...", role: "...", company: "..." },
]

// Avatar with initials
function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2)
  return (
    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
      {initials}
    </div>
  )
}
```

## Anti-patterns

- Generic quotes: "很好用" / "Great product" — too vague.
- Missing attribution — anonymous quotes have no credibility.
- All avatars identical — vary the colors.
- Quote text too long (>4 sentences) — loses impact.
