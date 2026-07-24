# Agent Context Management v0.1

**Status**: Proposed  
**Date**: 2026-07-24  
**Scope**: Generate Role Workers first; Intent Agent persistence second; Modify/Subagent adoption later  
**Research**: [`docs/research/coding-agent-context-management-20260724.md`](../research/coding-agent-context-management-20260724.md)

## 1. Decision

Introduce one deep `AgentContext` Module at `ai/shared/agentContext`.

Its Interface owns three operations:

```ts
export interface AgentContext {
  append(events: readonly NewContextEvent[]): Promise<AppendReceipt>;
  project(request: ProjectionRequest): Promise<ContextProjection>;
  observe(observation: ProviderObservation): Promise<void>;
}
```

Everything else is implementation:

- canonical event persistence;
- provider message projection;
- tool-call/result grouping;
- semantic retention policy;
- token estimation and provider-usage calibration;
- deterministic compaction;
- model-generated condensation;
- overflow recovery;
- provider protocol validation;
- compaction observability.

Callers must not manipulate long-lived `ChatMessage[]`, choose truncation limits, or splice history. `toolLoop` remains the execution orchestrator, but asks `AgentContext` for each provider request.

The core separation is:

```text
Canonical Session Event Log         Context Projection
---------------------------         ------------------
append-only                         derived per request
complete/auditable                  token bounded
provider neutral                    provider specific
never compacted in place            may omit/summarize
UI/resume source                    model input only
```

Source code remains canonical in the workspace. A context summary may point to a path and revision; it is never authoritative source content.

## 2. Why this architecture

Primary-source research shows the same broad pattern across mature coding agents:

- Codex exposes automatic compaction thresholds and keeps resumable session state separate from the bounded model context.
- Claude Code documents clearing older tool outputs before summarizing the conversation.
- Cursor publicly documents selective codebase retrieval, but does not publish a per-tool retention algorithm; no design decision here depends on guessing it.
- Aider keeps recent chat plus summaries and a token-bounded repository map.
- OpenHands provides the clearest public precedent: durable events, a derived model view, and typed condensation records with forgotten event IDs.

Open-OX already has the beginning of a request-only projection in `compactToolHistoryForRequest()`, but context ownership remains split across `toolLoop`, Page helpers, per-agent callbacks, and Intent persistence.

This split caused or enabled three observed failures:

1. Completed tool arguments were once rewritten and replayed with a schema-invalid `_compacted` payload.
2. A request ending with an assistant/model turn reached Gemini because continuation semantics were distributed across callers.
3. Input growth squeezed `max_tokens` down to `1` because budgeting and compaction were not one decision.

The new Module places all three correctness rules at one seam.

## 3. Domain vocabulary

**Session Event Log**  
The immutable ordered record of instructions, user turns, assistant turns, tool calls, tool results, typed task facts, provider observations, and condensation events.

**Protocol Unit**  
One assistant tool-call turn plus every corresponding tool result. A multi-call assistant turn is one indivisible Protocol Unit for projection and compaction.

**Context Projection**  
The provider-valid, token-bounded request view derived from the Session Event Log.

**Durable Task State**  
Typed facts needed for recovery: goal, owned/target paths, mutations and revisions, unresolved diagnostics, verification state, decisions, and pending postconditions.

**Condensation Event**  
An append-only summary of a closed event span plus the IDs hidden from future projections. It never deletes canonical events.

**Rehydration**  
Re-reading canonical workspace or diagnostic state after old observations have left the Context Projection.

Avoid calling the Context Projection “history”: history means the Session Event Log.

## 4. Module shape

