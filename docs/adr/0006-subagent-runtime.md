# ADR-0006: Pluggable Subagent Runtime (v1)

**Date**: 2026-07-15  
**Status**: Accepted  
**Context**: Agent sprawl risk and context pollution in Modify / repair; research in `docs/research/agent-subagent-architecture-patterns-20260715.md`

## Decision

1. **Shared runtime** lives at `ai/shared/subagent` (Spec registry + `runSubagent` + nesting guard). Hosts plug in; Generate chrome-first orchestration stays code-driven.
2. **Ownership model** is manager + agents-as-tools: the parent (Modify loop or repair/orchestrator) keeps the final user-facing answer. Subagents return summaries only.
3. **Nesting max depth is 1**. Subagents cannot spawn further subagents.
4. **v1 kinds**: `explore` (readonly reconnaissance) and `verifier` (readonly report-only checks).
5. **v1 hosts**:
   - Modify `loopEngine` injects `spawn_subagent` (explore only), toggle via `enableSubagents`.
   - `runModifyProject` runs verifier after deterministic final verification (report only; no auto re-edit).
   - `stepRepairBuild` appends a verifier report to its output (report only; does not flip repair success).
6. **`spawn_subagent` is not** registered in `systemToolCatalog`, so Generate role workers do not accidentally inherit it.

## Consequences

- Modify prompts may delegate noisy search to explore; parent context stays smaller.
- Verifier findings are observational — product UX may surface them as thinking/step events without blocking completion.
- Unifying Modify `loopEngine` with Generate `toolLoop` remains a separate follow-up; this ADR does not require it.
- Page / Scaffold workers stay orchestrator-scheduled Role Workers, not free-spawn subagents.

## References

- `ai/shared/subagent/`
- `docs/research/agent-subagent-architecture-patterns-20260715.md`
- `ai/flows/modify_project/engine/loopEngine.ts`
- `ai/flows/generate_project/steps/repairBuild.ts`
