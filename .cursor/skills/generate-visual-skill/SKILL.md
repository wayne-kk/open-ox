---
name: generate-visual-skill
description: Convert provided WebGL/animation/source snippets into generate_project section skills (`.md` + `.yaml`) with production-safe constraints; colors follow the brief/design tokens, not a copy of the reference palette. Use when user shares effect source code and asks to "转成 skill", "生成 skill yaml", "沉淀为可复用特效模板", or similar.
---

# Generate Visual Skill

## Purpose

Turn a user-provided visual effect implementation (WebGL, canvas, shader, GSAP, CSS, DOM-driven motion, etc.) into a reusable **skill pair** for the `generate_project` flow:

- `ai/flows/generate_project/prompts/skills/section/<section>/<skill-id>.md`
- `ai/flows/generate_project/prompts/skills/section/<section>/<skill-id>.yaml`

Default `<section>` is `hero` unless the user names another section type (e.g. future `features` under the same tree).

For **cross-cutting technical guidance** (not tied to one section layout), use:

- `ai/flows/generate_project/prompts/skills/technical-spec/<skill-id>.md`
- `ai/flows/generate_project/prompts/skills/technical-spec/<skill-id>.yaml`

Choose `technical-spec` only when the source is clearly architecture/patterns (e.g. Three.js lifecycle, animation mixers) rather than a concrete section UI.

## Output Contract

Always produce **both** files with the **same basename** (`<skill-id>`). Metadata lives in `.yaml`; the runnable spec and narrative live in `.md`.

### Skill YAML (metadata)

Must be valid for the project loader (`discoverSkills` / `parseSkillMetadata`). Include:

| Field | Rules |
|--------|--------|
| `id` | Lowercase `kebab-case`; stable, specific; must match filenames without extension. |
| `kind` | `component-skill` for section implementations; `technical-spec-skill` for shared technical guidance. |
| `sectionTypes` | Section skills: array of section names, e.g. `["hero"]`. Technical specs: `["*"]`. |
| `priority` | Integer. **Set relative to sibling skills** in the same folder: stronger, more distinctive effects slightly higher; generic or heavy effects lower. There is no single magic number—compare existing YAMLs in that directory. |
| `fallback` | Usually `false` unless the team explicitly marks a catch-all skill. |
| `when.designKeywords` | `any`: phrases users or briefs might say; `none`: disambiguation to avoid wrong matches. Use lowercase tokens where possible; add non-English terms only when they reflect real product language. |
| `notes` | **One tight sentence** (roughly **≤ 80 characters** after collapsing whitespace). The project truncates notes in discovery UIs—put the distinguishing hook first. |
| `disabled` | Omit unless the skill should be skipped by discovery (`true`). |

Use a **multi-line array** for `any` / `none` when there are more than a few keywords (matches current repo style).

Do **not** encode one-off hacks in YAML (e.g. duplicate synonyms solely to game ranking). Prefer clear `none` lists when two skills would otherwise collide.

### Color and palette (critical)

**Do not freeze or “复刻” literal colors from the source snippet** (hex, RGB, gradient stops copied from demo code). Colors **follow the product brief and design system** (tokens, theme, brand palette) when `generateSection` runs.

In the skill `.md`:

- Describe **roles and relationships**: background vs accent, figure vs ground, contrast level, warm/cool bias—**not** a fixed swatch lifted from the reference implementation.
- Prefer **token-level language** where the project uses one (e.g. `primary`, `muted`, `background`); otherwise say “map accents to brief” or “derive from design system.”
- In the **Reference TSX skeleton**, avoid hardcoded demo colors as requirements; use tokens, CSS variables, or clearly labeled placeholders so implementers substitute from the active brief.

YAML `designKeywords` may still use **mood words** (“emerald accent”, “neon”) to route matching—they describe intent for discovery, not mandatory literal values in generated code.

### Skill Markdown (spec)

Structure the `.md` from the **actual stack** in the source—omit sections that do not apply.

**Recommended sections (pick and rename as needed):**

