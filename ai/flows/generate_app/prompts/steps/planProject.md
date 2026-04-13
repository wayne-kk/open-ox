## Step Prompt: Plan Project (App Screen-First)

You convert a `ProjectBlueprint` into a `PlannedProjectBlueprint`.
This app line uses **screen-first planning**. Do not plan with section-stacking mindset.

### What to produce

1. Keep structure valid JSON.
2. Attach `pageDesignPlan` to each page.
3. Keep `projectGuardrailIds` short and global.
4. Include `appScreenPlan` on each page as the primary planning output.
5. `sections` can be empty compatibility data and must not drive planning decisions.

### Single-page rule (critical)

- This pipeline builds one app-like long-scrolling home page (`slug: "home"`).
- Do not invent extra pages/routes.
- Use in-page anchors for navigation.
- Prefer app-native navigation semantics (top app bar, segmented entry, bottom-tab style hints) within the single-page model.
- For app line, navigation should be implemented as a **bottom tab/dock style shell**, not top website nav.

### layout & screen model (critical)

- `layoutSections` = only shared shells.
- In app line, keep `layoutSections` minimal: include `navigation` only.
- Do **not** include `footer` in `layoutSections` for app mode.
- Do not plan hero/features/pricing/testimonials/faq/cta style blocks as primary structure.

### Planning style

- Keep it simple and implementation-oriented.
- Avoid over-planning and verbose strategy language.
- Prefer one coherent screen plan over fragmented modules.
- Favor mobile-first scanning rhythm: quick value framing, compact cards, clear touch actions.
- Function-first screen planning:
  - Prioritize workflows users complete on this screen: entry, action, feedback, status.
  - Prefer practical regions (stream/workspace, action dock, status strip, quick filters) over marketing narrative blocks.
  - Do not default to web-homepage stacks like broad brand intro / testimonial wall / pricing pitch.
- Feed-first planning rule (critical):
  - If user intent implies social/discovery/feed product (e.g. 小红书, 瀑布流, card feed, discovery), plan one dominant stream region.
  - Keep supporting regions lightweight so stream continuity remains primary.
- `appScreenPlan` rule (critical):
  - Provide `screenType`, `shellStyle`, `narrative`, `regions`, and `interactionModel`.
  - `regions` should represent coherent screen zones (e.g. contextHeader, primaryFeed, quickActions, feedbackStrip), not website sections.
  - `sections` must be treated as non-primary compatibility data.
- First-screen rule:
  - The first viewport should contain at least one concrete actionable area (button/input/task trigger) and one status/feedback area.
  - Avoid large decorative hero copy blocks that delay task entry.
- Do NOT include section-level design plans.

### Output constraints

- Return JSON only (no markdown).
- Preserve existing ids/names unless required for validity.
