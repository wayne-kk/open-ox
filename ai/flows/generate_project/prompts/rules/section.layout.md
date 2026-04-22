## Rule: Section Layout

### Two-Layer Structure

- **Outer**: `w-full` — only for background color/image/gradient. No rounded corners, border, shadow.
- **Inner**: `container mx-auto px-6 md:px-8` with section-level vertical rhythm. No nested `max-w-*`.

### Vertical Rhythm (strict)

- Hero section: `py-20 md:py-24`.
- Standard content section: `py-14 md:py-18` (default).
- Dense/supporting section (stats/faq/logo wall): `py-12 md:py-16`.
- Closing CTA section: `py-16 md:py-20`.
- Do not stack `pt-*` and `pb-*` that effectively exceed `py-24` unless explicitly required by the section brief.
- Avoid pervasive `py-32` / `py-40` style spacing in standard marketing pages.
- Explicitly forbidden class patterns in generated section wrappers: `py-32`, `py-40`, `md:py-32`, `md:py-40`, `lg:py-32`, `lg:py-40`.

### Section Separation

Prefer breaks from **surface contrast** (light ↔ secondary/muted tint ↔ dark `bg-foreground` band) over rules.

- Default: no `border-b`, `divide-y`, `<hr />`, or heavy shadow boundaries between every section.
- Allowed when two adjacent sections would otherwise read as the same block: a single subtle `border-t border-border/30` **or** an inner **band container** (`rounded-2xl border border-border/50 bg-secondary/20`) for logo/press rows — not full-width hairlines on every section.

### Structure Consistency

- Avoid repeating the exact same inner grid pattern in 3+ consecutive sections.
- If a section uses `grid` two-column split, the next section should default to centered stack or different grid ratio unless section brief requires continuity.
