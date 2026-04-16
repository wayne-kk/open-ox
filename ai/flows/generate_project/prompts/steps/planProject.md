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

You are not building a "website with sections." You are directing a **visual film** that the visitor scrolls through.

Each unit on the page is a **Scene** — a high-impact visual moment. Think of it like a movie: opening shot, rising tension, emotional peak, resolution. Every scene must earn its place on the page.

Rules:
- **Maximum 6 scenes** (including the opening). Fewer is better if each one hits harder.
- `type` should use familiar section archetypes (e.g. `Hero`, `Feature`, `StoryBlock`, `Showcase`, `Testimonial`, `FAQ`, `CTA`, `Footer`) so downstream generation can align faster.
- `intent` should describe the **visual and emotional impact** — what the visitor feels when they reach this scene.
- `contentHints` should describe what the visitor **sees and experiences** — the visual composition, not a list of data fields.
- Alternate between high-density scenes and breathing-room scenes. The page needs rhythm.
- At least one scene should be a pure visual moment — a full-bleed image, a bold typographic statement, a brand atmosphere shot with minimal text.
- The final scene should create closure and a sense of invitation, not a generic "sign up now" block.

### Planning style

- Implementation-oriented, not verbose strategy language.
- Do NOT include `designPlan` on sections — guardrails and skills are resolved automatically at generation time.

### Output constraints

- Return JSON only (no markdown).
- Preserve existing ids/names unless required for validity.