1. **Title + opening “Use this skill when…”** — One paragraph tying effect to `generateSection` / layout intent.
2. **Core Effect** — Bullet list of what the viewer sees and what must exist in the section.
3. **Visual Language** — Atmosphere, frame language, typography tone; **palette as roles and contrast**, tied to brief/tokens—not a copy of the snippet’s hex values (see **Color and palette** above).
4. **Structure Requirements** — Layering (frame / nav / background / content), DOM or canvas placement.
5. **Motion Direction** — Timelines, RAF, scroll triggers, interaction; call out `prefers-reduced-motion` expectations.
6. **Rendering / implementation deep-dive (conditional)**  
   - Examples: `WebGL Requirements (Three.js)`, `Particle System`, `CSS / DOM Background`, `Shader passes`—**only if** the source uses them.
7. **Required Implementation Blueprint (Do Not Skip)** — Numbered, testable MUST items **derived from the source** (and from distinctive constraints you add for production safety). End with: if any item is missing, output is NOT valid for this `id`.
8. **Reference TSX Skeleton (Adapt, Do Not Copy Blindly)** — When the deliverable is a React section: strict TypeScript, null-safe refs, cleanup. Strip product-specific copy; keep structure. **Do not treat source demo colors as the spec**—use tokens/variables or neutral placeholders.
9. **Layout Details** — Viewport, stacking, readability over motion.
10. **Content Rules** — What copy/CTA tone fits this visual.
11. **Implementation Constraints** — Project-wide: e.g. `use client` when needed, no CDN script tags, no `iconify-icon`, no `<style jsx>`, icons via project system (e.g. `lucide-react`) or inline SVG.
12. **Accessibility + Performance** — Reduced motion, `pointer-events-none` on decorative layers, reasonable DPR cap for WebGL, listener/RAF disposal.

**Do not** require a fixed global outline (e.g. forcing `Rendering Requirements` for a CSS-only hero). **Do** require that every generated skill remains internally consistent: if the blueprint says “no WebGL,” the skeleton must not import Three.js.

## Conversion Workflow

1. **Classify** — Section `component-skill` vs `technical-spec-skill`; default section `hero` if unspecified.
2. **Extract primitives** from source: layout, render path, motion, interaction, assets, distinctive constraints—**excluding** locking in specific colors; map color to brief/tokens instead.
3. **Choose `id`** — Short, descriptive, unique among siblings; avoid overlapping names with existing files in the target folder.
4. **Author `.yaml`** — Keywords that reflect the effect; `none` that separate it from neighboring skills (same as in repo: e.g. canvas particle text vs WebGL hero).
5. **Author `.md`** — Blueprint items must be **checkable** and **sourced**: each MUST should trace to the snippet or to an explicit production constraint you document.
6. **Safety pass** — Type-safe skeleton, cleanup paths for every allocated resource (DOM nodes, RAF, listeners, WebGL dispose where applicable), no forbidden patterns from **Implementation Constraints**.

## TSX skeleton rules (when applicable)

The embedded skeleton should illustrate:

- Typed refs and early return if mount targets are missing.
- Typed animation frame / event handler variables where used.
- **Dispose only what you create** (e.g. `cancelAnimationFrame`, remove listeners, `dispose()` on Three.js geometry/material/renderer when the skeleton constructs them).
- Resize handling that guards zero-sized targets before updating camera/renderer.

Avoid cargo-cult checks: if there is no mesh, do not mandate `mesh.material` disposal patterns.

## Quality bar (non-prescriptive)

Before finishing, **spot-check against 1–2 existing skills in the same target directory** (read filenames and open one peer `.md` + `.yaml`). Match:

- tone density (how strict the blueprint is),
- YAML keyword style,
- notes length,
- how strictly project constraints are stated.

Do **not** copy a peer’s effect requirements (e.g. a specific geometry or library) unless the user’s source actually uses them. The bar is **structural parity**, not **effect parity**.

## Final handoff message

After writing files, report:

- Absolute or repo-relative paths to both outputs.
- `designKeywords.any` and `designKeywords.none`.
- The numbered blueprint items (same as in `.md`) as the checklist—pass/fail is whether the generated pair satisfies those items, not a fixed external rubric.

## User invocation

When the user supplies source and asks for conversion:

- Infer `section` and `kind`; default `hero` + `component-skill`.
- Emit `<skill-id>.md` + `<skill-id>.yaml` in the correct tree.
- If multiple unrelated snippets are provided, emit **one skill pair per snippet** with distinct `id`s.
