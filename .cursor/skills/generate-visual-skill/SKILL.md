---
name: generate-visual-skill
description: Convert provided WebGL/animation/source snippets into generate_project section skills — for hero, append metadata to `section/hero/skills.yaml` and add `<skill-id>.md`; other sections may still use per-skill `.yaml`+`.md` until bundled. Production-safe constraints; colors follow the brief/design tokens, not a copy of the reference palette. Use when user shares effect source and asks to "转成 skill", "生成 skill yaml", "沉淀为可复用特效模板", or similar.
---

# Generate Visual Skill

## Purpose

Turn a user-provided visual effect implementation (WebGL, canvas, shader, GSAP, CSS, DOM-driven motion, etc.) into a reusable skill for the `generate_project` flow.

### Hero section (`section/hero/`) — **single registry file**

- **Metadata:** append one new item to the `skills:` array in  
  `ai/flows/generate_project/prompts/skills/section/hero/skills.yaml`
- **Prompt body:** add or update  
  `ai/flows/generate_project/prompts/skills/section/hero/<skill-id>.md`  
  where `<skill-id>` equals the `name` field in the registry (same as today’s kebab-case ids).

**Do not** add separate `hero/<skill-id>.yaml` files — discovery loads all hero metadata from `skills.yaml` only (`skillDiscovery` bundle parser).

### Other section folders

If the user targets a section that **does not** yet use a bundled `skills.yaml`, you may still emit the legacy pair:

- `ai/flows/generate_project/prompts/skills/section/<section>/<skill-id>.md`
- `ai/flows/generate_project/prompts/skills/section/<section>/<skill-id>.yaml`

Default `<section>` is `hero` unless the user names another.

### Cross-cutting technical guidance

When the source is clearly architecture/patterns (e.g. Three.js lifecycle) rather than a concrete section UI:

- `ai/flows/generate_project/prompts/skills/technical-spec/<skill-id>.md`
- `ai/flows/generate_project/prompts/skills/technical-spec/<skill-id>.yaml`

---

## Output Contract

### Hero: bundled entry in `skills.yaml`

Append **one** list item under `skills:` (match existing indentation and key order style in that file). Loader maps fields as follows:

| Field | Rules |
|--------|--------|
| `name` | **Skill id** — lowercase `kebab-case`; must match `<skill-id>.md` basename. **This is the registry id** (not a separate top-level `id` key). |
| `kind` | `component-skill` for section implementations. |
| `sectionTypes` | e.g. `[hero]`. |
| `priority` | Integer; set **relative to siblings** in the same `skills:` list (compare neighboring entries). |
| `notes` | Short block (`>` folded style allowed); loader truncates for discovery UI — put the hook first. |
| `keywords` | Routed to `when.designKeywords.any`. **At most 10** strings — same rule as legacy per-skill YAML. |
| `exclude_keywords` | Routed to `when.designKeywords.none` (disambiguation; can be longer than `keywords` when useful). |
| `disabled` | Optional; omit unless the skill should be skipped. |

Do **not** add a duplicate `id` key — **`name` is the id** for bundled hero skills.

**Keyword style** (unchanged intent): scene + product/page type + vibe first; avoid stuffing `keywords` with pipeline jargon. See existing entries in `hero/skills.yaml` (e.g. `adaptive-vbars-webgl` block) for tone — **do not** paste its list verbatim into new skills.

**Merge ritual for new hero skills:**

1. Open `skills.yaml`, find the `skills:` array, append the new `- name: ...` block in a sensible place (often by priority or alphabetically within tier — follow surrounding file convention).
2. Ensure no duplicate `name`.
3. Write or update the matching `.md` blueprint.

### Hero: `.md` (spec)

Same structure requirements as before (sections, blueprint MUSTs, no demo hex lock-in, no app chrome in hero skills, a11y/perf, etc.) — see **Skill Markdown (spec)** below.

### Legacy per-skill YAML (non-bundled sections only)

If you emit `<skill-id>.yaml` elsewhere, it must remain valid for `parseSkillMetadata`: use top-level `id` (not `name`), `when.designKeywords.any` / `none`, etc., per the old schema.

---

## Color and palette (critical)

**Do not freeze** literal colors from the source snippet. Colors **follow the product brief and design system** when `generateSection` runs. In the `.md`, describe **roles and relationships** and token-level language — not a swatch copy.

---

## Skill Markdown (spec)

Structure the `.md` from the **actual stack** in the source — omit sections that do not apply.

**Recommended sections (pick and rename as needed):**

1. **Title + opening “Use this skill when…”** — One paragraph tying effect to `generateSection` / layout intent.
2. **Core Effect** — Bullet list of what the viewer sees and what must exist in the section.
3. **Visual Language** — Atmosphere, frame language, typography tone; **palette as roles and contrast**, tied to brief/tokens.
4. **Structure Requirements** — Layering, DOM/canvas placement. **Hero component-skills:** no site `<nav>` / app chrome in the section.
5. **Motion Direction** — Timelines, RAF, scroll triggers; `prefers-reduced-motion`.
6. **Rendering / implementation deep-dive (conditional)** — WebGL, particles, CSS-only, etc., only if relevant.
7. **Required Implementation Blueprint (Do Not Skip)** — Numbered MUSTs; end with validity sentence for this `id`.
8. **Reference TSX Skeleton** — Strict TS, cleanup, tokens/placeholders — not demo colors as requirements.
9. **Layout Details** — Viewport, stacking, readability.
10. **Content Rules** — Copy/CTA tone.
11. **Implementation Constraints** — `use client` when needed, no CDN scripts, project icon rules, etc.
12. **Accessibility + Performance** — Reduced motion, decorative `pointer-events-none`, DPR cap, disposal.

---

## Conversion Workflow

1. **Classify** — Section `component-skill` vs `technical-spec-skill`; default section `hero`.
2. **Extract primitives** from source (layout, motion, interaction) — **excluding** locking demo colors.
3. **Choose `name` / `<skill-id>`** — unique among `skills:` in `hero/skills.yaml`.
4. **Hero:** append the bundled YAML block + author/update `hero/<skill-id>.md`.
5. **Safety pass** — Type-safe skeleton, cleanup, no forbidden patterns.

---

## TSX skeleton rules (when applicable)

Same as before: hero skills contain **visual + hero copy only** (no global nav); typed refs; dispose listeners/RAF/WebGL you create; guard resize.

---

## Quality bar

Spot-check **one neighboring entry** in `hero/skills.yaml` + one peer `.md` for structural parity (notes density, keyword discipline, blueprint strictness).

---

## Final handoff message

Report:

- Paths touched: `hero/skills.yaml` (+ line or skill `name`) and `hero/<skill-id>.md`.
- `keywords` (≤ 10) and `exclude_keywords` added.
- Numbered blueprint MUSTs from `.md`.

---

## User invocation

- Infer `section` and `kind`; default `hero` + `component-skill`.
- **Hero:** registry row in `skills.yaml` + one `.md` per skill.
- **Multiple snippets:** distinct `name` values and distinct `.md` files; append multiple blocks to `skills.yaml` (or one block per skill in one edit).
