---
name: generate-visual-skill
description: Convert provided WebGL/animation/source snippets into generate_project section skills (`.md` + `.yaml`) with production-safe constraints. Use when user shares effect source code and asks to "转成 skill", "生成 skill yaml", "沉淀为可复用特效模板", or similar.
---

# Generate Visual Skill

## Purpose

Turn a user-provided visual effect implementation (WebGL, canvas, shader, GSAP, CSS effect, etc.) into a reusable `generate_project` skill pair:

- `ai/flows/generate_project/prompts/skills/section/<section>/<skill-id>.md`
- `ai/flows/generate_project/prompts/skills/section/<section>/<skill-id>.yaml`

Default section is `hero` unless user specifies another section type.

## Output Contract

For each conversion, always produce:

1. A **skill markdown** file with:
   - effect intent and visual language,
   - required implementation blueprint,
   - TSX reference skeleton (strict-TypeScript-safe),
   - cleanup/perf/accessibility notes,
   - project constraints (no CDN, no style jsx, use project icon system).
2. A **skill yaml** file with:
   - `id`, `kind: component-skill`, `sectionTypes`,
   - `priority`, `fallback`,
   - `when.designKeywords.any/none`,
   - concise `notes`.

## Conversion Workflow

Use this workflow every time:

1. **Extract effect primitives** from source:
   - layout/frame language,
   - rendering stack (Three.js/WebGL/canvas/CSS),
   - motion model (GSAP timeline, RAF loop, pointer interaction),
   - materials/lights/post-processing,
   - constraints that make the effect distinctive.
2. **Name the skill id**:
   - lowercase kebab-case, concise and specific (e.g. `geometric-webgl`, `orbital-particles`, `noise-shader-grid`).
3. **Write `.yaml` first**:
   - include strong positive keywords from source,
   - include negative keywords that should suppress mismatches,
   - set practical `priority` (70-85 for strong hero effects).
4. **Write `.md` second**:
   - distill the source into implementation requirements,
   - include a minimal TSX blueprint that compiles under strict TS,
   - keep examples adaptable (not hardcoded to one product copy).
5. **Safety pass**:
   - template avoids common TS errors (`ref` null guards, RAF cleanup, material dispose safety),
   - no CDN script tags,
   - no `iconify-icon`,
   - no `<style jsx>`.

## YAML Template

Use this structure and adapt fields:

```yaml
id: your-skill-id
kind: component-skill
sectionTypes: ["hero"]
priority: 80
fallback: false
when:
  designKeywords:
    any: ["webgl", "three", "shader", "3d"]
    none: ["editorial", "minimal", "warm", "organic"]
notes: >
  One-sentence summary of where this skill should be used.
```

## MD Blueprint Requirements

Every generated skill markdown should contain these sections:

- `Core Effect`
- `Visual Language`
- `Structure Requirements`
- `Motion Direction`
- `Rendering Requirements`
- `Required Implementation Blueprint (Do Not Skip)`
- `Reference TSX Skeleton (Adapt, Do Not Copy Blindly)`
- `Layout Details`
- `Content Rules`
- `Implementation Constraints`
- `Accessibility + Performance`

For `hero` WebGL skills, the markdown must additionally include a concrete "valid/invalid" statement for the core effect (same strictness as current `geometric-webgl`).

## TS-Safe Skeleton Rules

The embedded TSX skeleton must demonstrate:

- typed refs (`HTMLDivElement | null`, `HTMLCanvasElement | null`),
- explicit null guards,
- typed event handlers,
- `rafId` cancel flow,
- resize guard for zero dimensions,
- safe material disposal (`Array.isArray(mesh.material)`),
- renderer/geometry/material cleanup.

## Geometric-WebGL Parity Gate (Critical)

When converting source effects that are geometric/WebGL hero style, output quality MUST be at least on par with `geometric-webgl`.

Before finalizing files, verify all checks pass:

1. **Scene Core**
   - contains `IcosahedronGeometry(..., 0)` (or clearly equivalent faceted geometry),
   - contains `MeshStandardMaterial` with `flatShading: true`.
2. **Lighting**
   - includes ambient + key directional + colored rim/back light (3+ lights).
3. **Motion**
   - includes GSAP staged reveal for badge, heading text lines, and CTA,
   - includes RAF loop with autonomous rotation + floating + mouse lerp influence.
4. **Frame Language**
   - includes blueprint-like frame guidance (rails/brackets/measurement accents), not only a plain dark hero.
5. **Type Safety**
   - references are typed and guarded; cleanup includes RAF cancel + renderer/geometry/material disposal.
6. **Project Constraints**
   - no CDN scripts, no `iconify-icon`, no `<style jsx>`.

If any check fails, revise `.md`/`.yaml` before returning.

## Final Verification Output

After generating each skill pair, always report:

- output file paths,
- extracted `designKeywords.any` and `designKeywords.none`,
- a short parity checklist result (pass/fail per item above).

## Expected User Invocation

When user provides source and asks conversion, execute directly:

- infer section type (default `hero`),
- produce `<skill-id>.md` + `<skill-id>.yaml`,
- explain where files were written and what keywords were mapped.

If user provides multiple source snippets, convert each into an independent skill pair using the same workflow.