```text
ai/shared/agentContext/
├── index.ts                       # only public seam
├── types.ts
├── agentContext.ts                # deep implementation coordinator
├── events/
│   ├── protocolUnits.ts
│   ├── stateReducer.ts
│   └── validation.ts
├── projection/
│   ├── planner.ts
│   ├── budget.ts
│   ├── providerProjector.ts
│   └── projectionValidator.ts
├── semantics/
│   ├── observationSemantics.ts     # private internal seam
│   ├── fileToolAdapter.ts
│   ├── systemToolAdapter.ts
│   ├── controlToolAdapter.ts
│   └── opaqueToolAdapter.ts
├── condensation/
│   ├── deterministic.ts
│   ├── semantic.ts
│   └── overflowController.ts
└── adapters/
    ├── inMemoryEventStore.ts
    ├── jsonlEventStore.ts
    ├── fileBlobStore.ts
    └── gatewaySummarizer.ts
```

Internal files may be reorganized without changing the Interface. Callers import only from `ai/shared/agentContext/index.ts`.

### 4.1 Opening a context

```ts
export function openAgentContext(
  spec: AgentContextSpec,
  dependencies: AgentContextDependencies,
): Promise<AgentContext>;

export interface AgentContextSpec {
  session: {
    id: string;
    kind: "page" | "scaffold" | "chrome" | "intent" | "modify" | "subagent";
    durability: "ephemeral" | "persisted";
  };
  policyVersion: "v1";
}
```

Model and tool definitions belong to `ProjectionRequest`, not the session spec, because routing and the active tool subset may change by round.

### 4.2 Projection request and result

```ts
export interface ProjectionRequest {
  model: {
    id: string;
    provider: "openai" | "anthropic" | "gemini-compatible";
    contextWindow: number;
  };
  tools: readonly ChatCompletionTool[];
  toolChoice: "auto" | "required" | "none";
  completionProfile: "control" | "code";
  pressure: "normal" | "overflow_recovery";
}

export interface ContextProjection {
  messages: readonly ChatMessage[];
  maxCompletionTokens: number;
  throughEventId: ContextEventId;
  provenance: {
    includedEventIds: readonly ContextEventId[];
    summarizedEventIds: readonly ContextEventId[];
    omittedEventIds: readonly ContextEventId[];
    condensationEventIds: readonly ContextEventId[];
  };
  budget: {
    contextWindow: number;
    estimatedInputTokens: number;
    toolSchemaTokens: number;
    completionReserve: number;
    safetyReserve: number;
  };
  compaction: {
    stages: readonly CompactionStage[];
    estimatedTokensBefore: number;
    estimatedTokensAfter: number;
    removedPayloadBytes: number;
  };
}
```

### 4.3 Provider observation

```ts
export interface ProviderObservation {
  throughEventId: ContextEventId;
  model: string;
  outcome:
    | "completed"
    | "output_length"
    | "context_overflow"
    | "provider_error";
  usage?: {
    promptTokens: number;
    completionTokens: number;
    reasoningTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
}
```

`observe()` calibrates later estimates and records telemetry. It does not rewrite canonical conversation events.

## 5. Canonical event model

```ts
export type NewContextEvent =
  | {
      kind: "instruction";
      scope: "system" | "task" | "recovery";
      content: ChatMessageContent;
    }
  | { kind: "user_message"; content: ChatMessageContent }
  | { kind: "assistant_message"; content: ChatMessageContent }
  | {
      kind: "assistant_tool_calls";
      content: ChatMessageContent;
      calls: readonly ToolCallEvent[];
    }
  | {
      kind: "tool_result";
      callId: string;
      toolName: string;
      arguments: unknown;
      result: ToolResult | string;
      semantics: ToolSemantics;
    }
  | { kind: "task_state"; state: DurableTaskState }
  | { kind: "condensation"; condensation: Condensation };
```

Assistant tool calls and results remain separate append events so an execution crash is auditable. The implementation derives a Protocol Unit and projects it only when all declared call IDs have a terminal result. An incomplete unit is never sent as historical context and never condensed.

Large raw payloads are content-addressed through an internal `BlobStore`. The event keeps a digest, byte count, preview, and blob reference. The projection never loads the blob unless a retention policy explicitly requests it.

### 5.1 Condensation schema

