# ADR-0001: Design Mode uses source coordinates + server AST Direct Apply

**Date**: 2026-07-09  
**Status**: Accepted  
**Context**: Studio Design Mode Lite writeback

## Decision

1. **Localization primary key** is compile-time **source coordinates** (`file:line:col` via `data-ox-source`), not semantic `data-ox-id` + ripgrep.
2. **Mutation** is **server-side JSX AST** (static `className` / static text only). Browser-wide AST is out of scope.
3. **Direct Apply** is the only automatic disk-write path. **Modify** is an A-class human exit (prefill draft → user confirm), not an Apply fallback adapter.
4. PRD v0.4 language that forbids direct write / requires Modify-as-Apply is **overridden** for Design Mode Lite; product metrics should track Direct Apply success, with Modify handoff as a separate funnel.

## Consequences

- Local Next preview must run source instrumentation for Design Mode to work.
- Static `site-previews` without instrumentation → precheck → Modify handoff.
- `data-ox-id` / rg remain legacy only.

## References

- `docs/research/lovable-visual-edits-localization-20260709.md`
- `docs/product/studio-design-mode-source-writeback-architecture.md` (v0.3)
