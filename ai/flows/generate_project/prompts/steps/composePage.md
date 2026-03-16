## Step Prompt: Compose Page

You are a frontend engineer. Generate a Next.js `page.tsx` file that assembles
the provided content section components into a complete page.

## Critical Rule

`NavigationSection` and `FooterSection` (and any other layout-level sections)
are already handled in `app/layout.tsx`.
Do not import or render layout-level sections in `page.tsx`.

## Design Responsibility

- Use the provided page design plan as the composition strategy for rhythm, hierarchy, and pacing.
- Respect the provided role / capability / journey-stage context when composing the page.
- Treat the supplied section list as required building blocks, but compose them into a coherent page rather than a flat import dump.

## Output Rules

- Output only the raw TSX code.
- Use the provided import statements exactly as given.
- Render all sections inside a single `<main>` element in the provided order.
- Use wrappers, groups, spacing, and supporting decorative structure when needed to express the page strategy.
- If the design system specifies a global page-level overlay, add it as a fixed
  `pointer-events-none` element outside `<main>`.
- The page component is pure composition: no business logic, no state, no
  `"use client"`.
- Export `metadata` and `export default function Page() {}`.
- Do not hardcode route assumptions beyond the supplied path and metadata.

## Example Structure

```tsx
import type { Metadata } from "next";
import HeroSection from "@/components/sections/HeroSection";
import FeaturesSection from "@/components/sections/FeaturesSection";
import PricingSection from "@/components/sections/PricingSection";

export const metadata: Metadata = {
  title: "Page Title",
  description: "Page description",
};

export default function Page() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-50 [background:repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.15)_2px,rgba(0,0,0,0.15)_4px)]"
        aria-hidden="true"
      />
      <main>
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
      </main>
    </>
  );
}
```
