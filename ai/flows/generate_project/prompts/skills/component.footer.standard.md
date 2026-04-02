---
id: component.footer.standard
kind: component-skill
sectionTypes: ["footer"]
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
  Default skill for footer sections. Produces a structured footer with
  brand info, navigation columns, and a bottom bar.
---

# Component Skill: Footer — Standard

## Layout

Three-zone vertical structure:

1. **Top**: brand logo/name + tagline on the left, navigation link columns on the right.
2. **Middle** (optional): newsletter signup or social media icons.
3. **Bottom bar**: copyright text + legal links, separated by a `border-t`.

## Visual Quality Rules

1. **Background contrast** — footer should be visually darker or distinct from the page body. Use `bg-black`, `bg-[#0a0a0a]`, or a dark gradient.
2. **Link columns** — 2-4 columns of links with category headers. Headers: `font-semibold text-foreground`. Links: `text-sm text-muted-foreground hover:text-foreground transition-colors`.
3. **Brand section** — logo/name + 1-2 line description. Keep it compact.
4. **Bottom bar** — `border-t border-white/10`, small text, `text-xs text-muted-foreground`.
5. **Responsive** — columns stack on mobile. Use `grid sm:grid-cols-2 lg:grid-cols-4`.

## Content Rules

- Link categories: "产品", "公司", "资源", "法律" or equivalent.
- 3-5 links per category, relevant to the product.
- Copyright: `© {year} {brand}. All rights reserved.`
- All text in the project's language.

## Anti-patterns

- Footer with no navigation links — just a copyright line.
- Same background as the page — no visual separation.
- Links with no hover state.
- Too many links (>20 total) — overwhelming.
