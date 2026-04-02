---
id: component.cta.conversion
kind: component-skill
sectionTypes: ["cta", "call-to-action", "final-cta", "signup"]
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
  Default skill for CTA sections. Produces a high-contrast, visually prominent
  call-to-action block designed to convert visitors.
---

# Component Skill: CTA — Conversion Block

## Purpose

This is the "closer" section — it appears near the bottom of the page and drives the primary conversion action. It must be visually distinct from surrounding sections.

## Layout

- Full-width or contained block with a contrasting background (accent gradient, dark panel, or colored fill).
- Centered content: headline, 1-line description, primary CTA button.
- Optional: secondary link, trust badges, or a small stat.

## Visual Quality Rules

1. **Background contrast** — the CTA section MUST visually break from the page. Use a gradient (`bg-gradient-to-r from-primary to-accent`), a dark panel with accent border, or a colored fill. Never the same background as adjacent sections.
2. **Large CTA button** — the button is the star. Make it big (`px-8 py-4 text-lg`), high contrast, with hover glow/scale effect. Use the primary action color.
3. **Headline** — short, action-oriented. "开始免费试用", "立即体验", "Join 10,000+ teams". Max 8 words.
4. **Urgency/value** — add one trust element: "免费开始", "无需信用卡", "30 秒注册", or a small stat.
5. **Whitespace** — generous vertical padding (`py-16` to `py-24`). The CTA needs breathing room.

## Content Rules

- Headline: imperative mood, benefit-focused.
- Description: one sentence reinforcing the value prop.
- Button text: action verb + object ("开始创建", "免费注册", "Get Started Free").
- All text in the project's language.

## Code Pattern

```tsx
return (
  <section className="py-20 px-6">
    <div className="max-w-4xl mx-auto rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 p-12 text-center">
      <h2 className="text-3xl font-bold">...</h2>
      <p className="mt-3 text-muted-foreground">...</p>
      <div className="mt-8 flex justify-center gap-4">
        <button className="...primary...">主要 CTA</button>
        <button className="...outline...">次要链接</button>
      </div>
    </div>
  </section>
)
```

## Anti-patterns

- CTA section looks the same as other sections — no visual break.
- Small, low-contrast button — defeats the purpose.
- Multiple competing CTAs — one primary action only.
- No headline, just a button — needs context.