```ts
export interface Condensation {
  coveredSequence: { from: number; through: number };
  forgottenEventIds: readonly ContextEventId[];
  summary: {
    task: string;
    decisions: readonly string[];
    completedActions: readonly ActionFact[];
    unresolvedWork: readonly UnresolvedFact[];
    verification: readonly VerificationFact[];
    rehydrationHints: readonly RehydrationHint[];
  };
  provenance: {
    policyVersion: string;
    sourceEventIds: readonly ContextEventId[];
    summarizerModel?: string;
  };
  tokenAccounting: {
    before: number;
    after: number;
    summary: number;
  };
}
```

`forgottenEventIds` means hidden from later model projections, not deleted from the log.

## 6. Hard invariants

### 6.1 Canonical history

1. Events are append-only; IDs and sequence numbers remain stable after resume.
2. UI, audit, debugging, and replay read the Session Event Log, never the lossy Context Projection.
3. Compaction never mutates a prior assistant tool call or tool result.
4. Source content is authoritative only in the workspace/blob store, never in a generated summary.
5. A summary cannot establish a successful mutation, resolved diagnostic, or passed verification unless typed canonical events support it.

### 6.2 Tool protocol

1. Every retained assistant call ID has exactly one retained result.
2. Every retained tool result has one retained assistant call.
3. Multi-call turns are retained, summarized, or omitted as a whole.
4. Call/result ordering is unchanged.
5. Pending Protocol Units cannot be condensed.
6. The final provider request turn is valid for that provider.
7. Provider-specific summary/recovery messages are emitted by `providerProjector`; callers do not choose `system` versus `user`.

### 6.3 Budget

```text
input ceiling = context window
              - completion reserve
              - safety reserve
              - active tool schema tokens
```

1. Completion reserve is allocated before input.
2. `code` reserves 16,384 tokens; `control` reserves 8,192 tokens.
3. Completion reserve is never silently reduced to make input fit.
4. A projection is not returned unless the full inequality holds.
5. If pinned invariant state cannot fit, throw typed `CONTEXT_EXHAUSTED` without calling the provider.

## 7. Tool semantic retention

Tool semantics are assigned at ingestion by the Adapter that owns tool execution and result interpretation. Callers do not pass arbitrary retention flags, and `AgentContext` does not maintain a brittle public `toolName -> retention policy` switch.

```ts
interface AgentTool {
  definition: ChatCompletionTool;
  execute(args: Record<string, unknown>): Promise<ToolResult | string>;
  observationSemantics?: ObservationSemantics;
}

interface ObservationSemantics {
  interpret(call: ToolCall, result: ToolResult | string): ToolSemantics;
}
```

The tool Adapter describes what happened; the central projection implementation decides what remains under budget. This keeps cross-tool state transitions central: a patch can invalidate a snapshot, and a verification success can resolve diagnostics.

```ts
interface ToolSemantics {
  outcome: "success" | "failure";
  sideEffect: "none" | "workspace_mutation" | "external_mutation";
  reproducibility: "cheap" | "expensive" | "not_reproducible";
  resource?: {
    kind: "file" | "directory" | "search" | "diagnostics" | "command" | "asset";
    key: string;
    revision?: string;
  };
  diagnostics?: {
    state: "none" | "unresolved" | "resolved";
    fingerprint?: string;
  };
}
```

First-party adapters cover FileSession tools, system/search/shell/image tools, and Intent control tools. Unknown extension tools are wrapped by `OpaqueToolAdapter`: keep the latest complete Protocol Unit, externalize large payloads, and never infer that a side effect is safe to forget.

