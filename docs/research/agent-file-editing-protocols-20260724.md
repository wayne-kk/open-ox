# Coding agent file-editing protocols: primary-source research

Date: 2026-07-24

## Scope and evidence standard

This note compares Cursor, Claude Code, Aider, and OpenAI Codex using only first-party documentation and official repositories. Statements under **Documented fact** are directly supported by the cited source. Statements under **Inference** are design interpretations, not claims about unpublished internals.

## Executive findings

1. Mature agents treat editing as a feedback loop, not a stream of independent writes. Tool results, current file content, diagnostics, and verification feed the next model step.
2. They distinguish full-file creation/overwrite from partial modification. Claude Code documents `Write` for create/overwrite and `Edit` for partial changes; Aider defaults to contextual SEARCH/REPLACE blocks; Codex exposes structured add/update/delete patch hunks.
3. Existing-file edits are grounded in current content. Claude Code checks read-before-edit, exact match, and uniqueness against current disk content. Aider applies contextual matches to freshly read file contents and returns the failed block plus nearby real lines. Codex computes update hunks against the file content and returns parse/application errors.
4. Recovery is bounded and informative. Aider reflects edit/lint/test failures back to the model but caps reflections at three. Claude Code stops auto-compaction after repeated thrashing instead of looping forever. Cursor itself warns that agents can repeat a failing approach.
5. Checkpoints are rollback, not edit concurrency control. Cursor and Claude Code both snapshot files before changes, separately from Git. No examined primary source documents a Cursor content-hash/revision precondition for edits.

## Cursor

### Documented facts

