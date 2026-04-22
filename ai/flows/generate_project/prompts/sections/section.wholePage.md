## Section Generation — Whole-Page (Single-Surface Product)

This file **replaces** the generic `section.default` guidance for `layoutMode: whole-page`: one section file implements the **entire interactive product** for the route — **whatever domain** the brief describes (tools, games, feeds, admin, creative surfaces, etc.). It is **not** a block inside a long **Line A** marketing page.

### What this means

- **Not** a Hero / feature / testimonial / CTA stack. The component is the product; treat the **Section Design Brief** and `intent` / `contentHints` as the product spec.
- The outer root should use `**min-h-screen`** and fill the viewport shell; **inner** areas may scroll (feeds, tables, settings) — same patterns as a real app.
- **Client vs server**: add `**"use client"`** at the top when the surface needs browser APIs, `useState` / `useRef` / `useEffect` / `useCallback`, event handlers, Web Audio, Canvas, `requestAnimationFrame`, game loops, or non-trivial interaction. A static shell with no real interaction is a failure for most whole-page products.
- **Copy density rules from `section.default` that cap headlines/body for “marketing sections” do not apply** to primary tool/game/instrument UI — use the amount of legible, realistic text the product needs (labels, table headers, help lines, in-game copy). Still avoid bloated lorem; prefer concrete, product-plausible strings.

### Layout vocabulary (use what fits; do not force app chrome)

- **App-shell products**: top bar, side nav, main column, right panel, bottom bar — as in a normal product.
- **Full-stage / full-canvas** products: a **main stage** (e.g. `canvas` or full-bleed interactive area) plus **controls / HUD / tool strip** as the brief requires — *not* “three equal columns of marketing cards” unless the brief asks for that.

### Data and affordances

- Mock data should feel **filling and plausible** (lists, rows, entities, tiles, table records, etc.) as described in the brief — **not** one empty card and a headline.
- If the product implies audio, physics, or timing, you may use **simplified, browser-appropriate** implementations (e.g. `AudioContext`, simple step timers); do not claim external services or real multiplayer unless the brief does.

### Still follow (from shared guardrails + design system)

- **Language** rules from the project: all user-facing strings in the project language.
- **TypeScript / SSR safety** for DOM, `window`/`document`, canvas `getContext`, refs — as in `section.default`.
- **Do not** add page-level fixed grain/noise/vignette overlays; **do not** use `<style jsx>`. Respect **outputTsx** and accessibility guardrails in the system prompt.
- For images: use `generate_image` when the brief calls for photographic/illustrative assets; many **Line B** surfaces are **UI-only** (no image required).

### Internal composition

- A single file may contain **small presentational subcomponents** in the same file if it keeps the main export clear; avoid deep extraction unless the brief implies multiple major regions.
- **Surface and rhythm**: even inside one file, use distinct **background/surface** tokens for major zones (main vs chrome vs panel) so the result reads as a product, not one flat `bg-background` sheet — unless the brief demands minimal chrome.

### Anti-patterns for this mode

- Do **not** reduce the whole file to a generic marketing hero + three icon rows unless the user product is literally that.
- Do **not** default to all-center, max-w-prose copy blocks for tool/game/shell UIs.
- Do **not** omit interactivity that the brief clearly requires because of an over-eager "server component first" habit — use `use client` when required.

