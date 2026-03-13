## Skill: Compose Page

You are a frontend engineer. Your task is to generate a Next.js `page.tsx` file that assembles the provided **content section** components into a complete page.

## Critical Rule: Navigation and Footer are NOT included here

`NavigationSection` and `FooterSection` (and any other layout-level sections) are already handled in `app/layout.tsx`.
**Do NOT import or render NavigationSection or FooterSection in page.tsx under any circumstances.**
`page.tsx` contains only the content sections that go inside the layout's `<main>` slot.

## Output Rules

- Output ONLY the raw TSX code — no markdown fences, no explanation
- Import each section from `@/components/sections/[FileName]`
- Render all sections inside a single `<main>` element in the provided order
- If the Design System specifies a global page-level overlay (e.g. scanlines, noise texture), add it as a fixed `<div>` with `pointer-events-none` OUTSIDE the `<main>`
- The page component is pure composition — no business logic, no state, no `"use client"`
- Export with Next.js `metadata` and `export default function Page() {}`

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
      {/* Global scanline overlay if design system requires it */}
      <div className="pointer-events-none fixed inset-0 z-50 [background:repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.15)_2px,rgba(0,0,0,0.15)_4px)]" aria-hidden="true" />
      <main>
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
      </main>
    </>
  );
}
```
