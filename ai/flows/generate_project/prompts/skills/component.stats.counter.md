---
id: component.stats.counter
kind: component-skill
sectionTypes: ["stats", "metrics", "numbers", "achievements"]
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
  Default skill for stats/metrics sections. Produces animated number counters
  with labels, using intersection observer for scroll-triggered animation.
---

# Component Skill: Stats — Animated Counters

## Layout

- 3-4 stat items in a horizontal row (responsive: 2x2 grid on mobile).
- Optional: section title above, or stats embedded in a colored/gradient banner.
- Each stat: large number + unit label below.

## Visual Quality Rules

1. **Animated count-up** — numbers animate from 0 to target value when scrolled into view. Use `useEffect` + `IntersectionObserver` to trigger. Animate over 1.5-2s with easing.
2. **Number typography** — the number is the hero: `text-4xl` to `text-6xl`, `font-bold`, accent/primary color.
3. **Suffix/prefix** — support "10K+", "99%", "$2M", "24/7". The suffix (K+, %, etc.) should be slightly smaller than the number.
4. **Labels** — short descriptor below each number: "活跃用户", "客户满意度", "项目完成". Muted color, `text-sm`.
5. **Visual container** — either a full-width gradient/colored band, or individual stat cards with borders.

## Content Rules

- 3-4 stats that are impressive and relevant to the product.
- Numbers should be realistic and specific (not "很多用户" but "10,000+").
- All text in the project's language.

## Code Pattern

```tsx
"use client"
import { useEffect, useRef, useState } from "react"

function useCountUp(target: number, duration = 2000) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const start = performance.now()
      function tick() {
        const elapsed = performance.now() - start
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
        setCount(Math.floor(eased * target))
        if (progress < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, { threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, duration])

  return { count, ref }
}
```

## Anti-patterns

- Static numbers with no animation — misses the "wow" moment.
- Numbers too small to read or same size as labels.
- Vague labels: "数据" instead of "处理的数据量".
- More than 5 stats — dilutes impact.
