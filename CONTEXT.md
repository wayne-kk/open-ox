# Open-OX

Product glossary for Studio and project surfaces. Implementation details live in ADRs and product docs, not here.

## Design Mode (Studio)

**Source coordinate**:
Compile-time `file:line:col` (+ tag) injected as `data-ox-source`; primary localization key for Direct Apply.

**Direct Apply**:
Sole automatic write path: locate JSX by source coordinate → server AST mutate → verify → HMR.

**Modify handoff**:
Human exit when Direct cannot apply (no source map, dynamic class/text, A-class patch failure): prefill Modify draft; user confirms. Not a second write engine inside Apply.

**`data-ox-id`**:
Legacy semantic anchor; not the localization seam (v0.3).

_See also_: `docs/product/studio-design-mode-source-writeback-architecture.md`, `docs/adr/0001-design-mode-source-coordinate-direct-apply.md`

## Modify Agent

**Modify history turn**:
One completed modify exchange: user instruction, assistant text, touched files, intent category, and whether the assistant is awaiting a follow-up. Shared semantic unit across Studio, the modify request, continuation routing, and prompt memory — not the DB persistence row and not the Studio UI record.
_Avoid_: summary string with embedded `Files:`, session memory blob, modify transcript

_See also_: `ai/flows/modify_project/history/modifyHistoryTurn.ts`

## Workspace & Community

**Workspace**:
The owner-only project list surface where a user manages their own projects (folders included). Default home for creation and editing.
_Avoid_: global gallery, “全部成员” list as the default member surface

**Community**:
The public discovery surface of projects that have Publish Preview enabled. Anyone may browse, including anonymous users.
_Avoid_: treating Community as an authenticated internal member gallery

**Publish Preview**:
Author opt-in that lists the project in Community and allows non-owners to open its static preview. Does not grant Studio or source access.
_Avoid_: Publish (ambiguous with deploy), Public project (implies source/editor access)

**Allow Remix**:
Author opt-in copy license, only valid while Publish Preview is on. Lets signed-in users Remix. Future monetization attaches here, not to Publish Preview.
_Avoid_: bundling this into a single “publish to community” switch

**Remix**:
Creating a new Workspace project owned by the remixer from the source project’s latest site source snapshot (plus display metadata and lineage), excluding secrets and Studio chat. The copy is independent; the original author does not control it.
_Avoid_: fork, clone, “open in Studio” on someone else’s project

**Remix lineage**:
Recorded provenance on a remixed project (`remixed_from` id + author/title snapshots) for attribution after the source is unlisted or deleted.

_See also_: `docs/product/workspace-community-publish-remix-v0.1.md`, `docs/adr/0002-workspace-private-community-publish-remix.md`
