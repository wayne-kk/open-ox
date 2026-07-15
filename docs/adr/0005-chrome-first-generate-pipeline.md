# ADR-0005: Default chrome-first generate pipeline

**Date**: 2026-07-15  
**Status**: Accepted  
**Context**: Duplicate navigation when Page Agents and Chrome Agent both own shell UI

## Decision

1. **Default generation order is chrome-first**: Plan selects `chromeForm` → `architect_scaffold_agent` writes a real shell (`app/layout.tsx` + `components/chrome/**`) → Page Agents implement content only (may run in parallel) → `chrome_optimize_agent` is **link polish only**.
2. **`chrome-deferred` (pass-through layout until after all pages) is no longer the default path.** It remains only as an implementation detail inside screenshot-replicate / `page-local` / `none` flows.
3. **Exceptions are plan results**, not post-hoc detectors:
   - Screenshot replicate → page owns chrome (existing).
   - `chromeForm ∈ {page-local, none}` → skip global chrome mount.
4. **Shared list/detail contracts** are planned and stubbed **before** parallel page agents.
5. **Effort tiers** (Fast / Balanced / Deep) map to step models / thinking; they do not replace chrome-first ownership.

## Consequences

- Page Agent prompts/bootstrap assume chrome is already mounted when a global form is selected.
- Studio narratives and `docs/architecture.md` describe scaffold as real shell, not “chrome deferred”.
- Checkpoint `skipScaffold` means a real shell (or intentional pass-through for exceptions) is already on disk.
- In-page chrome survey signals may still inform polish; they must not drive a deterministic “skip chrome agent” main path for global forms.

## References

- `docs/product/chrome-first-generate-pipeline-architecture.md`
- `docs/research/ai-builder-chrome-shell-pipelines-20260715.md`
- `ai/flows/generate_project/steps/architectScaffoldAgent.ts`
- `ai/flows/generate_project/runGenerateProject.ts`
