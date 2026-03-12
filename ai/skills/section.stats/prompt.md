# Skill: Generate Stats Section

You are a world-class frontend engineer.
Your task: generate a **Stats/Metrics section** with impactful large numbers and optional animated counter.

## Tech Stack
- React (functional component, no props), TypeScript
- Tailwind CSS, `lucide-react`
- `"use client"` + `useEffect` + `useRef` for counter animation

## Required Structure
1. **Optional header** — short section title (e.g., "By the Numbers")
2. **Stats grid** — 3–5 stat items, each with: large number/value, unit prefix/suffix, label, optional icon
3. **Dividers** — visual separators between stats (vertical lines or subtle borders)

## Layout Pattern

```tsx
<section className="py-20 border-y border-border">
  <div className="max-w-6xl mx-auto px-6">
    <dl className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 md:divide-x divide-border">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col items-center text-center px-8 py-4 gap-2">
          {stat.icon && <stat.icon className="w-6 h-6 text-[var(--color-accent)] mb-2" />}
          <dt className="text-4xl md:text-5xl font-black tabular-nums text-foreground">
            <span className="text-[var(--color-accent)]">{stat.prefix}</span>
            <CountUp target={stat.value} />
            <span className="text-[var(--color-accent)]">{stat.suffix}</span>
          </dt>
          <dd className="text-sm text-muted-foreground font-medium uppercase tracking-widest">
            {stat.label}
          </dd>
        </div>
      ))}
    </dl>
  </div>
</section>
```

## Animated Counter Component (Intersection Observer)

```tsx
"use client";
import { useEffect, useRef, useState } from "react";

function CountUp({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = performance.now();
          const tick = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
            else setCount(target);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}
```

## Data Format

```tsx
const stats = [
  { value: 50000, prefix: "", suffix: "+", label: "Active Users", icon: Users },
  { value: 99, prefix: "", suffix: "%", label: "Uptime SLA", icon: Shield },
  { value: 4.9, prefix: "", suffix: "/5", label: "Average Rating", icon: Star },
  { value: 120, prefix: "", suffix: "+", label: "Countries", icon: Globe },
];
```

For non-integer targets (like 4.9), adjust CountUp to use `toFixed(1)` and step by 0.1.

## Rules
- Output ONLY the raw TypeScript component code — no markdown fences
- Component has NO props — define stats data inside the file
- Use `"use client"` and implement `CountUp` as an inner component
- Numbers must be realistic for the page's theme and industry
- Apply design system colors, typography, and spacing
- Section background should be subtly different (border-y, slight bg tint) to visually separate from adjacent sections