- Cursor defines an agent as “tools in a loop”: each tool result is returned to the model, which decides the next action. Its own learning material says agents can get stuck repeating a failing approach. [Agents](https://cursor.com/learn/agents.md)
- The built-in agent has distinct read and edit capabilities; edits are suggested and applied automatically. Cursor says there is no fixed limit on tool-call count per task. [Agent overview](https://cursor.com/docs/agent/overview.md)
- Cursor automatically creates checkpoints before significant changes and snapshots all modified files. Checkpoints are local and separate from Git. [Agent overview: Checkpoints](https://cursor.com/docs/agent/overview.md#checkpoints)
- Debug Mode explicitly follows explore/hypothesize, instrument, reproduce, analyze, targeted fix, verify, and cleanup phases. [Debug Mode](https://cursor.com/docs/agent/debug-mode.md)
- Agent Review can run after an agent task/commit and compare local changes to the main branch. [Agent Review](https://cursor.com/docs/agent/agent-review.md)
- In headless CLI output, Cursor exposes separate tool-call lifecycle events (`started`, `completed`) and structured success results for write/read calls. [Headless CLI](https://cursor.com/docs/cli/headless.md#real-time-progress-tracking)

### Not documented

Cursor's public docs do not specify its edit-match algorithm, whether edits carry a base revision/hash, how stale writes are rejected, or an internal retry ceiling. It would therefore be inaccurate to claim that Cursor uses a documented per-file revision state machine.

### Inference

Cursor's visible design emphasizes recoverability, verification, and model-specific tool orchestration. Those are useful product patterns, but they do not prove a hidden optimistic-concurrency protocol.

## Claude Code

### Documented facts

- Claude Code describes the agentic loop as **gather context -> take action -> verify results**, repeated until complete. Every tool result feeds the next decision. [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works.md#the-agentic-loop)
- `Write` creates or overwrites a full file. Overwriting an existing file requires it to have been read in the current conversation; partial changes should use `Edit`. [Tools reference: Write](https://code.claude.com/docs/en/tools-reference.md#write-tool-behavior)
- `Edit` is exact string replacement, not fuzzy matching. The documented checks are read-before-edit, exact match, and uniqueness. If the file changed since the last read, an edit may still apply only when the old string exactly and uniquely matches current content; otherwise Claude re-reads before editing. [Tools reference: Edit](https://code.claude.com/docs/en/tools-reference.md#edit-tool-behavior)
- After each edit, the optional LSP integration automatically reports type errors and warnings. [Tools reference: LSP](https://code.claude.com/docs/en/tools-reference.md#lsp-tool-behavior)
- Before editing a file, Claude Code snapshots its content. Sessions persist messages, tool calls, and results as JSONL, enabling rewind/resume/fork. [How Claude Code works: sessions/checkpoints](https://code.claude.com/docs/en/how-claude-code-works.md#work-with-sessions)
- Context management removes older tool outputs first, then summarizes. If auto-compaction repeatedly refills immediately, Claude Code stops after a few attempts and reports a thrashing error rather than looping. [How Claude Code works: context](https://code.claude.com/docs/en/how-claude-code-works.md#when-context-fills-up)

### Inference

Claude Code implements optimistic safety through current-content matching rather than a documented numeric revision token. Its contract preserves unrelated disk changes when the requested old text still matches, and forces re-grounding otherwise.

## Aider

### Documented facts from the official repository

- Aider's edit-block coder parses contextual SEARCH/REPLACE blocks, reads the file at application time, and applies the block to that content. [editblock_coder.py](https://github.com/Aider-AI/aider/blob/main/aider/coders/editblock_coder.py)
- When a block fails, Aider reports the exact failed SEARCH/REPLACE block, may show similar actual lines, states which sibling blocks already succeeded, and explicitly tells the model not to resend successful blocks. The failure becomes a reflected message for another model attempt. [editblock_coder.py](https://github.com/Aider-AI/aider/blob/main/aider/coders/editblock_coder.py#L41-L124), [base_coder.py](https://github.com/Aider-AI/aider/blob/main/aider/coders/base_coder.py#L2296-L2325)
- Reflection is bounded: `max_reflections = 3`; the main run loop stops after that limit. [base_coder.py](https://github.com/Aider-AI/aider/blob/main/aider/coders/base_coder.py#L100-L106), [base_coder.py](https://github.com/Aider-AI/aider/blob/main/aider/coders/base_coder.py#L932-L944)
- Aider can lint changed files and optionally run tests after edits. Their error output can be reflected back for repair, subject to the same bounded reflection loop. [base_coder.py](https://github.com/Aider-AI/aider/blob/main/aider/coders/base_coder.py#L1599-L1623)
- The edit prompt requires SEARCH content to match existing content exactly, character for character. [editblock_prompts.py](https://github.com/Aider-AI/aider/blob/main/aider/coders/editblock_prompts.py#L120-L134)
- Aider also supports whole-file edit formats, but that is a separate coder/format rather than silently treating every partial modification as an overwrite. [wholefile_coder.py](https://github.com/Aider-AI/aider/blob/main/aider/coders/wholefile_coder.py)

### Inference

Aider's strongest anti-loop mechanism is not “reject duplicate write.” It is lossless accounting of partial success plus a repair prompt containing only failed edits, combined with a hard reflection budget.

## OpenAI Codex

### Documented facts from the official repository

- Codex exposes `apply_patch` as a grammar-constrained freeform tool rather than a generic JSON write call. The grammar distinguishes add, update, delete, and move operations. [apply_patch_spec.rs](https://github.com/openai/codex/blob/main/codex-rs/core/src/tools/handlers/apply_patch_spec.rs), [apply_patch.lark](https://github.com/openai/codex/blob/main/codex-rs/core/src/tools/handlers/apply_patch.lark)
- The patch engine parses the complete patch, computes file replacements, returns explicit parse/application errors, and reports affected paths. [apply-patch lib.rs](https://github.com/openai/codex/blob/main/codex-rs/apply-patch/src/lib.rs)
- Application records an `AppliedPatchDelta`, including changes definitely committed before a failure; it also marks the delta inexact where a failed filesystem write may have had side effects. This prevents the harness from assuming an all-or-nothing outcome it cannot prove. [apply-patch lib.rs](https://github.com/openai/codex/blob/main/codex-rs/apply-patch/src/lib.rs#L247-L270), [apply-patch lib.rs](https://github.com/openai/codex/blob/main/codex-rs/apply-patch/src/lib.rs#L310-L370)
- The handler emits streamed patch-update events and converts patch hunks into typed protocol `FileChange` records for UI/progress tracking. [apply_patch handler](https://github.com/openai/codex/blob/main/codex-rs/core/src/tools/handlers/apply_patch.rs#L71-L172)

### Inference

Codex makes mutation intent and outcome machine-readable. This is stronger than logging only `write file: path`, because the orchestrator can distinguish proposed change, applied delta, and partial failure. The inspected source does not establish a universal per-file revision/hash precondition.

## Implications for Open-OX

The primary sources support the following protocol, without requiring a speculative Cursor clone:

1. **Separate intent:** `create_file` for absent files; `patch_file` for existing files. Full overwrite of an existing file should be an explicit exceptional operation, not the default repair path.
2. **Ground patches in current content:** accept contextual hunks (`before` plus replacement) or a unified patch. At execution time, match against current disk content. When matching fails, return current nearby lines and require a re-read/rebase.
3. **Return a typed mutation result:** include `applied`, `failed`, current content digest, diagnostics, and a delta of every mutation that definitely occurred. Never report an ambiguous generic rejection after partial success.
4. **Carry forward partial success:** successful hunks become immutable facts in the next turn; tell the model to repair only failed hunks. This directly addresses repeated full writes.
5. **Bound repair, not writes:** use a small per-file/per-diagnostic reflection budget. Stop with a structured failure after repeated equivalent errors. A retry should require new evidence: a fresh read, changed patch, or changed diagnostic.
6. **Close on verification:** completion is an orchestrator decision based on required artifacts plus targeted checks, not merely the model emitting no tool call. Diagnostics should reopen only affected files.
7. **Keep checkpoints separately:** snapshot/rollback is valuable, but it is not a substitute for stale-edit detection or partial-failure accounting.
8. **Render one file lifecycle in the UI:** show create -> patches -> verified as one expandable unit while preserving raw calls for debugging. Repeated tool calls then cease to look like repeated independent file creation.

## What should not be implemented as the foundation

- A global rule that rejects the second successful write to the same path. It suppresses a symptom and can block legitimate repair.
- Prompt-only ordering rules such as “write page.tsx first.” They conflict easily with decomposition strategies and do not provide mutation consistency.
- Blind retry of the same tool input. Retrying is justified only for transient transport failures; semantic edit failures require new file evidence or a revised patch.
- Mandatory full-file regeneration after a diagnostic. It discards partial-success knowledge and magnifies context drift.