| Tool family | Raw log | Normal projection | Eligible for stronger compaction |
|---|---|---|---|
| `create_file`, `write_file` success | Full event/blob | Path, digest/revision, diagnostics, success receipt; source body omitted immediately | Closed receipt may join a span summary |
| `apply_file_patch`, `edit_file` success | Full event/blob | Path, base/new revision, edit summary, diagnostics | Superseded receipts collapse; mutation order retained |
| Mutation failure | Full event/blob | Error, target, recovery-relevant arguments, latest diagnostics | Only after a later canonical success resolves the episode |
| `read_file_snapshot` | Full event/blob | Latest required snapshot per path/revision | Superseded reads omitted; active patch dependency pinned |
| `read_file` | Full event/blob | Recent relevant preview and path/revision | Re-read from workspace; older content omitted |
| `search_code`, `list_dir`, glob | Full event/blob | Query plus compact hit summary | Superseded/repeated observations omitted; cheap to reproduce |
| `verify_files`, typecheck, lint | Full event/blob | Unresolved diagnostics exact; clean result as receipt | Resolved diagnostic episode becomes typed summary |
| Shell success | Full event/blob | Command, exit code, concise output summary | Reproducible output truncated; side-effect receipt retained |
| Shell failure | Full event/blob | Command, exit code, stderr needed for recovery | Eligible only after resolution or explicit abandonment |
| Package install | Full event/blob | Package/version/outcome and lockfile side effect | Raw installer output omitted; receipt retained |
| Image generation | Full event/blob | Final asset path, dimensions, attempt outcome | Base64 and provider payload never enter projection |
| Control tools (`yield`, `commit`) | Full event | Exact small result through turn resolution | Closed control episode may be summarized |
| Unknown tool | Full event/blob | Latest bounded complete unit | No semantic omission without a registered policy |

## 8. Progressive compaction pipeline

Compaction is a deterministic read-time projection until the final semantic stage.

```text
Stage 0  Blob externalization at ingestion
Stage 1  Successful mutation receipts; source arguments removed from projection
Stage 2  Superseded read/search/list observations removed
Stage 3  Resolved diagnostic episodes collapsed
Stage 4  Old reproducible terminal/search output truncated
Stage 5  Closed spans folded into deterministic typed checkpoints
Stage 6  Model-generated semantic condensation of an old closed span
Stage 7  Typed CONTEXT_EXHAUSTED failure
```

Stages 0–1 run on every projection because they are cheap and low-loss.

Let `I` be the input ceiling after output, safety, and tool-schema reservation:

- below `0.80 × I`: use Stages 0–1 only;
- at or above `0.80 × I`: run Stages 2–5 and compact toward `0.65 × I`;
- above `I` after deterministic stages: run one Stage 6 condensation;
- above `I` after condensation: fail with `CONTEXT_EXHAUSTED`.

Semantic condensation is never the first response to pressure.

### 8.1 Stable prefix and prompt caching

Keep the following order stable:

```text
provider system instructions
project/task instructions
active tool schemas
latest condensation/checkpoint
recent raw Protocol Units
current user/recovery turn
```

Prompt caching reduces latency/cost but not context use. Correctness and output reserve take priority over cache hits. Compression should target the middle/old tail rather than mutate stable instructions.

## 9. Provider usage calibration

The estimator remains conservative, but provider usage becomes a feedback signal.

For each provider/model, keep an exponentially weighted ratio:

```text
calibration ratio = actual prompt tokens / estimated prompt tokens
next estimate     = raw estimate × bounded calibration ratio
```

Bound the ratio to prevent one malformed usage report from destabilizing later requests. Persist calibration by provider/model version, not by user conversation.

Classify `finish_reason=length` correctly:

- completion tokens near `max_tokens`: output truncation;
- completion tokens near zero plus prompt near context limit: context pressure;
- ambiguous: one stronger projection retry, then typed failure.

## 10. Overflow and anti-thrashing state machine

```text
project(normal)
  ├─ fits → provider call
  │          ├─ success → observe usage; continue
  │          ├─ output length → one output-recovery turn
  │          └─ context overflow/ambiguous zero output
  │                → observe usage
  │                → project(overflow_recovery)
  │                → validate + retry once with normal output reserve
  │                → typed CONTEXT_EXHAUSTED on failure
  └─ cannot fit → deterministic stages → semantic condensation once → fail
```

