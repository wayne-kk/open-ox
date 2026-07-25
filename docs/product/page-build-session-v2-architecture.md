# Page Build Session v2 Architecture

**Status:** Implemented  
**Date:** 2026-07-25  
**Scope:** Generate pipeline `page_implement_agent`

## 1. Decision

Page Implement remains a parallel **Role Worker**, but it no longer assembles a generic tool loop.
Each worker calls one deep Module:

```ts
runPageBuildSession(spec): Promise<PageBuildSessionResult>
```

`PageBuildSession` owns the runtime phase, legal tool surface, recovery turns, context projection,
tool-to-file-command translation, and stop decision. The Page Worker owns only composition:
prompts, image policy, UI event projection, and final artifact validation.

Provider-specific request shapes are owned by `ProviderAdapter`; workspace lifecycle and
compare-and-swap writes are owned by `FileSession`. These three seams separate orchestration,
provider protocol, and filesystem correctness.

## 2. Previous architecture

```mermaid
flowchart TD
  W["Page Worker"] --> P["Prompt rules"]
  W --> L["Generic ToolLoop"]
  W --> F["FileSession callbacks"]
  W --> R["Recovery / completion callbacks"]
  P -. "first-round advice only" .-> M["Model"]
  L --> G["Generic gateway payload"]
  G --> M
  M --> T["All generic page tools"]
  T --> F
  L --> C["Mixed raw history + ad hoc compaction"]
  C --> G
```

The old worker distributed one state machine across prompt text, ToolLoop callbacks, FileSession,
and UI bookkeeping. The model could choose image generation or component writes before the target,
repeat successful creates, and emit patch coordinates against stale or formatted source. Generic
history retained large failed source arguments. The gateway also inferred request controls instead
of projecting an explicit provider contract.

## 3. Current architecture

```mermaid
flowchart TD
  O["Generate orchestrator"] -->|"parallel, disjoint ownership"| W["Page Worker"]
  W -->|"runPageBuildSession(spec)"| S["PageBuildSession"]

  S --> SM["Runtime phase + state card"]
  S --> AC["Managed AgentContext"]
  S --> TS["State-derived tool surface"]
  AC --> PA["Provider Adapter"]
  TS --> PA
  PA --> GW["LLM Gateway"]
  GW --> M["Gemini / OpenAI-compatible model"]

  M -->|"page commands"| S
  S -->|"translated file commands"| FS["FileSession"]
  FS -->|"CAS by revision"| WA["Workspace Adapter"]
  WA --> FS
  FS -->|"event + stopDecision"| S
  S -->|"semantic events"| W
```

The external interface is small, while the Module hides the high-risk behavior. Deleting
`PageBuildSession` would force phase logic, tool gating, recovery, and translation back into every
Page Worker caller; this is the intended depth and locality.

## 4. Runtime state machine

```mermaid
stateDiagram-v2
  [*] --> draft_target
  draft_target --> build: create_target_page succeeds
  build --> repair: verification reports diagnostics
  repair --> build: replacement is clean
  build --> complete: deterministic postconditions pass
  repair --> complete: deterministic postconditions pass
  draft_target --> failed: terminal FileSession policy error
  build --> failed: terminal FileSession policy error
  repair --> failed: terminal FileSession policy error
```

Tool availability is an effect of state, not an instruction the model may ignore:

| Phase / condition | Exposed tools |
|---|---|
| `draft_target` | `create_target_page` only |
| target exists | `create_page_component`, `read_page_file`, `replace_page_file`, `verify_page_files`, optional `generate_image` |
| fresh snapshot required | `read_page_file` only |
| `complete` / `failed` | none |

The target command intentionally has no `path` argument. `PageBuildSession` binds it to the
orchestrator-provided route, eliminating wrong-route and missing-path first writes.

## 5. File mutation protocol

Page v2 does not ask the model to calculate UTF-16 patch coordinates. A revision flow is used:

1. `read_page_file(path)` returns canonical content and `sha256` revision.
2. The model produces complete replacement content.
3. `replace_page_file(path, baseRevision, content)` performs compare-and-swap.
4. Formatting and scoped diagnostics produce a new canonical revision.
5. A stale revision narrows the next tool surface to `read_page_file`.

`FileSession` still supports patch commands for other profiles, but Page v2 uses full-file
replacement because generated page files are bounded and provider-generated text coordinates were
the source of `Debug Failure. False expression.` failures. The revision check preserves concurrent
write safety without making the model reproduce editor internals.

## 6. Provider protocol

`ProviderAdapter` is the only Module allowed to translate internal chat state into a wire payload.
For Gemini-compatible models it:

- turns late internal system continuations into user turns;
- normalizes assistant tool-call arguments and tool results to strings;
- changes coordinate schema fields from `number` to `integer`;
- omits unsupported `tool_choice`, `parallel_tool_calls`, and `thinking_level` fields;
- validates message termination and tool-call/result structure before network I/O.

For OpenAI-compatible models it preserves supported controls. The gateway no longer silently adds
`tool_choice: auto`; omission is a deliberate provider decision. Langfuse records provider,
tool-schema hash, effective controls, final role, and payload bytes so an `INVALID_ARGUMENT` can be
diagnosed against the actual wire contract.

## 7. Context architecture

Page v2 always uses managed `AgentContext`; it does not depend on rollout flags. The canonical event
log remains lossless, while each model request is a deterministic projection.

Retention rules:

