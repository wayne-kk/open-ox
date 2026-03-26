---
id: component.hero.impactful
kind: component-skill
sectionTypes: ["hero"]
priority: 60
fallback: true
when:
  designKeywords:
    any: ["bold", "vibrant", "energetic", "neon", "cyber", "futuristic", "tech", "glow", "festival", "rave", "acid", "dark", "dramatic", "immersive", "animated", "dynamic"]
    none: ["editorial", "magazine", "luxury", "minimal", "dashboard", "analytics", "shader", "webgl"]
  capabilityAssists:
    any: ["effect.motion.energetic", "pattern.hero.centered", "pattern.hero.split"]
    none: []
  journeyStages:
    any: ["acquisition", "campaign", "launch", "activation"]
    none: []
  productTypes:
    any: ["marketing-site", "campaign-site", "brand-site", "portfolio"]
    none: []
notes: |
  Default high-impact hero skill. Use for energetic, bold, visually striking heroes
  including neon/cyber/tech aesthetics. Fallback when no more specific skill applies.
---

# Component Skill: Hero — High-Impact

Use this skill when generating a hero section that must create immediate visual and emotional impact. The hero is the first thing visitors see; it should feel intentional, distinctive, and aligned with the design system.

## Design Principles

1. **Lead with one idea** — One headline, one primary CTA. Avoid decision fatigue.
2. **Clarity over cleverness** — Visitors should understand the value proposition within 3 seconds.
3. **Emotion before layout** — Decide the feeling (trust, excitement, serenity) and let it drive hierarchy and contrast.
4. **Singular focus** — One primary CTA, one clear next step. No competing actions.

## Structure Requirements

- **Headline**: 6–12 words max. Use `font-display` for hero wordmarks and mastheads. Strong contrast, no ambiguity.
- **Subheading**: 1–2 sentences. Use `font-body`. Clarifies what you offer and why it matters.
- **CTA block**: Primary button with high contrast; optional secondary (ghost/outline). Use `font-label` for button text.
- **Visual layer**: At least one of: textured background, gradient mesh, decorative shape, badge, or subtle animated layer. Must reinforce the message, not distract.
- **Social proof**: Compact element — avatar stack, rating row, usage stat, or trust badge. Use `font-label`.

## Layout Patterns

- **Split layout**: Text + CTA on one side; visual (mockup, illustration, or abstract shape) on the other. On mobile: stack vertically, text first.
- **Centered layout**: Full-bleed, layered backgrounds, focused headline stack. Use when campaign-like, event-like, or poster-like.
- **Asymmetry**: Prefer intentional imbalance over generic centered blocks. Create visual tension that resolves at the CTA.

## Typography Hierarchy

- `font-display` → Hero headline only (the main wordmark or masthead).
- `font-header` → Subheadings (h2, h3) if present.
- `font-body` → Supporting copy, descriptions.
- `font-label` → Eyebrow text, badges, metadata, CTA labels.

## Visual Impact

- Use design tokens for color, shadow, and animation.
- Contrast: Ensure headline and CTA stand out against background. Use `--color-accent`, `--shadow-*`, and semantic tokens.
- Depth: Layered backgrounds, subtle gradients, or texture classes from `globals.css` create depth without clutter.
- Motion: If `effect.motion.ambient` or `effect.motion.energetic` is in capability assists, use restrained motion (e.g. subtle glow, gentle parallax). Never block the fold or slow load.

## Constraints

- Output only raw TSX. No markdown fences, no prose.
- Default to Server Component unless hooks, `framer-motion`, or browser APIs are required.
- Use realistic, contextually relevant copy. Never placeholder text.
- Mobile-first: readable and compelling on small screens first.