Circuit breakers:

- at most one provider retry for one projected round;
- at most one semantic condensation per round;
- at most three semantic condensations within five LLM rounds;
- if a new projection refills above the soft threshold immediately after three condensations, throw `CONTEXT_THRASHING` with largest retained categories.

Never retry by lowering completion reserve below the profile target.

## 11. Persistence and adapters

### 11.1 Dependency categories

In-process implementation, with no exposed seam:

- Protocol Unit construction;
- state reduction;
- retention selection;
- budget arithmetic;
- condensation resolution;
- projection/provider validation.

Local-substitutable internal seams:

```ts
interface SessionEventStore {
  append(sessionId: string, events: readonly NewContextEvent[]): Promise<readonly ContextEvent[]>;
  read(sessionId: string, afterSequence?: number): Promise<readonly ContextEvent[]>;
}

interface ContextBlobStore {
  put(content: Uint8Array): Promise<BlobRef>;
  get(ref: BlobRef): Promise<Uint8Array>;
}
```

Adapters:

- `InMemoryEventStore` + `InMemoryBlobStore` for Page/Scaffold/Chrome workers and tests;
- `JsonlEventStore` + `FileBlobStore` for Intent/Modify persisted sessions.

True external internal seam:

```ts
interface CondensationSummarizer {
  summarize(input: CondensationInput): Promise<CondensationSummary>;
}
```

Adapters:

- production gateway adapter;
- deterministic fake adapter for tests.

Observability is a write-only Adapter. It receives facts and cannot influence correctness.

### 11.2 Intent session v2

Replace `IntentAgentPersistedSessionV1.messages` with:

```ts
interface IntentAgentSessionV2 {
  version: 2;
  projectId: string;
  sessionId: string;
  updatedAt: string;
  turnCounter: number;
  lastSequence: number;
  policyVersion: "v1";
}
```

Events live in append-only JSONL; large payloads live under a sibling blob directory.

Migration is read-old/write-new:

1. Load V1 `messages`.
2. Convert and validate complete Protocol Units.
3. Write V2 event log and reload it.
4. Compare identity projection to the V1 messages.
5. Rename, do not delete, the V1 file to `.migrated-v1.json`.

## 12. Observability

Record one projection report per provider call:

```ts
interface ContextProjectionReport {
  sessionKind: string;
  model: string;
  policyVersion: string;
  pressure: "normal" | "overflow_recovery";
  estimatedTokensBefore: number;
  estimatedTokensAfter: number;
  actualPromptTokens?: number;
  completionReserve: number;
  stageApplied: readonly CompactionStage[];
  bytesExternalized: number;
  protocolUnitsIncluded: number;
  protocolUnitsSummarized: number;
  protocolUnitsOmitted: number;
  unresolvedItemsPinned: number;
  largestCategories: readonly TokenCategory[];
  condensationCount: number;
  turnsSinceCondensation?: number;
  overflowRetry: boolean;
  providerOutcome?: string;
}
```

Required dashboards/alerts:

- provider protocol-invalid 400 rate;
- context overflow and zero-output length rate;
- estimate/actual token ratio by provider/model;
- compaction stage frequency and before/after ratio;
- overflow retry success rate;
- turns-to-refill after condensation;
- `CONTEXT_EXHAUSTED` largest categories;
- prompt cache read/write tokens where available;
- task completion and verification success segmented by compaction stage.

Compaction is not successful merely because token count fell. Quality/postcondition metrics must not regress.

## 13. Verification strategy

Tests cross the `AgentContext` Interface, not private helpers.

### 13.1 Characterization fixtures

Preserve fixtures for every observed incident:

- schema-invalid `_compacted` tool arguments;
- orphaned tool result/call pairs;
- Gemini request ending in assistant/model turn;
- `max_tokens=1` budget collapse;
- oversized failed write needed for recovery;
- successful write containing unresolved diagnostics;
- missing multi-page target followed by successful creation.

