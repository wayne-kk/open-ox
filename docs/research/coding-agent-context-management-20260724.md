# Coding-agent context and tool-history management: primary-source research

Date: 2026-07-24

## Scope and evidence standard

This note examines how coding agents keep long-running tool loops within a finite model context. It uses first-party product documentation and official source repositories only. **Documented fact** means the cited source states or implements the behavior. **Inference** means an architectural conclusion that the source supports but does not itself claim. Cursor's private implementation is deliberately not reverse-engineered from UI behavior.

## Executive findings

1. A production agent needs two histories: an immutable, replayable transcript for the UI/audit trail, and a token-bounded **model projection** built for each request. They should not be the same data structure.
2. Mature systems do not solve context pressure by shrinking completion allowance toward zero. They reserve output room and transform the input: evict stale tool results, summarize older work, or retrieve code again from the workspace.
3. Tool history is managed by semantic value. Large old observations are cheaper to reproduce and can be removed first; current failures, unresolved diagnostics, mutation outcomes, and recent turns carry more recovery value.
4. Compaction is lossy and must be recoverable. Durable instructions and current workspace state should be re-injected or re-read after compaction. A summary is a navigation aid, not the canonical copy of source code.
5. Prompt caching and compaction solve different problems. Caching reduces repeated-input cost/latency but does not increase the context window. Compaction reduces live input size but changes the cached prefix and may reduce cache hits.
6. Protocol integrity is a hard invariant: an assistant tool request and all corresponding tool results must remain a valid unit in the projected conversation. Semantic summaries should replace complete protocol units, not leave orphaned calls or results.
7. Overflow recovery must be bounded. Try local projection/compaction, recompute the budget, retry at most a small number of times, then return a typed failure with diagnostics rather than looping or sending `max_tokens=1`.

## 1. OpenAI Codex

### Documented facts

