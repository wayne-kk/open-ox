## Step Prompt: Plan Project

You convert a `ProjectBlueprint` into a `PlannedProjectBlueprint` for downstream section generation.

### What to produce

1. Keep structure valid JSON.
2. Attach `pageDesignPlan` to each page.
3. Sections only need: type, intent, contentHints, fileName.

### Single-page rule (critical)

- This pipeline builds one long-scrolling home page (`slug: "home"`).
- Do not invent extra pages/routes.
- Use in-page anchors for navigation.

### layoutSections vs page sections (critical)

- `layoutSections` = only shared shells (navigation/footer/global bars).
- All content sections must stay in `pages[].sections`.

### Scene planning (critical)

Treat each section as a purposeful content block with clear hierarchy and scannable structure.
Visual pacing matters, but readability and implementation stability come first.
Use these defaults unless user request overrides them:
- `DESIGN_VARIANCE = 8`
- `MOTION_INTENSITY = 6`
- `VISUAL_DENSITY = 6`

Rules:
- **Maximum 4 sections total** in `pages[0].sections` (including opening and closing). Never output 5+ sections.
- **Maximum 4 scenes** (including the opening). Fewer is better if each one hits harder.
- Coverage balance (critical): when there are 4 sections, at least 3 sections must include non-pure-text evidence units in `contentHints` (e.g. media block, card cluster, stats row, quote+attribution, logo/proof band).
- Tail anti-degradation (critical): section #3 and #4 must not collapse to "headline + paragraph + single CTA" only; they must each include at least one scannable structure block.
- `type` should use familiar section archetypes (e.g. `Hero`, `Feature`, `StoryBlock`, `Showcase`, `Testimonial`, `FAQ`, `CTA`, `Footer`) so downstream generation can align faster.
- `intent` should describe the **visual and emotional impact** — what the visitor feels when they reach this scene.
- `contentHints` should describe what the visitor **sees and experiences** — the visual composition, not a list of data fields.
- Alternate between high-density scenes and breathing-room scenes. The page needs rhythm.
- **Surface contrast**: plan at least one scene that is visually unmistakable vs pale sections — e.g. full-bleed **dark** testimonial/quote band (`bg-foreground`), **primary-tint** feature runway, or **secondary** editorial strip — not only “slightly different off-white”.
- At least one scene should be a pure visual moment — a full-bleed image, a bold typographic statement, a brand atmosphere shot with minimal text.
- The final scene should create closure and a sense of invitation, not a generic "sign up now" block.
- Avoid planning consecutive sections with near-identical structure (e.g., 3 repeated card grids).
- Keep copy expectations concise in `contentHints`: short headline + short support copy + one primary action.
- Prefer asymmetric/split compositions when appropriate; avoid making every key section centered.
- Avoid planning multiple sections with the exact same "3 equal cards" layout.
- In `contentHints`, include motion guidance level (`none` / `subtle` / `emphasis`) and keep default at `subtle`.
- In `contentHints`, include spacing density (`compact` / `standard` / `spacious`) and avoid excessive spacing plans that imply `py-32` or above.
- Prohibit implementation cues that conflict with downstream guardrails (e.g., `style jsx`, `clip-path`, repeated global grain overlays).
- Enforce minimum section payload: each non-hero section should carry at least 2 meaningful content units (e.g., title+description, metric+label, quote+attribution, feature+benefit).
- In `contentHints`, explicitly name the planned evidence/scannable units (not generic prose), e.g. "3 stats chips", "2-column feature cards", "quote + attribution + source band".
- If a candidate section has too little unique content, merge it into an adjacent section instead of keeping a weak standalone block.
- Avoid "thin sections" that only contain one short sentence + one button unless it is the final closing CTA.
- Prioritize fewer, stronger sections over many sparse sections.

### Planning style

- Implementation-oriented, not verbose strategy language.
- Do NOT include `designPlan` on sections — guardrails and skills are resolved automatically at generation time.

### Output constraints

- Return JSON only (no markdown).
- Preserve existing ids/names unless required for validity.
- Hard check before output: each page's `sections.length` must be `<= 4`.