### 13.2 Interface tests

- identity projection reproduces a valid legacy transcript;
- successful mutation payload leaves projection but remains in log/blob;
- failed mutation remains recoverable;
- unresolved diagnostics remain pinned;
- resolved diagnostics condense;
- latest snapshot supersedes older snapshots;
- multi-call Protocol Unit is all-or-nothing;
- orphan or duplicate result is rejected;
- pending unit cannot condense;
- forgotten IDs are same-session, earlier, and complete units;
- overlapping condensations resolve deterministically;
- provider final turn is valid for OpenAI and Gemini-compatible adapters;
- completion reserve never falls below profile target;
- stronger recovery occurs once only;
- summarizer failure leaves canonical log unchanged;
- restart/replay returns an equivalent projection;
- three concurrent Page workers have isolated IDs, state, and projections.

### 13.3 Property and differential tests

Generate random valid histories containing multi-call turns, failures, diagnostics, reads, and mutations. After every compaction stage assert protocol validity and budget invariants.

During shadow rollout, compare:

- legacy request versus identity projection;
- estimated versus provider prompt tokens;
- legacy versus v2 task postconditions;
- prompt bytes and tool result categories.

## 14. Executable migration

### Phase 0 — Lock the contract

Files:

- add `ai/shared/agentContext/types.ts` and Interface tests;
- add incident fixtures under `ai/shared/agentContext/__fixtures__/`;
- record this decision in an ADR after review.

Exit criteria:

- all observed incidents are red-capable fixtures;
- invariants and typed failures are approved;
- no production caller changes.

### Phase 1 — Identity event log and projection

Files:

- add `events/`, `projection/providerProjector.ts`, in-memory adapters;
- add a compatibility converter from valid `ChatMessage[]`;
- shadow-record Page worker events from `toolLoop`.

Behavior:

- projection performs no semantic compaction;
- provider still receives the legacy request;
- telemetry compares legacy and identity projections.

Exit criteria:

- exact call IDs, order, provider fields, and content survive replay;
- no projection mismatch on representative Generate runs;
- no change in provider behavior.

### Phase 2 — `AgentContext` owns Page request projection

Files:

- change `ai/shared/llm/toolLoop.ts` to append/project/observe;
- migrate Page, Scaffold, Chrome, and Section Replica workers to `InMemoryEventStore`;
- move token estimation, output reservation, final-turn validation, and current safe compaction into `AgentContext`.

Feature flag:

```text
AGENT_CONTEXT_V2_PAGE
```

Exit criteria:

- focused Generate Role Worker tests pass;
- three-page concurrency test passes;
- protocol-invalid requests remain zero;
- rollback is one flag.

### Phase 3 — Tool semantics and deterministic compaction

Files:

- introduce `AgentTool` internally with a compatibility adapter for today's `tools + executeToolOverrides` shape;
- move FileSession, system/search/shell/image, and Intent-control semantics beside their executors;
- add the central Stage 0–5 projection pipeline;
- migrate Page-specific result formatting into semantic observations;
- add blob externalization and resource/revision dedupe.

Enable in order:

1. successful mutation receipts;
2. superseded reads/searches;
3. resolved diagnostics;
4. reproducible output truncation;
5. deterministic typed checkpoints.

Exit criteria:

- each policy has an Interface-level red/green fixture;
- projection reaches target headroom without LLM summary on normal Page runs;
- task completion and verification do not regress;
- raw events remain auditable.

### Phase 4 — Usage feedback and bounded recovery

Files:

- return provider usage through `observe()`;
- add per-provider/model calibration;
- replace the current generic length retry with output-length versus context-pressure classification;
- add overflow circuit breakers.

Exit criteria:

- no request is sent below the configured completion reserve;
- context-pressure retry happens at most once;
- estimate/actual error stays within an agreed production band;
- failures return typed category diagnostics.

### Phase 5 — Intent persistence v2

Files:

