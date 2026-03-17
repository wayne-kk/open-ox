---
id: component.hero.editorial
kind: component-skill
sectionTypes: ["hero"]
priority: 70
fallback: false
when:
  designKeywords:
    any: ["editorial", "magazine", "story", "narrative", "manifesto", "premium", "luxury", "publication"]
    none: []
  capabilityAssists:
    any: ["pattern.hero.editorial"]
    none: []
  journeyStages:
    any: ["consideration", "education", "storytelling"]
    none: []
  productTypes:
    any: ["brand-site", "portfolio", "publication"]
    none: []
notes: |
  Use for story-forward, premium editorial heroes that feel like a magazine cover
  or manifesto opener. Prioritize typography, narrative hierarchy, and negative space
  over loud motion or heavy UI chrome.
---

# Component Skill: Hero — Editorial Narrative

Use this skill when generating a hero section that should feel like a premium editorial spread, magazine cover, or brand manifesto. The hero should communicate depth, story, and craft rather than raw energy.

## Design Principles

1. **Story-first** — Lead with a sharp narrative hook, not just a slogan.
2. **Typographic hierarchy** — Type does most of the visual work; composition and spacing support it.
3. **Calm confidence** — Avoid over-decoration; let restraint signal quality and seriousness.
4. **Layered reading** — Provide an obvious first read, then richer secondary and tertiary details.

## Structure Requirements

- **Headline**: 6–14 words. Use `font-display` or `font-header` depending on the design system. It should read like a cover line or manifesto, not clickbait.
- **Subheading**: 1–3 sentences. Use `font-body`. Expand on the narrative: who this is for, what story or transformation they’re stepping into.
- **Eyebrow / Kicker**: Optional short label above the headline using `font-label` to situate context (e.g. “Film Series”, “Director’s Cut”, “Studio Journal”).
- **CTA block**: Primary CTA with clear label; secondary CTA may point to deeper content (case studies, stories, or archives). Do not overload CTAs.
- **Meta row**: Optional compact row for metadata (publish date, category, reading time, season) using `font-label`.
- **Visual layer**: Prefer still imagery, art-directed photography, or restrained abstract compositions over noisy gradients. Motion, if any, should be subtle (hover reveals, gentle parallax, opacity shifts).

## Layout Patterns

- **Editorial split**: Copy column (headline, subhead, CTAs) on one side; supporting visual or stacked stories on the other. On mobile, stack in a way that keeps the headline above the fold.
- **Full-bleed cover**: Large visual with overlaid type in a constrained content column. Protect text contrast carefully.
- **Asymmetric grid**: Use off-center composition, overlapping cards, or staggered columns to echo print layouts while preserving clarity.

## Typography Hierarchy

- `font-display` → Flagship headline or single-word masthead.
- `font-header` → Secondary headings, story titles, pull-quotes.
- `font-body` → Narrative copy blocks, descriptions, supporting text.
- `font-label` → Eyebrow text, metadata, categories, subtle navigational hints.

## Visual Impact

- Use semantic tokens for color, shadow, and depth; never define one-off styles in the component.
- Contrast: Ensure headline and key copy exceed accessibility contrast requirements against their backgrounds.
- Depth: Use layering (overlapping cards, masks, soft shadows) to suggest print-like tactility without clutter.
- Motion: If `effect.motion.ambient` is present, keep motion soft and slow (e.g. drifting gradient, gentle image parallax). Avoid anything that feels like a banner ad.

## Constraints

- Output only raw TSX. No markdown fences, no prose comments.
- Default to Server Component unless hooks, `framer-motion`, or browser APIs are clearly required.
- Use realistic, editorially plausible copy. No lorem ipsum, no generic “Hero headline”.
- Design mobile-first, ensuring headlines wrap gracefully and CTAs remain legible.
- All shared effects, keyframes, and font roles must live in `app/globals.css`; reference tokens instead of redefining them.

