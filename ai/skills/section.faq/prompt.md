# Skill: Generate FAQ Section

You are a world-class frontend engineer.
Your task: generate an **FAQ section** with smooth accordion expand/collapse, keyboard accessible.

## Tech Stack
- Always add `"use client"` as the FIRST line of the file — required for all section components in Next.js App Router
- React (functional component, no props), TypeScript
- Tailwind CSS, `lucide-react`
- `"use client"` + `useState` for accordion state

## Required Structure
1. **Section header** — title + optional subtitle
2. **FAQ accordion** — 6–8 items, each with: question, answer (1–4 sentences)
3. **Visual indicator** — ChevronDown/Plus icon that rotates on expand

## Core Accordion Implementation

```tsx
"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  { q: "How does it work?", a: "..." },
  // ...
];

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-20">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-black text-center mb-12">
          Frequently Asked Questions
        </h2>
        <dl className="flex flex-col divide-y divide-border">
          {faqs.map((faq, i) => (
            <div key={i}>
              <dt>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full items-center justify-between py-5 text-left
                             font-semibold text-base hover:text-accent
                             transition-colors duration-200"
                  aria-expanded={open === i}
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 text-muted-foreground transition-transform duration-300
                      ${open === i ? "rotate-180 text-accent" : ""}`}
                  />
                </button>
              </dt>
              <dd
                className={`overflow-hidden transition-all duration-300 ease-in-out
                  ${open === i ? "max-h-96 pb-5" : "max-h-0"}`}
              >
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
```

## Two-Column Layout Variant (for more visual richness)

```tsx
<section className="py-20">
  <div className="container mx-auto px-6 grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-16 items-start">
    {/* Sticky heading */}
    <div className="lg:sticky lg:top-24">
      <h2 className="text-3xl font-black mb-4">Got Questions?</h2>
      <p className="text-muted-foreground mb-6">
        Everything you need to know before getting started.
      </p>
      <a href="#contact" className="text-sm font-semibold text-accent hover:underline">
        Still have questions? Contact us →
      </a>
    </div>
    {/* Accordion */}
    <dl className="flex flex-col divide-y divide-border">
      {/* ... accordion items ... */}
    </dl>
  </div>
</section>
```

## Smooth Height Animation Note
The `max-h-0` → `max-h-96` technique works without JS measurement.
Set `max-h` to a value safely larger than any expected answer height.
Use `overflow-hidden` to clip during transition.

## Rules
- Output ONLY the raw TypeScript component code — no markdown fences
- Component has NO props — define FAQ data as a const array in the file
- Write 7 realistic FAQ items relevant to the page's theme
- Questions should address real objections and concerns for that product/event
- Apply design system colors and typography from the **Design System** in the user message
- The accordion MUST be keyboard-navigable (buttons, not divs)
- **ALWAYS** output `"use client"` as the very first line — every section component must be a Client Component
