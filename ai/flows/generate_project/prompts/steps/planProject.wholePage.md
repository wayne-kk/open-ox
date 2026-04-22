## Step Prompt: Plan Project — Whole Page (Line B — single-surface product)

You convert a `ProjectBlueprint` into a `PlannedProjectBlueprint` for **Line B** (`layoutMode: whole-page`): **one** section on `/` is the **entire** user-facing product for this pipeline — *whatever domain* the user described (feed, back office, game, instrument, etc.). It is **not** Line A (a stacked marketing/landing page).

**Do not** pick the product from a small internal list of “allowed apps.” Derive `type` and `fileName` from **domain vocabulary in** `projectTitle`, `projectDescription`, `mvpDefinition`, and the page copy.

### What to produce

1. Keep structure valid JSON.
2. Attach `pageDesignPlan` to each page.
3. Output **exactly 1 section** — it carries the full application UI.

### Single-page rule (critical)

- This pipeline builds one page (`slug: "home"`).
- Do not invent extra pages/routes.

### layoutSections vs page sections (critical)

- Set `site.layoutSections` to **`[]`**. Do **not** output separate global `NavigationSection` / `FooterSection` for the root layout — the **one** page section may implement *whatever* chrome the product needs (full-screen stage only, or shell + main area, or multi-pane) **inside** that component.
- The only content section lives in `pages[0].sections` (exactly one entry).

---

### The single section

Output exactly **1 section** in `pages[0].sections`. This section is the entire application interface.

**Naming `type` and `fileName` (no fixed catalog)**
- **`type`**: `PascalCase` identifier from the **user’s product** (e.g. words from the brief), describing what the thing *is* — not a generic label like `MainContent` or `App` unless the user truly gave no domain words.
- **`fileName`**: `"{SameStem}Section"` and must match the exported component stem (e.g. `RacingGridSection` → component `RacingGridSection`).

**`intent`**: In 1–2 sentences, the **primary loop or task** on this surface: what the user *does* repeatedly or first, and what “done” looks like. No marketing positioning language.

**`contentHints`**: Be specific and **morphology-agnostic** — describe the real UI, not a template:
- **Layout morphology**: e.g. multi-pane app shell, **or** full-bleed **stage** (game/canvas/instrument) with controls/HUD, **or** table-first, **or** single scrolling feed — *whatever matches* the product.
- **Major regions and what they hold** (only those that apply): chrome (nav/bars), **primary interactive surface**, side panels, drawers, footers, tool rails, etc.
- **Interactions & density**: key affordances, realistic mock **counts** (rows, list items, entities) so downstream generation is not sparse; name input modalities if relevant (keyboard, drag, etc.).

---

### Planning style

- Product / tool / play designer — not a **landing-page** copywriter. No default Hero → feature → testimonial **unless** the user is literally asking for a promo surface (they usually are not in `whole-page`).
- The goal is a **credible, interactive** interface for the described domain, not a best-of Behance marketing mock.

### Output constraints

- Return JSON only (no markdown).
- `pages[0].sections.length` must be exactly `1`.
- `site.layoutSections` must be `[]` (empty array).
