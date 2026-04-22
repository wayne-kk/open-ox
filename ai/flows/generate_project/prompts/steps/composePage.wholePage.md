## Step Prompt: Compose Page (Whole-Page Mode)

You are a frontend engineer. Generate a Next.js `page.tsx` file that assembles
the provided section component(s) into a complete route.

## Critical Rule

For **whole-page** builds, `app/layout.tsx` is a **minimal root** (fonts, globals, `{children}` only).
There are **no** `layout_NavigationSection` / `layout_FooterSection` imports in the root layout.

The **single** section component you are given already implements the **full application shell**
(in-page navigation, footer bar, sidebars, main work surface, etc. as designed). Import and render
**only** the listed section(s) — do not add separate Navigation/Footer imports for layout-level shells.

## Section Layout Contract (Critical)

Each section component already implements its own layout. **Do not** wrap section imports in extra
`<section>`, `container`, `mx-auto`, `px-`*, `py-`*, or `max-w-*` unless the page design plan
explicitly requires a wrapper for a named effect.

- Render section(s) **directly** inside `<main>` as siblings (often a single root section for whole-page).
- Page-level composition may add **only**: a minimal wrapper when an effect truly requires a positioned
  ancestor. **Do not** add scanlines, film grain, repeating gradients, dot grids, noise textures, vignettes,
  or other purely decorative full-viewport overlays unless the **page design plan text** explicitly asks
  for that effect.

## Design Responsibility

- Use the provided page design plan as the composition strategy for rhythm, hierarchy, and pacing.
- Treat the supplied section list as required building blocks.

## Output Rules

- Output only the raw TSX code.
- **CRITICAL: Copy the provided import statements VERBATIM.** The import paths are pre-computed and correct.
- Render all sections inside a single `<main>` element in the provided order.
- The page component is pure composition: no business logic, no state, no `"use client"` in `page.tsx`.
- Do not import sentinel packages like `client-only` or `server-only` in `page.tsx`.
- Export `metadata` and `export default function Page() {}`.
- Do not hardcode route assumptions beyond the supplied path and metadata.

## Example (single whole-page section)

```tsx
import type { Metadata } from "next";
import AnalyticsDashboardSection from "@/components/sections/home_AnalyticsDashboardSection";

export const metadata: Metadata = {
  title: "Page Title",
  description: "Page description",
};

export default function Page() {
  return (
    <main className="relative min-h-screen">
      <AnalyticsDashboardSection />
    </main>
  );
}
```
