# Open-OX resume evidence

## Positioning

- Open-OX turns a natural-language brief into a runnable, editable, verifiable and deployable Next.js project, rather than a screenshot or isolated code snippet. Source: `README.md:50-79`, `docs/architecture.md:6-16`.
- The current implementation is based on Next.js 16, React 19 and TypeScript, with Supabase, E2B, Langfuse and Vercel integrations. Source: `package.json`, `README.md:210-221`.

## Resume-worthy engineering facts

- The generation path is decomposed into intent, design intent, planning, design system, scaffold, page implementation, dependency installation and build/repair stages. Source: `README.md:68-79`, `docs/architecture.md:111-133`.
- Page implementation supports multiple parallel agents; the architecture document records up to 7+ parallel agents and an approximately 90-second end-to-end target. These should only be presented as production results after confirming real measurement conditions. Source: `docs/architecture.md:18-27`.
- Build verification is a product gate, with up to five incremental repair rounds in code. Source: `ai/flows/generate_project/runGenerateProject.ts:586-646`.
- Studio streams pipeline topology, logs and agent steps, and exposes project source through Monaco. Source: `README.md:102-107`, `app/[locale]/studio/components/ProjectCodePanel.tsx:35`, `app/[locale]/studio/components/ProjectCodePanel.tsx:625-635`.
- Design Mode maps preview elements to source coordinates and applies verified JSX AST changes, with a Modify-agent fallback. Source: `README.md:102-107`, `docs/adr/0001-design-mode-source-coordinate-direct-apply.md`.
- Preview supports three runtimes: Storage static export, per-project local `next dev`, and isolated E2B sandboxes. Source: `README.md:118-126`.
- Generated projects can be exported and deployed to the user's own Vercel account. Source: `README.md:148-157`.
- Langfuse provides trace/cost observability, while Studio SSE exposes live execution state. Source: `README.md:177-221`, `lib/observability/langfuseTracing.ts`.

## Claims to retire or qualify

- `React-Flow`: it is not a current dependency. The present Studio graph is implemented with project components such as `GenerationAtlas`, `PannableCanvas`, `StageColumn`, and `StepNode`.
- `Dify Workflow`: no current implementation evidence was found; the project now owns its orchestration under `ai/flows/generate_project` and `ai/flows/modify_project`.
- `RAG + vector database`: no current dependency or primary implementation evidence was found. Do not use this as a headline unless describing a historical, separately verified phase.

## Metrics to collect before final resume submission

- Generation success rate and change over time.
- P50/P95 generation duration, not only an architecture target.
- Build auto-repair recovery rate and average repair rounds.
- Modify success rate or average number of turns to accepted result.
- Preview startup/rebuild time and improvement from the preview architecture.
- Team size, delivery cadence, user/project volume and production availability.