| Information | Canonical log | Model projection |
|---|---|---|
| current Page state card | retained | pinned |
| latest required snapshot/revision | retained | pinned while needed |
| successful source mutation body | retained in canonical event history | replaced by path/revision receipt |
| oversized failed mutation body | retained in canonical event history | omitted; error, target, and recovery action retained |
| resolved diagnostics | retained | collapsed to a typed receipt |
| stale reads/search output | retained | dropped when superseded |
| tool-call/result pair | retained atomically | retained or compacted atomically |

Completion budget is reserved before input projection. When deterministic compaction cannot make
the context fit, the loop fails before sending a provider request instead of issuing
`max_tokens=1`. Length recovery adds a bounded continuation and requests one small legal action.

## 8. Failure-domain separation

| Failure domain | Owner | Examples | Recovery |
|---|---|---|---|
| orchestration | `PageBuildSession` | illegal first action, empty stop, iteration pressure | narrow tools, state-card user continuation, bounded retry |
| workspace transaction | `FileSession` | duplicate create, stale revision, ownership, mutation limit | typed event and deterministic transition |
| local I/O / diagnostics | workspace Adapter | missing file, formatter failure, TypeScript diagnostics | scoped error; no provider compatibility claim |
| context budget | `AgentContext` | oversized tool history, unresolved diagnostic state | deterministic projection or typed exhaustion |
| provider wire protocol | `ProviderAdapter` | late system role, unsupported field, schema mismatch | normalize/omit before network; reject invalid local payload |
| provider capability | model gateway | explicit function-calling unsupported response | fail as capability mismatch only with explicit evidence |

A generic provider `INVALID_ARGUMENT` is no longer relabeled as “model lacks tool support.” This is
important because compatibility, malformed history, schema rejection, and context exhaustion have
different owners and different remediations.

## 9. Old versus current architecture

| Concern | Previous | Current |
|---|---|---|
| first action | prompt says what to do | runtime exposes only `create_target_page` |
| target ownership | model supplies path | runtime binds target path |
| orchestration state | split across prompt/callbacks | one PageBuildSession state machine |
| edit protocol | model-generated text ranges | full-file replacement with revision CAS |
| completion | callbacks and model stopping intertwined | `FileSession.stopDecision()` is authoritative |
| context mode | rollout/legacy dependent | managed AgentContext for every Page session |
| failed write history | large rejected source may recur | body omitted from projection; typed failure stays visible |
| provider payload | generic gateway inference | provider-specific projection and validation |
| 400 classification | often reported as no tool support | protocol, arguments, and capability separated |
| observability | model/error text | provider + schema hash + effective wire controls + payload size |
| parallel pages | shared low-level behavior easy to mix | independent session and disjoint path ownership per page |
| UI file event | depended on model-supplied path | runtime-bound target path projected semantically |

## 10. Improvements

1. **Correctness is executable.** First-round order, ownership, revision freshness, mutation limits,
   and completion are runtime invariants rather than prompt compliance.
2. **The Page Worker is shallower as a caller and the Module is deeper.** One call replaces direct
   ownership of the LLM loop, dynamic tools, file translation, recovery, and stop logic.
3. **Provider differences are local.** Gemini quirks no longer leak into the Page Worker or generic
   context logic.
4. **Compaction is semantic.** It preserves unresolved state and protocol units while removing
   source payloads that are reproducible from the workspace.
5. **Retries are bounded and classified.** Empty stops, stale revisions, context pressure, and
   provider rejection no longer share one generic retry path.
6. **Parallelism is safer.** Each page owns a disjoint namespace and every replacement names an
   exact revision.
7. **Failures are diagnosable.** Langfuse can distinguish bad history, bad schema, optional request
   controls, context pressure, and explicit tool-capability rejection.

## 11. Technical route

### Route A — provider seam

- Project internal chat state through `ProviderAdapter`.
- Validate the final wire payload before request.
- Keep effective provider controls and schema fingerprint in tracing.

### Route B — Page orchestration seam

- Route all Page tool loops through `runPageBuildSession`.
- Derive tools and recovery messages from the runtime phase.
- Bind target path server-side and allow at most one source mutation per assistant response.

### Route C — workspace transaction seam

- Translate Page commands into `FileSession` commands.
- Use create-once semantics for new files.
- Use read + revision-safe full replacement for Page repairs.
- Keep deterministic completion and ownership in FileSession.

### Route D — context projection seam

- Force managed AgentContext for Page sessions.
- Keep source payloads in canonical history and omit reproducible/resolved bodies at projection time.
- Preserve current state, unresolved diagnostics, revisions, and protocol atomicity.

### Route E — rollout and observability

- Run focused contract tests at ProviderAdapter, PageBuildSession, FileSession, and AgentContext
  interfaces.
- Compare provider `INVALID_ARGUMENT`, empty-stop recovery, context-exhaustion, duplicate-create,
  stale-revision, and page-completion rates before and after rollout.
- Roll back Page v2 at the worker-to-session seam if production metrics regress; FileSession and
  ProviderAdapter remain independently usable.

## 12. Acceptance and production metrics

- first successful Page mutation targets the required `page.tsx`: **100%**;
- pre-target image/component calls executed: **0**;
- duplicate successful creates per path: **0**;
- silent concurrent overwrite: **0**;
- Page requests sent with a late Gemini system role: **0**;
- Page requests sent with Gemini-unsupported optional controls: **0**;
- failed mutation source bytes reintroduced into normal projection: **0**;
- context failures that reach the provider with `max_tokens < 1024`: **0**;
- completion accepted without a valid target/default export/clean diagnostics: **0**.

## 13. Follow-on scope

Modify and Repair may adopt the same FileSession and ProviderAdapter seams, but their workflow state
must remain profile-specific. Page v2 does not introduce free-form subagent spawning, shared mutable
page ownership, or a second completion signal.
