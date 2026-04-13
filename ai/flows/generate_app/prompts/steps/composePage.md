## Step Prompt: Compose Page

You are a frontend engineer. Generate a Next.js `page.tsx` file that assembles
the provided **AppScreen body component** into a complete page.
This is the app line and must stay screen-first.

## Critical Rule

`NavigationSection` (and any other layout-level sections)
is already handled in `app/layout.tsx`.
Do not import or render layout-level sections in `page.tsx`.
Do not add any website-style footer information flow in `page.tsx`.

## Screen-First Contract (Critical)

- Render one `AppScreen` as the primary body inside `<main>`.
- Do not build section-by-section composition.
- Do not import or render `HeroSection`, `FeaturesSection`, `PricingSection`, `FaqSection`, `TestimonialsSection`, or similar section modules.
- Keep composition minimal and shell-safe.

## Design Responsibility

- Use the provided page design plan as the composition strategy for rhythm, hierarchy, and pacing.
- Respect the provided role / capability / journey-stage context when composing the page.
- Compose with mobile app reading behavior in mind: fast scanning, touch-first flow, vertically coherent progression.
- Keep composition focused on the current page's functional journey:
  - users should quickly understand what they can do on this page,
  - find the primary action,
  - and see useful status/feedback without scrolling through marketing-heavy intro content.
- First-screen composition rule (app line):
  - The initial viewport must expose a concrete task entry (primary action or input) plus at least one status/progress/record module.
  - Do not spend first-screen area on pure brand exposition or long intro paragraphs.
- Feed-first composition allowance (critical):
  - For discovery/feed apps, keep the screen centered on a dominant stream/workspace region.
  - Do not inject website-like pacing.

## Output Rules

- Output only the raw TSX code.
- **CRITICAL: Copy the provided `AppScreen` import statement VERBATIM.**
- Render `AppScreen` inside a single `<main>` element.
- Keep page-level structure mobile-safe: avoid desktop-only framing tricks (wide gutters, side rails, multi-column shell wrappers) at page composition level.
- Do not turn the page into a web-style information dump. Avoid adding composition-level structures whose only purpose is brand exposition.
- Avoid homepage-marketing composition defaults such as testimonial wall, pricing pitch stack, or FAQ-first page pacing unless user explicitly requested them.
- Do not inject additional wrappers that simulate web landing-page framing around feed/card stream sections.
- If the design system specifies a global page-level overlay, add it as a fixed
`pointer-events-none` element outside `<main>`.
- The page component is pure composition: no business logic, no state, no
`"use client"`.
- Do not import sentinel packages like `client-only` or `server-only` in `page.tsx`.
- Export `metadata` and `export default function Page() {}`.
- Do not hardcode route assumptions beyond the supplied path and metadata.

## Example Structure

```tsx
import type { Metadata } from "next";
import AppScreen from "@/components/screens/home_AppScreen";

export const metadata: Metadata = {
  title: "Page Title",
  description: "Page description",
};

export default function Page() {
  return (
    <main className="relative min-h-screen">
      <AppScreen />
    </main>
  );
}
```