- add JSONL/file adapters;
- migrate `intentAgent/sessionStore.ts` to V2 metadata plus event log;
- add V1 read-old/write-new converter and restart tests.

Feature flag:

```text
AGENT_CONTEXT_V2_INTENT
```

Exit criteria:

- V1 sessions resume without loss;
- successful migration is reload-verified before V1 rename;
- persisted log and UI remain complete while prompt projection compacts.

### Phase 6 — Model-generated condensation

Only begin if production metrics show deterministic stages cannot maintain headroom.

Files:

- add summarizer internal port and gateway/fake adapters;
- add Condensation Event validation and rehydration hints;
- add anti-thrashing metrics and circuit breaker.

Feature flag:

```text
AGENT_CONTEXT_V2_SEMANTIC_CONDENSATION
```

Exit criteria:

- summary cannot change typed task facts;
- canonical events survive summarizer failure;
- overflow recovery improves without postcondition regression;
- no more than one summarizer call per pressure episode.

### Phase 7 — Remove legacy context ownership

Delete after every production caller migrates:

- `compactMessagesBeforeRound` caller hook;
- `compactPageAgentMessages()`;
- `compactToolHistoryForRequest()` and budgeting from `toolLoop`;
- Intent V1 writes;
- long-lived caller-owned mutable `ChatMessage[]`.

Replace implementation-specific tests with `AgentContext` Interface tests. Keep incident fixtures permanently.

## 15. Rollout and rollback

Roll out by session kind, not by percentage of individual rounds. A session must not switch context model midway.

1. local tests and recorded transcript replay;
2. shadow projection in development;
3. Page sessions for internal users;
4. Page sessions generally;
5. Intent V2 migration;
6. semantic condensation only with evidence.

Rollback disables the session-kind flag for new sessions. Existing V2 persisted sessions remain readable; do not downgrade-write them into V1. A repair/export command can materialize a provider-neutral transcript from the event log if emergency recovery is needed.

## 16. Alternatives considered

### A. Continue adding helpers to `toolLoop`

Rejected. Budgeting, compaction, provider validity, persistence, and tool semantics would remain scattered. The Module deletion test shows the complexity would immediately reappear across Page and Intent callers.

### B. Keep `ChatMessage[]` canonical and store summary messages in place

Rejected. It cannot provide a complete UI/audit trail, encourages protocol-pair corruption, and makes provider format the persistence schema.

### C. Expose a public per-tool retention registry

Rejected. It is flexible but shallow: every caller would need to understand context correctness, aliases would drift, and cross-tool resolution cannot be expressed as independent TTLs. Tool execution Adapters emit descriptive semantics; `AgentContext` owns retention decisions, with a conservative opaque fallback.

### D. Event log without a small facade

Rejected as the caller Interface. Event sourcing is the right implementation model, but callers should not learn condensation resolution, stores, token calibration, or provider validation.

### Recommended hybrid

Use the minimal three-operation `AgentContext` Interface, the append-only event-log implementation, tool-owned observation semantics, and one central projection policy. This combination has the most Depth and Locality:

- minimal caller knowledge;
- durable audit/replay;
- extensible semantics beside tool execution without leaking retention policy;
- one correctness seam for every agent loop.

## 17. Success criteria

Correctness:

- zero provider protocol errors caused by projected history;
- zero requests with completion below the profile reserve;
- no lost unresolved diagnostic or failed mutation in recovery fixtures;
- exact session replay after restart.

Capacity:

- normal Page runs stay below the soft pressure threshold using deterministic stages;
- overflow retry succeeds or returns typed failure after one attempt;
- no compaction thrashing loop.

Quality:

- Page/Intent postcondition success does not regress versus baseline;
- verification failure rate does not rise with stronger compaction stages;
- semantic summaries never become file or mutation truth.

Operability:

- every projection has before/after budget and provenance;
- largest retained categories are visible on exhaustion;
- each rollout stage has one feature-flag rollback path.
