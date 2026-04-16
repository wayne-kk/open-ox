---

id: component.hero.dashboard
kind: component-skill
sectionTypes: ["hero"]
priority: 80
fallback: false
when:
  designKeywords:
    any: ["dashboard", "analytics", "metrics", "saas", "monitoring", "control"]
    none: ["particle", "粒子", "generative", "canvas", "kinetic", "editorial"]
  traits:
    any: ["product-led", "data-driven"]
    none: []
  journeyStages:
    any: ["activation", "retention", "product-evaluation"]
    none: []
  productTypes:
    any: ["saas-app", "analytics-tool", "b2b-platform"]
    none: []
notes: |
  Use for product-led, metrics-focused heroes where the main proof is UI previews,
  live stats, or analytics surfaces. The goal is to make the product feel powerful,

##   legible, and immediately graspable.

# Component Skill: Hero — Product Dashboard

Use this skill when generating a hero section that should showcase a digital product, dashboard, or analytics surface as the primary proof. The hero should feel like a controlled, information-rich cockpit rather than a marketing poster.

## Design Principles

1. **Product as hero** — The interface preview is the star; layout and copy frame it.
2. **Legible data** — Charts, numbers, and UI elements must be readable and plausible at a glance.
3. **Signal control and reliability** — Avoid chaotic visuals; emphasize structure, clarity, and stability.
4. **On-ramp to action** — CTAs should feel like stepping into the product, not just “learn more”.

## Structure Requirements

- **Headline**: 6–14 words. Use `font-display` or `font-header`. Focus on the outcome the product enables (e.g. “See every campaign in one live dashboard”).
- **Subheading**: 1–3 sentences. Use `font-body`. Clarify who the product is for and what specific control/insight they gain.
- **Metrics strip**: Optional row of 2–4 key metrics or mini-cards (e.g. “↑ 37% conversion”, “< 2 min setup”). Use `font-label` for labels and `font-header` or emphasized `font-body` for values.
- **CTA block**: Primary CTA (e.g. “Start free trial”, “Launch live demo”) and optional secondary CTA (e.g. “View sample dashboard”). Use strong contrast and clear labels.
- **Product preview**: A structured container that shows the product UI: navigation, main chart, supporting panels. It should feel like a real app layout, not random boxes.

## Layout Patterns

- **Split product-led**: Copy + CTAs in a column; product preview occupying the opposite side with generous space.
- **Stacked with emphasis**: On mobile, stack copy first, then a single, clear product preview that stays readable on small screens.
- **Layered previews**: Overlapping windows or cards can suggest multiple views, but keep the primary preview dominant and uncluttered.

## Typography Hierarchy

- `font-display` / `font-header` → Main headline and key metric values.
- `font-body` → Supporting copy, explanations, and descriptive labels.
- `font-label` → Navigation labels, axis labels, legend text, badges, and metric descriptors.

## Visual Impact

- Use semantic tokens for backgrounds and surfaces to differentiate app chrome, content panels, and page backdrop.
- Contrast: Ensure charts, numbers, and text have sufficient contrast against their panels; avoid low-contrast “fake data”.
- Depth: Use shadow tokens and layering to make the product preview feel clickable and grounded, not like a flat mock.
- Motion: If `effect.motion.energetic` or `effect.motion.ambient` is present, keep motion focused on subtle UI affordances (hover glows, blinking cursors, pulsing active states), never on wild background animations.

## Constraints

- Output only raw TSX. No markdown fences, no prose comments.
- Default to Server Component unless client-only behavior is clearly needed.
- Use realistic, domain-appropriate sample data and labels. Avoid “Chart title” or “123k users” without context.
- Design mobile-first: product previews must remain legible and not degrade into tiny, unreadable thumbnails.