---
id: component.navigation.responsive
kind: component-skill
sectionTypes: ["navigation"]
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
  Default skill for navigation sections. Produces a responsive navbar with
  mobile hamburger menu, smooth transitions, and scroll-aware styling.
---

# Component Skill: Navigation — Responsive

## Layout

- Fixed or sticky top bar.
- Left: brand logo/name.
- Center or right: navigation links (desktop).
- Right: CTA button.
- Mobile: hamburger icon → full-screen or slide-down menu.

## Visual Quality Rules

1. **Backdrop blur** — use `bg-background/80 backdrop-blur-xl` for a glass effect when scrolling over content.
2. **Mobile menu** — must be implemented. Use `useState` for open/close. Animate with height transition or slide-in. Include all nav links + CTA.
3. **Active/hover states** — links need `hover:text-primary` or underline effect. Current page link should be visually distinct.
4. **CTA button** — the primary action button (e.g. "开始使用", "Sign Up") should use the accent/primary filled style, visually distinct from nav links.
5. **Border** — subtle bottom border `border-b border-white/10` to separate from content.
6. **Scroll behavior** — optional: add shadow or background opacity change on scroll using `useEffect` + scroll listener.

## Content Rules

- 3-5 nav links max. Keep it focused.
- Link text: short (1-2 words each).
- CTA: action-oriented button text.
- Brand: text logo or icon + name.
- All text in the project's language.

## Code Pattern

```tsx
"use client"
import { useState } from "react"
import { Menu, X } from "lucide-react"

export default function NavigationSection() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        {/* Brand */}
        {/* Desktop links */}
        {/* CTA button */}
        {/* Mobile toggle */}
        <button className="lg:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>
      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-white/10 px-6 py-4 space-y-3">
          {/* links + CTA */}
        </div>
      )}
    </nav>
  )
}
```

## Anti-patterns

- No mobile menu — broken on phones.
- Too many nav items (>6) — cluttered.
- CTA looks the same as nav links — no visual hierarchy.
- No backdrop blur — nav content unreadable over page content.
