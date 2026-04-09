## Step Prompt: Compose Page

You are a frontend engineer. Generate a Next.js `page.tsx` file that assembles
the provided content section components into a complete page.

## Critical Rule

`NavigationSection` and `FooterSection` (and any other layout-level sections)
are already handled in `app/layout.tsx`.
Do not import or render layout-level sections in `page.tsx`.

## Section Layout Contract (Critical)

Each section component already implements its own layout: an outer full-width layer
for background and an inner `container mx-auto px-* py-*` for content (per project
section layout rules). **Do not** wrap section imports in extra `<section>`,
`container`, `mx-auto`, `px-`*, `py-`*, or `max-w-*` — that duplicates padding and
width constraints and breaks rhythm.

- Render sections **directly** as siblings inside `<main>`: `<HeroSection />`,
`<FeaturesSection />`, etc.
- Page-level composition may add **only**: global fixed overlays outside `<main>`,
optional decorative non-layout elements, or a minimal wrapper when an effect truly
requires a positioned ancestor (e.g. one absolute child next to the hero). Never
use `border-t` / `border-b` / `divide-`* / `<hr />` between sections on the page
file; spacing and separation belong inside section components or via background
contrast.

## Design Responsibility

- Use the provided page design plan as the composition strategy for rhythm, hierarchy, and pacing.
- Respect the provided role / capability / journey-stage context when composing the page.
- Treat the supplied section list as required building blocks, but compose them into a coherent page rather than a flat import dump.

## Output Rules

- Output only the raw TSX code.
- **CRITICAL: Copy the provided import statements VERBATIM. Do not change the import paths, component names, or file names. The import paths are pre-computed and correct.**
- Render all sections inside a single `<main>` element in the provided order.
- Use only global overlays or minimal decorative structure when needed; do not add
per-section spacing or container wrappers (see Section Layout Contract above).
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
// Import paths follow the pattern: @/components/sections/{slug}_{ComponentName}
import HeroSection from "@/components/sections/home_HeroSection";
import FeaturesSection from "@/components/sections/home_FeaturesSection";
import PricingSection from "@/components/sections/home_PricingSection";

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
      <main className="relative min-h-screen">
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
      </main>
    </>
  );
}
```

