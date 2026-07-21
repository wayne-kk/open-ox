# Research: Product moat and UX priorities for Open-OX vs mainstream AI builders

**Date:** 2026-07-21  
**Status:** Complete  
**Question:** As an AI website/application builder, which Open-OX capability should improve next to raise user experience and strengthen product moat?  
**Method:** First-party sources only for competitors: official docs, official help centers, official changelog/announcement pages, official pricing/docs, or official repositories. Existing Open-OX positioning is taken from this repository.

## Executive Summary

Open-OX already has a distinctive baseline: it produces a real Next.js project on disk, exposes a Studio trace, supports Modify, Design Mode Direct Apply, Community/Remix, BYO Vercel deploy, and credit metering. That baseline is explicit in [README.md](../../README.md), [CONTEXT.md](../../CONTEXT.md), [ADR-0001](../adr/0001-design-mode-source-coordinate-direct-apply.md), [ADR-0002](../adr/0002-workspace-private-community-publish-remix.md), [ADR-0003](../adr/0003-vercel-byo-deploy.md), and the current product docs.

The strongest competitor pattern is **not** "make the first prompt bigger." Mainstream builders are converging on a loop:

1. **Plan before code:** Lovable Plan Mode, Bolt Plan Mode, Replit Plan Mode, Base44 Discuss Mode, and Cursor Plan Mode all give users a safe planning surface before edits happen. Sources: [Lovable Plan Mode](https://docs.lovable.dev/features/plan-mode), [Bolt Plan Mode](https://support.bolt.new/best-practices/discussion-mode), [Replit Plan Mode](https://docs.replit.com/features/agent/plan-mode), [Base44 AI chat modes](https://docs.base44.com/Building-your-app/AI-chat-modes), [Cursor Plan Mode](https://cursor.com/docs/agent/plan-mode).
2. **Point at the live product:** v0, Lovable, Base44, and Replit all make visual selection, direct editing, annotation, canvas exploration, or apply-back part of the core edit loop. Sources: [v0 Design Mode](https://v0.app/docs/design-mode), [Lovable Preview Toolbar](https://docs.lovable.dev/features/preview-toolbar), [Base44 Edit Mode](https://docs.base44.com/Building-your-app/AI-chat-modes), [Replit Canvas](https://docs.replit.com/learn/design/canvas).
3. **Persist taste and constraints:** Lovable, v0, Bolt, Replit, Cursor, and Base44 all expose durable instructions, knowledge, rules, or design-system adapters. Sources: [Lovable Knowledge](https://docs.lovable.dev/features/knowledge), [Lovable Design Systems](https://docs.lovable.dev/features/design-systems), [v0 Design Systems 2.0](https://v0.app/docs/design-systems-2), [Bolt Design Systems](https://support.bolt.new/building/design-system/introduction), [Replit replit.md](https://docs.replit.com/features/project-setup/replit-dot-md), [Cursor Rules](https://cursor.com/docs/rules), [Base44 AI Controls](https://docs.base44.com/Building-your-app/AI-chat-modes).
4. **Make agent work controllable and priced:** Lovable and Base44 expose prompt queues; Replit exposes agent modes, testing, high effort, and cost tradeoffs; Base44 shows per-message credits; Bolt exposes Standard/Max agents. Sources: [Lovable Build Mode](https://docs.lovable.dev/features/agent-mode), [Base44 queue and credits](https://docs.base44.com/Building-your-app/AI-chat-modes), [Replit Agent Modes](https://docs.replit.com/features/agent/agent-modes), [Base44 Credits](https://docs.base44.com/Account-and-billing/Credits), [Bolt Agents](https://support.bolt.new/building/using-bolt/agents).
5. **Verify beyond build success:** v0 browser use, Replit App Testing, Lovable verification, and Lovable SEO/AEO positioning all point toward productized quality gates beyond compile success. Sources: [v0 Agentic Features](https://v0.app/docs/agentic-features), [Replit App Testing](https://docs.replit.com/features/agent/app-testing), [Lovable Build Mode](https://docs.lovable.dev/features/agent-mode), [Lovable SEO/AEO](https://docs.lovable.dev/features/seo-aeo).

**Recommendation:** Open-OX should treat the next stage as a **Studio moat stage**: turn Studio from a transparent trace viewer plus edit entrypoint into the user's command surface for planning, visual editing, persistent project knowledge, verification, cost, and release confidence. The most valuable single capability family is **"trustworthy iteration in Studio"**: Plan/Blueprint before generation, precise Design Mode after generation, quality gates before publish/deploy, and memory/knowledge across turns.

This is also the strongest moat because it compounds around Open-OX's existing differentiators: real Next.js source, source-coordinate Direct Apply, build/repair gates, traceable agents, BYO deploy, and Community Remix.

## Open-OX Baseline From Repository Docs

| Area | Current positioning / decision | Internal source |
|---|---|---|
| Real artifact | Prompt to runnable, verifiable, editable, deployable Next.js project, not a screenshot or locked sandbox | [README.md](../../README.md) |
| Studio | Streaming topology, logs, agent steps, Modify, Design Mode, preview surfaces | [README.md](../../README.md), [Studio visual PRD](../product/studio-visual-experience-v0.1-prd.md) |
| Design Mode | Source-coordinate `data-ox-source` localization, server JSX AST mutation, verify, HMR; Modify is a human-confirmed exit for unsupported patches | [CONTEXT.md](../../CONTEXT.md), [Design Mode architecture](../product/studio-design-mode-source-writeback-architecture.md), [ADR-0001](../adr/0001-design-mode-source-coordinate-direct-apply.md) |
| Modify memory | Deterministic working-memory projection from recent modify turns, avoiding transcript noise | [Modify Working Memory](../product/modify-working-memory-v0.1.md) |
| Generate pipeline | Chrome-first architecture: scaffold true shell before page agents fill content | [Chrome-first architecture](../product/chrome-first-generate-pipeline-architecture.md), [ADR-0005](../adr/0005-chrome-first-generate-pipeline.md) |
| Pre-generation outline | Editable low-fidelity SiteOutline before expensive generation | [Generate blueprint preview PRD](../product/generate-blueprint-preview-v0.1-prd.md) |
| Community / Remix | Workspace-private by default; Publish Preview and Allow Remix are separate axes | [Workspace / Community PRD](../product/workspace-community-publish-remix-v0.1.md), [ADR-0002](../adr/0002-workspace-private-community-publish-remix.md) |
| Deploy | BYO Vercel OAuth, static artifact deploy, publish preview separate from production deploy | [ADR-0003](../adr/0003-vercel-byo-deploy.md) |
| Credits | One-time 12-credit welcome pack; generate/modify metered; Design Mode local, Remix, Publish free | [Credits v0.3](../product/credits-v0.3-welcome.md), [CONTEXT.md](../../CONTEXT.md) |

Existing related research already points in the same direction: [AI builder UX features](./ai-builder-competitor-ux-features-20260714.md), [generation quality levers](./ai-builder-generation-quality-levers-20260719.md), [fast preview architecture](./ai-builder-fast-preview-architecture-20260717.md), [Lovable visual edits](./lovable-visual-edits-localization-20260709.md), and [credits/pricing](./ai-builder-credits-pricing-20260711.md).

## Product Capability Matrix

Legend: **strong** = first-party docs describe a productized capability; **partial** = present but narrower or not core to the main loop; **unclear** = not enough first-party detail.

| Product | Plan / Discuss before code | Visual edit / point-to-edit | Knowledge / design system | Agent queue / workflow control | Quality verification | Deploy / ownership | Community / template / remix | Cost / model controls |
|---|---|---|---|---|---|---|---|---|
| **Open-OX** | Partial: Intent, Brief, editable SiteOutline planned | Strong foundation: source-coordinate Direct Apply; pending/before-after not yet productized | Partial: style skills and design intent; no user-facing project knowledge/DS adapter | Partial: Modify/BoardRun, effort tier internals; queue UX unclear | Strong build gate; weak productized browser/SEO/a11y gates | Strong: real Next.js export and BYO Vercel | Strong direction: Publish Preview + Allow Remix | Partial: Credits exist; per-turn cost and effort UX can improve |
| **Lovable** | Strong: Plan mode plans before code and does not modify code ([docs](https://docs.lovable.dev/features/plan-mode)) | Strong: preview toolbar supports select, inline text, draw annotation, comments ([docs](https://docs.lovable.dev/features/preview-toolbar)) | Strong: workspace/project knowledge and Enterprise React design systems ([Knowledge](https://docs.lovable.dev/features/knowledge), [Design systems](https://docs.lovable.dev/features/design-systems)) | Strong: visible prompt queue, pause/resume/reorder/edit/repeat ([Build mode](https://docs.lovable.dev/features/agent-mode)) | Stronger than build-only: activity visibility, browser/backend verification tools when used ([Build mode](https://docs.lovable.dev/features/agent-mode)); SEO/AEO review and publish-time security checks are official product surfaces ([SEO/AEO](https://docs.lovable.dev/features/seo-aeo), [Publish](https://docs.lovable.dev/features/publish)) | Platform-hosted publish and custom/branded URLs; not BYO-source-first | Strong: templates/remix/community surfaces in docs and existing Open-OX research | Usage-based build credits; Plan costs one credit; message cost view ([Build mode](https://docs.lovable.dev/features/agent-mode)) |
| **Bolt.new** | Strong: Plan Mode before Build; quick action can implement plan ([docs](https://support.bolt.new/best-practices/discussion-mode)) | Partial: select tool/layer picking exists in release notes; less documented than v0/Lovable ([release notes](https://support.bolt.new/release-notes)) | Strong: real component-library design systems, generated Storybook, project knowledge ([DS intro](https://support.bolt.new/building/design-system/introduction), [Add DS](https://support.bolt.new/building/design-system/add-design-system), [Project settings](https://support.bolt.new/settings/project-settings)) | Partial: Plan/Build and agent selection; no first-party queue doc found in this pass | Partial: troubleshooting/build loop; not as explicit as Replit App Testing | Publishes to live website; broad app stack ([Intro](https://support.bolt.new/get-started/intro-bolt)) | Team templates appear in release notes ([release notes](https://support.bolt.new/release-notes)) | Strong: Standard vs Max agents; token costs explained ([Agents](https://support.bolt.new/building/using-bolt/agents), [Tokens](https://support.bolt.new/account-and-subscription/tokens)) |
| **v0 by Vercel** | Partial: no main Plan Mode doc found; relies on prompt/chat workflow | Strong: visual panel + natural language, pending edits, undo/redo/reset, before/after, Apply to code version ([Design Mode](https://v0.app/docs/design-mode)) | Strong: Design Systems 2.0 as a skill/adapter to real components/tokens/conventions ([docs](https://v0.app/docs/design-systems-2)) | Strong agent autonomy controls through sandbox/web/browser/terminal permissions ([Agentic features](https://v0.app/docs/agentic-features)) | Strong: browser use can open built apps, critique designs, debug flows, fix proactively ([Agentic features](https://v0.app/docs/agentic-features)) | Strong Vercel deployment; GitHub branch/PR workflow ([Quickstart](https://v0.app/docs/quickstart), [GitHub](https://v0.app/docs/github)) | Strong: Projects can publish chat as templates; multiple chats share one Project ([Projects](https://v0.app/docs/projects)) | Pricing/model docs exist; main moat is Vercel integration rather than credits UX |
| **Replit Agent / App** | Strong: Plan Mode asks/questions/plans without changing code or data ([docs](https://docs.replit.com/features/agent/plan-mode)) | Strong: Canvas supports mockups, comparing directions, and apply-back separate from live app ([Canvas](https://docs.replit.com/learn/design/canvas)) | Partial: `replit.md` persists project context and preferences ([docs](https://docs.replit.com/features/project-setup/replit-dot-md)) | Strong: Lite/Economy/Power, App Testing, High effort, Turbo ([Agent Modes](https://docs.replit.com/features/agent/agent-modes)) | Strong: App Testing uses an actual browser and can fix issues automatically ([App Testing](https://docs.replit.com/features/agent/app-testing)) | Strong hosted development/publish platform; not source-export-first | Less central in docs for builder remix | Strong: modes explicitly trade speed, cost, capability; Turbo costs more ([Agent Modes](https://docs.replit.com/features/agent/agent-modes)) |
| **Base44** | Strong: Discuss mode plans safely before app changes ([AI chat modes](https://docs.base44.com/Building-your-app/AI-chat-modes)) | Strong: Edit mode selects preview elements; manual visual edits use no credits; undo/redo and version history ([AI chat modes](https://docs.base44.com/Building-your-app/AI-chat-modes)) | Partial/strong: AI Controls add custom instructions and freeze files; managed backend and integrations are first-class ([AI chat modes](https://docs.base44.com/Building-your-app/AI-chat-modes), [Developer platform](https://docs.base44.com/developers/home)) | Strong: queue up to seven messages; reorder/edit/remove/pause/resume ([AI chat modes](https://docs.base44.com/Building-your-app/AI-chat-modes)) | Partial: automatic background checks/fixes are described; no dedicated browser testing doc found in this pass ([AI chat modes](https://docs.base44.com/Building-your-app/AI-chat-modes)) | Strong platform-hosted full-stack app, managed backend/auth/hosting ([Quick start](https://docs.base44.com/Getting-Started/Quick-start-guide), [Developer platform](https://docs.base44.com/developers/home)) | Sharing exists; not a main official remix moat in reviewed docs | Strong: message/integration credits, per-message Credits Used, model selector ([Credits](https://docs.base44.com/Account-and-billing/Credits), [AI chat modes](https://docs.base44.com/Building-your-app/AI-chat-modes)) |
| **Cursor** | Strong for code workflow: Plan Mode researches codebase, asks clarifying questions, creates reviewable plan ([Cursor Plan Mode](https://cursor.com/docs/agent/plan-mode)) | Weak for builder-style preview editing | Strong: Project/Team/User Rules plus AGENTS.md ([Rules](https://cursor.com/docs/rules)) | Strong: cloud agents, subagents, skills, CLI workflows ([Cloud Agents](https://cursor.com/docs/cloud-agent), [Subagents](https://cursor.com/docs/subagents), [Skills](https://cursor.com/docs/skills)) | Strong for code review/workflow; not app-builder visual QA | Strong in repo/PR workflow, not hosted builder | Not relevant | Strong model/pricing docs; not central to this comparison |

## Reusable Patterns Worth Borrowing

### 1. Approval gates should be cheap, explicit, and editable

Lovable, Bolt, Replit, Base44, and Cursor all separate "think/plan/discuss" from "write/build" in official docs. This pattern lowers anxiety and prevents expensive rework: the user reviews intent before the agent mutates the project. Sources: [Lovable Plan Mode](https://docs.lovable.dev/features/plan-mode), [Bolt Plan Mode](https://support.bolt.new/best-practices/discussion-mode), [Replit Plan Mode](https://docs.replit.com/features/agent/plan-mode), [Base44 Discuss Mode](https://docs.base44.com/Building-your-app/AI-chat-modes), [Cursor Plan Mode](https://cursor.com/docs/agent/plan-mode).

**Open-OX inference:** The existing editable SiteOutline should become part of a broader Studio Plan Mode, not a one-off pre-generation widget. This is an inference from competitor convergence and Open-OX's current [Generate blueprint preview PRD](../product/generate-blueprint-preview-v0.1-prd.md).

### 2. Visual edits are a trust loop, not a side feature

v0 exposes pending design edits, before/after, and a normal diffable version after Apply. Lovable emphasizes selecting, inline text, draw annotations, and comments in the live preview. Base44 makes manual visual edits credit-free and records visual edits in version history. Sources: [v0 Design Mode](https://v0.app/docs/design-mode), [Lovable Preview Toolbar](https://docs.lovable.dev/features/preview-toolbar), [Base44 AI chat modes](https://docs.base44.com/Building-your-app/AI-chat-modes).

**Open-OX inference:** Open-OX's source-coordinate Direct Apply is technically stronger than many visual-edit promises because it writes real TSX through a verified server path. The UX gap is the staging layer: pending edits, before/after, bundled Apply, draw-to-Modify, comments-to-Modify, and visible free micro-edits.

### 3. Design systems and knowledge are compounding assets

v0 Design Systems 2.0 stores a design-system skill that tells the agent which components, props, and tokens are safe. Lovable design systems reuse React components and enforce adherence. Bolt builds from actual components and generates Storybook. Lovable/Bolt knowledge and Replit/Cursor rules persist project or workspace guidance. Sources: [v0 Design Systems 2.0](https://v0.app/docs/design-systems-2), [Lovable Design Systems](https://docs.lovable.dev/features/design-systems), [Bolt Design Systems](https://support.bolt.new/building/design-system/introduction), [Lovable Knowledge](https://docs.lovable.dev/features/knowledge), [Bolt Project Settings](https://support.bolt.new/settings/project-settings), [Replit replit.md](https://docs.replit.com/features/project-setup/replit-dot-md), [Cursor Rules](https://cursor.com/docs/rules).

**Open-OX inference:** Open-OX should move beyond style prompt packs toward user-visible Project Kits: brand facts, tokens, component constraints, content rules, source references, and approved patterns that Generate and Modify both consume.

### 4. Agent autonomy needs operator controls

Lovable and Base44 have visible prompt/message queues with reorder, edit, pause, and resume behavior. Replit exposes mode controls for speed/cost/capability, App Testing, High effort, and Turbo. Bolt exposes Standard vs Max. Sources: [Lovable Build Mode](https://docs.lovable.dev/features/agent-mode), [Base44 AI chat modes](https://docs.base44.com/Building-your-app/AI-chat-modes), [Replit Agent Modes](https://docs.replit.com/features/agent/agent-modes), [Bolt Agents](https://support.bolt.new/building/using-bolt/agents).

**Open-OX inference:** BoardRun and internal effort tiers become more valuable if users can see and steer them as operator controls: queued edits, per-run effort, expected credit range, pause/resume, and why a run is expensive.

### 5. Build success is no longer enough

v0 says its agent can open the app it builds, critique designs, debug flows, and fix proactively. Replit App Testing navigates the app in a real browser and can automatically fix issues. Lovable Build Mode references verification tools including browser testing, frontend tests, and backend checks. Sources: [v0 Agentic Features](https://v0.app/docs/agentic-features), [Replit App Testing](https://docs.replit.com/features/agent/app-testing), [Lovable Build Mode](https://docs.lovable.dev/features/agent-mode).

**Open-OX inference:** Open-OX's current "build passed + previewable deliverable" contract is necessary but not sufficient for the next stage. The moat is turning the real Next.js artifact into measurable launch confidence: route smoke, responsive screenshot checks, accessibility/SEO basics, brief-alignment checks, and deploy readiness.

## Top Capability Recommendations

### P0-A: Studio Visual Command Surface

**What to build:** Upgrade Design Mode into a preview-native command surface:

- Pending edits before writing source: undo, redo, reset, before/after.
- Batch Apply: multiple style/text changes become one Design Mode turn and one visible diff.
- Natural-language note on the selected element in the same Apply payload.
- Draw annotation and pinned comment modes that produce a Modify draft or queued Modify request.
- Clear "free local edit" messaging for Direct Apply changes, aligned with existing Credits rules.

| Dimension | Assessment |
|---|---|
| UX value | Very high. Users stop treating Modify as a long prompt box and can repair visible issues where they see them. v0, Lovable, and Base44 all make preview-native edits central: [v0 Design Mode](https://v0.app/docs/design-mode), [Lovable Preview Toolbar](https://docs.lovable.dev/features/preview-toolbar), [Base44 Edit Mode](https://docs.base44.com/Building-your-app/AI-chat-modes). |
| Moat value | Very high. Open-OX can combine competitor-grade UX with its own source-coordinate Direct Apply, verified AST mutation, and real Next.js files: [Open-OX Design Mode architecture](../product/studio-design-mode-source-writeback-architecture.md). |
| Implementation difficulty | Medium. The localization/apply path exists; the main work is UI state, pending patch model, version/diff grouping, draw/comment payloads, and Modify draft queueing. |
| Key risk | If Draw and natural-language selected edits bypass Direct Apply too freely, Design Mode can become another opaque Modify wrapper. Keep Direct Apply deterministic for supported edits; route spatial/structural edits to explicit Modify confirmation. |
| Priority | **P0, first.** This is the most direct bridge from current Open-OX architecture to visible user delight. |

### P0-B: Plan + Blueprint + Visual Direction Gate

**What to build:** Merge the existing editable SiteOutline direction into a broader Plan Mode for new generation and wide Modify:

- Chat mode toggle: Plan vs Build/Generate.
- Plan can inspect current project, ask questions, and produce a reviewable plan without writing files.
- For new sites: visual direction choice + low-fidelity SiteOutline + optional tagged reference-image analysis before expensive generation.
- For Modify: plan cards or task list before a wide change; user approves which cards run.

| Dimension | Assessment |
|---|---|
| UX value | Very high. It reduces "expensive roulette" and lets users shape structure before credits are burned. This is now mainstream across Lovable, Bolt, Replit, Base44, and Cursor: [Lovable Plan](https://docs.lovable.dev/features/plan-mode), [Bolt Plan](https://support.bolt.new/best-practices/discussion-mode), [Replit Plan](https://docs.replit.com/features/agent/plan-mode), [Base44 Discuss](https://docs.base44.com/Building-your-app/AI-chat-modes), [Cursor Plan](https://cursor.com/docs/agent/plan-mode). |
| Moat value | High. Open-OX can make the plan executable because the pipeline already has structured intent, `confirmedSiteOutline`, chrome-first ownership, and traceable steps: [Blueprint PRD](../product/generate-blueprint-preview-v0.1-prd.md), [Chrome-first architecture](../product/chrome-first-generate-pipeline-architecture.md). |
| Implementation difficulty | Medium. The product needs one coherent Plan surface rather than separate prompt conventions, brief prose, and SiteOutline widgets. |
| Key risk | Too many approval gates can slow simple prompts. Default should be adaptive: show gates for ambiguous, expensive, visual, multi-page, or wide Modify tasks; allow "build directly" when the user is precise. |
| Priority | **P0, second.** It raises first-result quality and credit trust before more generation complexity is added. |

### P1-A: Project Kit / Workspace Knowledge / Design-System Adapter

**What to build:** A user-visible Project Kit that both Generate and Modify consume:

- Brand voice, colors, typography, asset references, prohibited patterns, product facts, target audience.
- Component and token rules where available.
- Optional imported sources: URL, docs, Storybook, npm package, GitHub repo, screenshots.
- Always-on project knowledge vs on-demand workflow skills, clearly separated.
- Studio panel to inspect, edit, and reset what the agent "knows."

| Dimension | Assessment |
|---|---|
| UX value | High. Users stop repeating brand and domain preferences. It also makes remix/template starts more reliable. |
| Moat value | Very high over time. Knowledge, kits, and design-system adapters are compounding assets tied to workspaces and community remixes. Competitor evidence: [Lovable Knowledge](https://docs.lovable.dev/features/knowledge), [Lovable Design Systems](https://docs.lovable.dev/features/design-systems), [v0 Design Systems 2.0](https://v0.app/docs/design-systems-2), [Bolt Design Systems](https://support.bolt.new/building/design-system/introduction), [Bolt Add Design System](https://support.bolt.new/building/design-system/add-design-system), [Replit replit.md](https://docs.replit.com/features/project-setup/replit-dot-md), [Cursor Rules](https://cursor.com/docs/rules), [Base44 AI Controls](https://docs.base44.com/Building-your-app/AI-chat-modes). |
| Implementation difficulty | Medium to high. A text-only v0 can ship quickly; true DS adapters require source ingestion, component cataloging, and adherence checks. |
| Key risk | Hidden memory erodes trust. Keep it inspectable and editable; avoid silent preference inference as the only source of truth. |
| Priority | **P1, start as lightweight Project Knowledge in 30-60 days; deepen into DS adapter in 60-90 days.** |

### P1-B: Quality and Launch Assurance Loop

**What to build:** Add a visible quality gate after generation/Modify and before Publish/Deploy:

- Route smoke: home and key routes open without runtime errors.
- Responsive screenshots: desktop/mobile basic visual sanity.
- Brief-alignment check: required sections/content facts present.
- SEO/AEO basics: title, meta description, OG image, sitemap/robots where applicable, semantic headings.
- Accessibility basics: alt text, contrast warnings, keyboard traps where detectable.
- Deploy readiness: static export sanity and BYO Vercel status.
- Optional "send findings to Modify" action.

| Dimension | Assessment |
|---|---|
| UX value | High. Users care whether the site is shippable, not merely compiled. |
| Moat value | High. Open-OX's real Next.js artifact makes deterministic testing, screenshots, static export checks, and deploy checks credible. Competitor evidence: [v0 browser use](https://v0.app/docs/agentic-features), [Replit App Testing](https://docs.replit.com/features/agent/app-testing), [Lovable verification in Build Mode](https://docs.lovable.dev/features/agent-mode). |
| Implementation difficulty | Medium. Start with Playwright smoke, screenshot capture, HTML/metadata checks, and LLM-assisted brief alignment only after deterministic checks. |
| Key risk | A broad "quality score" can become vague. Keep gates explainable, linked to findings, and actionable. |
| Priority | **P1.** Pair with BYO Deploy and Publish Preview so launch feels intentional. |

### P2: Operator Controls for Agent Work, Cost, and Versions

**What to build:** Give users explicit controls over long-running work:

- Visible Modify/prompt queue with reorder, edit, pause, resume, clear.
- Effort selector: Fast / Balanced / Deep with estimated credit and quality tradeoff.
- Per-turn credits after completion and pre-run estimate bands for large work.
- GitHub export/sync roadmap: branch-per-change or PR-per-release, inspired by v0, while preserving BYO ownership.
- Later: multiple chats per project or topic branches after core ownership semantics are stable.

| Dimension | Assessment |
|---|---|
| UX value | Medium to high. Users feel in control during long agent work and understand cost. |
| Moat value | Medium now, high later if tied to trace, diffs, credits, and Git. Competitor evidence: [Lovable queue](https://docs.lovable.dev/features/agent-mode), [Base44 queue](https://docs.base44.com/Building-your-app/AI-chat-modes), [Replit modes/cost controls](https://docs.replit.com/features/agent/agent-modes), [Bolt agents](https://support.bolt.new/building/using-bolt/agents), [Base44 per-message credits](https://docs.base44.com/Account-and-billing/Credits), [v0 GitHub branches/PRs](https://v0.app/docs/github). |
| Implementation difficulty | Medium for queue/cost visibility; high for robust Git branch/PR workflow. |
| Key risk | Surfacing too many knobs can intimidate non-technical users. Defaults should stay simple; advanced controls should appear when runs are expensive, queued, or risky. |
| Priority | **P2, but ship small slices earlier where cheap:** per-turn credits and visible queue are high-trust, low-concept features. |

## Recommended Priority

| Rank | Capability | Why this order |
|---:|---|---|
| 1 | **Studio Visual Command Surface** | It converts Open-OX's current technical edge, source-coordinate Direct Apply, into a user-visible advantage immediately. |
| 2 | **Plan + Blueprint + Visual Direction Gate** | It improves first-result accuracy and credit confidence before expensive generation. |
| 3 | **Project Kit / Knowledge** | It compounds quality and brand consistency across Generate, Modify, Remix, and templates. |
| 4 | **Quality / Launch Assurance** | It moves Open-OX from "build passed" to "ready to publish/deploy," which fits the real Next.js promise. |
| 5 | **Operator Controls / Cost / Git Workflow** | It improves trust and team workflow, but should not distract from the core Studio loop. |

## 30 / 60 / 90 Day Roadmap

### First 30 days: make Studio edits feel trustworthy

- Ship Design Mode pending-edit state for text/color/type/spacing/radius before Direct Apply.
- Add before/after toggle and one-turn batch Apply.
- Show Design Mode Direct Apply as free local edit in the UI, matching current Credits rules.
- Add a simple selected-element natural-language note that generates a Modify draft when Direct Apply cannot handle it.
- Add per-turn credit display for Generate/Modify after completion.
- Make Plan/Build mode toggle visible behind a feature flag, initially reusing existing Intent and SiteOutline artifacts.

Success signals:

- Design Mode apply success rate stays at or above current baseline.
- More edits happen through Design Mode and fewer through long freeform Modify prompts.
- Users can explain what will be charged and what will not.

### Days 31-60: reduce expensive misses before generation

- Turn SiteOutline into an explicit Plan artifact for new generation.
- Add adaptive Plan gating for ambiguous/wide prompts and wide Modify.
- Add tagged visual reference analysis to generation, matching the current Studio visual PRD direction.
- Add a visible Modify queue with reorder/edit/remove/pause/resume for queued requests.
- Add first version of Project Knowledge: plain-text brand, product facts, style constraints, and forbidden changes.
- Add deterministic launch checks: route smoke, mobile/desktop screenshot capture, metadata presence.

Success signals:

- Fewer first-generation retries due to wrong section structure.
- Fewer "forgot my brand/style" Modify complaints.
- Launch checks catch issues before Publish Preview or BYO Deploy.

### Days 61-90: turn artifacts into moat

- Promote Project Knowledge into Project Kit: tokens, assets, audience, brand voice, content facts, and source references.
- Add community/template metadata: original brief, design notes, suggested remix instructions, and source lineage.
- Add Design Mode draw annotation and pinned comment to Modify draft or queue.
- Add quality gate findings that can be sent directly to Modify.
- Add effort selector with estimated credit bands for Generate and wide Modify.
- Scope GitHub branch/PR integration as an ADR or PRD: branch-per-release, not a rushed default.

Success signals:

- Remixed projects inherit useful design/product context rather than only source files.
- Quality gate findings convert into successful Modify runs.
- Users choose effort/cost levels intentionally instead of being surprised after a run.

## What Not To Copy Blindly

| Do not copy | Reason |
|---|---|
| A full no-code canvas as the source of truth | Open-OX's moat is a real Next.js project; canvas can guide or preview, not replace source. |
| Platform-locked hosting as the only success path | Open-OX deliberately chose BYO Vercel and exportable source. Keep that ownership promise. |
| Hidden memory without an edit surface | Competitors expose knowledge/rules/controls. Invisible preference inference would weaken trust. |
| A pure model selector as the main solution | Model choice helps power users, but mainstream docs pair it with Plan, DS, visual edit, testing, and cost controls. |
| More private prompt recipes as the main quality lever | Competitor evidence favors visible choice, real components/tokens, and HITL correction over longer hidden prompts. |

## Source Appendix

### Open-OX internal

- [README.md](../../README.md)
- [CONTEXT.md](../../CONTEXT.md)
- [Studio visual PRD](../product/studio-visual-experience-v0.1-prd.md)
- [Studio Design Mode architecture](../product/studio-design-mode-source-writeback-architecture.md)
- [Modify Working Memory](../product/modify-working-memory-v0.1.md)
- [Workspace / Community / Publish / Remix PRD](../product/workspace-community-publish-remix-v0.1.md)
- [Generate blueprint preview PRD](../product/generate-blueprint-preview-v0.1-prd.md)
- [Chrome-first generate pipeline](../product/chrome-first-generate-pipeline-architecture.md)
- [Credits v0.3](../product/credits-v0.3-welcome.md)
- [ADR-0001 Design Mode source-coordinate Direct Apply](../adr/0001-design-mode-source-coordinate-direct-apply.md)
- [ADR-0002 Workspace / Community / Remix](../adr/0002-workspace-private-community-publish-remix.md)
- [ADR-0003 BYO Vercel deploy](../adr/0003-vercel-byo-deploy.md)
- [ADR-0005 Chrome-first generate pipeline](../adr/0005-chrome-first-generate-pipeline.md)

### Lovable

- [Plan Mode](https://docs.lovable.dev/features/plan-mode)
- [Build Mode](https://docs.lovable.dev/features/agent-mode)
- [Preview Toolbar](https://docs.lovable.dev/features/preview-toolbar)
- [Knowledge](https://docs.lovable.dev/features/knowledge)
- [Design Systems](https://docs.lovable.dev/features/design-systems)
- [Design Guidance](https://docs.lovable.dev/features/design-guidance)
- [SEO and AEO](https://docs.lovable.dev/features/seo-aeo)
- [Publish](https://docs.lovable.dev/features/publish)
- [Changelog](https://docs.lovable.dev/changelog)

### Bolt.new

- [Intro to Bolt](https://support.bolt.new/get-started/intro-bolt)
- [Plan Mode](https://support.bolt.new/best-practices/discussion-mode)
- [Agents](https://support.bolt.new/building/using-bolt/agents)
- [Tokens](https://support.bolt.new/account-and-subscription/tokens)
- [Project Settings / Knowledge](https://support.bolt.new/settings/project-settings)
- [Design Systems intro](https://support.bolt.new/building/design-system/introduction)
- [Add Design System](https://support.bolt.new/building/design-system/add-design-system)
- [Release Notes](https://support.bolt.new/release-notes)

### v0 / Vercel

- [v0 Docs](https://v0.app/docs/)
- [Quickstart](https://v0.app/docs/quickstart)
- [Design Mode](https://v0.app/docs/design-mode)
- [Design Systems 2.0](https://v0.app/docs/design-systems-2)
- [Agentic Features](https://v0.app/docs/agentic-features)
- [Projects](https://v0.app/docs/projects)
- [GitHub](https://v0.app/docs/github)

### Replit

- [Agent overview](https://docs.replit.com/features/agent/overview)
- [Plan Mode](https://docs.replit.com/features/agent/plan-mode)
- [Agent Modes](https://docs.replit.com/features/agent/agent-modes)
- [App Testing](https://docs.replit.com/features/agent/app-testing)
- [Canvas](https://docs.replit.com/learn/design/canvas)
- [replit.md](https://docs.replit.com/features/project-setup/replit-dot-md)

### Base44

- [Base44 Docs](https://docs.base44.com/)
- [Quick start guide](https://docs.base44.com/Getting-Started/Quick-start-guide)
- [AI chat modes](https://docs.base44.com/Building-your-app/AI-chat-modes)
- [Credits](https://docs.base44.com/Account-and-billing/Credits)
- [Developer Platform](https://docs.base44.com/developers/home)
- [Pricing](https://base44.com/pricing)

### Cursor

- [Cursor Docs](https://cursor.com/docs)
- [Plan Mode](https://cursor.com/docs/agent/plan-mode)
- [Rules](https://cursor.com/docs/rules)
- [Cloud Agents](https://cursor.com/docs/cloud-agent)
- [Subagents](https://cursor.com/docs/subagents)
- [Agent Skills](https://cursor.com/docs/skills)

### Optional additional reference: Windsurf

- [Cascade overview](https://docs.windsurf.com/windsurf/cascade/cascade)
- [Cascade modes / Plan Mode](https://docs.windsurf.com/windsurf/cascade/modes)
- [AGENTS.md](https://docs.windsurf.com/windsurf/cascade/agents-md)
- [Skills](https://docs.windsurf.com/windsurf/cascade/skills)
