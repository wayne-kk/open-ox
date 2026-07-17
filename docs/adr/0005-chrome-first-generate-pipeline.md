# ADR-0005: Default chrome-first generate pipeline

**Date**: 2026-07-15  
**Status**: Accepted  
**Context**: Duplicate navigation when Page Agents and Chrome Agent both own shell UI

## Decision

1. **Default generation order is chrome-first**: Plan agent selects `chromeForm` from the brief (no productType→form lookup tables in code or prompts) → `architect_scaffold_agent` **always** writes the shell (`app/layout.tsx` + `components/chrome/**`: Nav / Sidebar / Footer / tabs; `unspecified` → Scaffold decides; `none` → minimal shell still owned by Chrome) → Page Agents implement content only (may run in parallel) → `chrome_optimize_agent` is **link polish only**.
2. **`chrome-deferred` / `page-local` are removed** for normal generate. Pages never own global chrome.
3. **Exception**: screenshot replicate → pass-through layout; page reproduces reference chrome in sections (existing).
4. **Shared list/detail contracts** are planned and stubbed **before** parallel page agents.
5. **Effort tiers** (Fast / Balanced / Deep) map to step models / thinking; they do not replace chrome-first ownership.
6. **No scene hardcoding**: code must not map `productType` (dashboard/feed/…) onto chrome forms, and must not use in-page regex detectors to force skip/mount decisions.

## Consequences

- Page Agent prompts/bootstrap assume chrome is already mounted when a global form is selected.
- Studio narratives and `docs/architecture.md` describe scaffold as real shell, not “chrome deferred”.
- Checkpoint `skipScaffold` means a real shell (or intentional pass-through for exceptions) is already on disk.
- Disk survey for polish is routes / section ids / chrome files only — not in-page chrome detectors that steer form choice.

## References

- `docs/product/chrome-first-generate-pipeline-architecture.md`
- `docs/research/ai-builder-chrome-shell-pipelines-20260715.md`
- `ai/flows/generate_project/steps/architectScaffoldAgent.ts`
- `ai/flows/generate_project/runGenerateProject.ts`