- Codex configuration exposes `model_context_window` and `model_auto_compact_token_limit`. The latter is the token threshold at which conversation history is automatically compacted. [Codex configuration reference](https://developers.openai.com/codex/config-reference/)
- The official Codex repository implements local and remote compaction paths. Compaction constructs replacement history around a summary, and the core conversation history remains a structured sequence of response items rather than an arbitrary concatenated string. [compact.rs](https://github.com/openai/codex/blob/main/codex-rs/core/src/compact.rs), [remote_compact.rs](https://github.com/openai/codex/blob/main/codex-rs/core/src/remote_compact.rs)
- Codex stores sessions and can resume them; public documentation distinguishes persisted session state from the bounded context sent to a model. [Codex CLI features](https://developers.openai.com/codex/cli/features/)
- Codex discovers repository instructions from `AGENTS.md`; those durable files can be loaded from the workspace rather than depending solely on a prior conversational mention. [Codex AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md/)
- The Responses API supports prompt caching for exact prompt prefixes. OpenAI documents that caching affects latency/cost, while requests still count all tokens toward the model's context limits. [Prompt caching](https://platform.openai.com/docs/guides/prompt-caching)

### Not publicly specified

OpenAI does not publicly document a stable per-tool retention matrix for Codex (for example, exactly how many shell results remain verbatim), nor a guarantee that every product surface uses the same compaction trigger or summary prompt.

### Inference

Codex's public shape supports a three-part design: persistent transcript, compacted continuation state, and workspace-based re-grounding. It does **not** support treating old tool payloads as the durable source of truth.

## 2. Claude Code

### Documented facts

- Claude Code describes its loop as **gather context -> take action -> verify results**; tool results feed subsequent decisions. [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works.md#the-agentic-loop)
- When context fills, Claude Code first clears older tool outputs and then summarizes the conversation. Auto-compaction is enabled by default; `/compact` lets the user trigger it and supply focus instructions. [How Claude Code works: context](https://code.claude.com/docs/en/how-claude-code-works.md#when-context-fills-up)
- Claude Code's token-usage guide says auto-compaction summarizes history near context limits, `/compact <instructions>` controls what it preserves, and custom compaction guidance can live in `CLAUDE.md`. It also recommends preprocessing verbose tool output and isolating high-volume work in subagents so only a summary returns. [Reduce token usage](https://code.claude.com/docs/en/costs#reduce-token-usage)
- MCP tool definitions are deferred by default: tool names can be advertised without loading every full definition until the tool is needed. [Reduce token usage](https://code.claude.com/docs/en/costs#reduce-token-usage)
- Claude Code reports context usage through `/context`, making prompt components and remaining capacity observable. [Interactive mode](https://code.claude.com/docs/en/interactive-mode.md)
- Sessions persist messages, tool calls, and tool results, and can be resumed or forked. File checkpoints are separate snapshots used for rewind. [How Claude Code works: sessions](https://code.claude.com/docs/en/how-claude-code-works.md#work-with-sessions)
- `CLAUDE.md` and rules are workspace-backed durable instructions. Root instructions are loaded into context; path-scoped rules and nested instructions can be loaded when relevant. [Claude Code memory](https://code.claude.com/docs/en/memory)
- Anthropic prompt caching requires an identical prefix through a cache breakpoint. Cache entries have a lifetime and reduce repeated processing cost; they do not remove the cached tokens from the request's context-window accounting. [Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- Anthropic's API context-editing capability can clear selected older tool results while preserving the conversation's logical flow; the documentation explicitly positions it for long-running agentic workflows. [Context editing](https://docs.anthropic.com/en/docs/build-with-claude/context-editing)

### Failure behavior

Claude Code's documentation states that if auto-compaction repeatedly refills immediately, it stops retrying after a few attempts and reports a context-window/thrashing error rather than compacting forever. [How Claude Code works: context](https://code.claude.com/docs/en/how-claude-code-works.md#when-context-fills-up)

### Inference

The documented order—clear old tool outputs, then summarize—expresses a useful information hierarchy: tool observations are often reproducible, while goals, decisions, and unresolved work need synthesized continuity. Persisting the full session separately allows the model projection to be lossy without making the product's history lossy.

## 3. Cursor

### Documented facts

- Cursor describes Agent as a tool loop: after every tool result, the model decides the next action. Cursor says the built-in Agent has search, read, edit, and terminal capabilities. [Cursor Agents](https://cursor.com/learn/agents.md), [Agent overview](https://cursor.com/docs/agent/overview.md)
- Cursor's context documentation distinguishes explicitly included context from codebase retrieval. Codebase indexing computes embeddings for files and supports semantic retrieval instead of placing an entire repository into every prompt. [Codebase indexing](https://cursor.com/docs/context/codebase-indexing.md)
- Cursor documents context indicators and an automatic context mode that selects relevant context for a request. [Context](https://cursor.com/docs/context/overview.md)
- Checkpoints snapshot agent-made file changes and are local/separate from Git. They address rollback, not context-window growth. [Agent overview: checkpoints](https://cursor.com/docs/agent/overview.md#checkpoints)

### Not publicly specified

Cursor's official public documentation does **not** specify:

- an exact automatic-compaction threshold;
- whether old tool call/result blocks are summarized, deleted, or both;
- the summary schema or model used;
- a tool-specific retention table;
- the exact overflow retry count;
- whether its visible chat transcript is identical to the messages sent on every subsequent model request.

Accordingly, the statement “Cursor keeps every tool result in model context” is unsupported. So is the opposite claim that it always compacts a particular class of tool after a fixed number of turns.

### Inference

Cursor's documented retrieval/indexing model makes whole-repository residency unnecessary. The UI can retain a complete visible history while a request uses retrieved code and a smaller conversation projection, but the details of that projection remain private.

## 4. Aider

### Documented facts from the official repository/docs

- Aider maintains a repository map: a compact graph-ranked representation of important symbols and relationships from files that are not fully in the chat. It fits the map to a configurable token budget. [Repository map](https://aider.chat/docs/repomap.html), [repomap.py](https://github.com/Aider-AI/aider/blob/main/aider/repomap.py)
- Aider exposes a `--map-tokens` budget and dynamically allocates map space, showing that repository context is selected and compressed rather than fully resident. [Configuration options](https://aider.chat/docs/config/options.html)
- Aider has a dedicated chat-history summarizer. The implementation partitions older history from recent messages, requests a summary of the older portion, and can recursively summarize when required to fit token limits. [history.py](https://github.com/Aider-AI/aider/blob/main/aider/history.py)
- Aider's edit loop reflects failed edits, lint output, and test failures back to the model but caps reflection attempts. [base_coder.py](https://github.com/Aider-AI/aider/blob/main/aider/coders/base_coder.py), [editblock_coder.py](https://github.com/Aider-AI/aider/blob/main/aider/coders/editblock_coder.py)
- Aider records chat history to disk independently of the active model prompt. [Chat history](https://aider.chat/docs/usage/commands.html)

### Inference

Aider cleanly separates “what the model needs now” into recent chat, selected full files, and a token-bounded repository map. Its source also demonstrates that summary generation itself needs overflow handling; one summarization call is not guaranteed to fit.

## 5. OpenHands

### Documented facts from the official repository/docs

- OpenHands SDK makes the separation explicit: the event log is durable, while a `View` determines which events enter model context. A condenser can create a durable `Condensation` event containing a summary and `forgotten_event_ids`; the view filters those forgotten events and inserts the summary. [Condenser architecture](https://docs.openhands.dev/sdk/arch/condenser.md), [view.py](https://github.com/OpenHands/software-agent-sdk/blob/main/openhands-sdk/openhands/sdk/context/view.py)
- `LLMSummarizingCondenser` keeps the first and last portions of history and summarizes the middle. The official guide documents defaults of `max_size=120` events and `keep_first=4`; recent messages remain intact while older content is summarized. [Context condenser guide](https://docs.openhands.dev/sdk/guides/context-condenser.md)
- Condensation runs proactively as agent steps are processed and can also be requested after an LLM context-window error. `PipelineCondenser` can compose removal, summarization, and truncation stages. [Condenser architecture](https://docs.openhands.dev/sdk/arch/condenser.md), [condenser source](https://github.com/OpenHands/software-agent-sdk/tree/main/openhands-sdk/openhands/sdk/context/condenser)

### Caution

OpenHands has undergone package and repository reorganizations. The current SDK links above are authoritative for those paths, but Open-OX should copy the architectural boundary—not depend on an unstable internal class name.

### Inference

OpenHands provides the clearest open-source precedent for event sourcing plus a lossy model projection: canonical events remain auditable, while a condenser decides what the LLM sees.

## 6. Cross-product comparison

| Concern | Codex | Claude Code | Cursor | Aider | OpenHands |
|---|---|---|---|---|---|
| Automatic compaction | Documented config/source | Documented, default | Exact behavior unpublished | History summarizer in source | Condenser in source |
| Tool-result eviction | Internal specifics unpublished | Older tool outputs cleared first | Unpublished | History summarized; edit feedback bounded | Older events condensed |
| Code retrieval | Workspace tools/instructions | Read/search + workspace instructions | Embedding index + retrieval | Full selected files + repo map | Agent/runtime tools and observations |
| Durable transcript separate from prompt | Session/resume | JSONL sessions | UI/history exists; projection details unpublished | History file + active prompt | Event stream + condensed view |
| Prompt caching | OpenAI API capability | Anthropic API capability | Provider-specific details unpublished | Provider-dependent | Provider-dependent |
| Failure behavior | Configurable threshold; source handles compaction errors | Bounded anti-thrashing | Unpublished | Bounded reflections/recursive summary | Condenser/runtime policy |

## 7. Architecture requirements supported by the evidence

The primary sources justify the following requirements for Open-OX:

### 7.1 Canonical log and model projection must be separate

Persist every user/model/tool event in an append-only `SessionEventLog`. Before each model call, derive a `ContextProjection`. The projection may omit, truncate, or summarize events; the log may not. The UI reads the log, not the projection.

### 7.2 State should be recoverable outside conversation prose

Keep task contract, target paths, mutation ledger, current revisions, unresolved diagnostics, and verification status as typed session state. Keep source code in the workspace. A compaction summary should point to these canonical stores rather than duplicate whole files.

### 7.3 Budget output first

For context window `W`, reserve completion `O` and safety/tool-schema margin `S` before selecting input:

```text
maximum projected input = W - O - S
```

If the projection exceeds that bound, compact input. Never reduce `O` below the minimum needed for a valid tool call merely to make a request syntactically fit.

### 7.4 Compact semantically, in stages

Use the lowest-loss stage that meets budget:

1. Remove byte-heavy fields from completed successful mutations, retaining path, operation, digest/revision, and outcome.
2. Deduplicate superseded reads/searches; keep the newest observation per resource.
3. Truncate old reproducible terminal/search output, with a reference to the full logged event.
4. Replace resolved diagnostic episodes with a typed resolution summary.
5. Summarize an old, closed span of turns into goals, decisions, mutations, unresolved work, and verification.
6. If still oversized, re-retrieve only currently relevant source and fail explicitly if the invariant state itself cannot fit.

### 7.5 Preserve protocol units

Projection validation must ensure:

- every retained assistant tool call has exactly one retained result per call id;
- no retained tool result is orphaned;
- a whole multi-call assistant turn is retained, replaced, or removed coherently;
- the final request turn is valid for the selected provider;
- compaction summaries enter through a provider-valid continuation format;
- ordering of mutations and their results is unchanged.

### 7.6 Make overflow recovery bounded and observable

On a provider overflow/length response:

1. record the provider's actual input/output usage;
2. run one stronger projection pass;
3. validate protocol integrity and recompute tokens;
4. retry once with the normal output reserve;
5. if still failing, stop with a typed `CONTEXT_EXHAUSTED` report containing the largest retained categories and suggested recovery.

Track compaction count, before/after tokens, removed tool bytes, summary tokens, cache-read/write tokens, retry result, and time-to-refill. These metrics are needed to detect lossy summaries, cache fragmentation, and compaction thrashing.

## 8. What the evidence does not justify

- Keeping all tool results verbatim because the UI displays them.
- Deleting all old tool results indiscriminately.
- Treating prompt caching as extra context capacity.
- Trusting a generated summary as the authoritative source of file contents or mutation success.
- Compressing only one side of a tool-call/result exchange.
- Automatically retrying overflow by setting completion tokens to `1`.
- Claiming Cursor uses a particular hidden compaction algorithm.

## 9. Source index

### OpenAI

- [Codex configuration reference](https://developers.openai.com/codex/config-reference/)
- [Codex CLI features](https://developers.openai.com/codex/cli/features/)
- [Codex AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md/)
- [OpenAI prompt caching](https://platform.openai.com/docs/guides/prompt-caching)
- [openai/codex compaction source](https://github.com/openai/codex/blob/main/codex-rs/core/src/compact.rs)

### Anthropic

- [Claude Code: how it works](https://code.claude.com/docs/en/how-claude-code-works.md)
- [Claude Code memory](https://code.claude.com/docs/en/memory)
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
- [Anthropic context editing](https://docs.anthropic.com/en/docs/build-with-claude/context-editing)

### Cursor

- [Cursor Agent overview](https://cursor.com/docs/agent/overview.md)
- [Cursor Agents](https://cursor.com/learn/agents.md)
- [Cursor context overview](https://cursor.com/docs/context/overview.md)
- [Cursor codebase indexing](https://cursor.com/docs/context/codebase-indexing.md)

### Aider

- [Aider repository map](https://aider.chat/docs/repomap.html)
- [Aider configuration options](https://aider.chat/docs/config/options.html)
- [Aider official repository](https://github.com/Aider-AI/aider)

### OpenHands

- [OpenHands condenser architecture](https://docs.openhands.dev/sdk/arch/condenser.md)
- [OpenHands context condenser guide](https://docs.openhands.dev/sdk/guides/context-condenser.md)
- [OpenHands SDK condenser source](https://github.com/OpenHands/software-agent-sdk/tree/main/openhands-sdk/openhands/sdk/context/condenser)
