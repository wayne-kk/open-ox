# Open-OX

**Open-OX** is an AI-native website production engine: from one natural-language prompt to a runnable, verifiable, editable Next.js project.

Unlike demo generators that output snippets, Open-OX ships a complete delivery pipeline:

- requirement analysis and planning,
- design-system synthesis,
- per-page **page implement agents** (tool loop) after a single **architect** pass,
- build verification with auto-repair,
- preview via **static export to Storage + `/site-previews` proxy** (default in local dev when Storage env is configured), optional **per-site `next dev`**, or **E2B** sandboxes,
- iterative modification via conversational agent loops.

## Why Open-OX

- **Production-oriented output**: generates real project files, not screenshots or pseudo-code.
- **Transparent pipeline**: every stage is streamed and traceable in the studio UI.
- **Modification-first workflow**: users keep iterating with natural language after initial generation.
- **Preview reliability**: static export previews avoid long-lived dev servers; optional E2B when `OPEN_OX_PREVIEW_BACKEND=e2b`.

## Core Capabilities

- **Prompt-to-project generation**
  - Structured blueprint extraction from user intent.
  - Design system generation and token application.
  - Parallel section generation with guardrails and skills.
- **Build quality gates**
  - Automatic dependency detection and installation.
  - Build verification and targeted repair loops.
- **Agentic modification flow**
  - Tool-using edit agent (read/search/edit/build).
  - Structured diff tracking and modification history.
  - Multi-turn context with controllable memory boundaries.
- **Cloud preview lifecycle**
  - E2B sandbox create/reconnect/rebuild flows.
  - Static export + serve pipeline for deterministic preview URLs.

## High-Level Architecture

```text
Browser (Studio UI)
   -> Next.js API Routes (SSE orchestration)
      -> AI Flows (generate_project / modify_project)
      -> Supabase (project registry + Storage: `project-files` + `site-previews`)
      -> Preview runtime: `/site-previews` proxy (storage) | local `next dev` | E2B sandboxes
```

Important directories:

- `ai/flows/generate_project`: end-to-end generation pipeline
- `ai/flows/modify_project`: iterative agent-based modification pipeline
- `app/studio`: build studio UI (topology, trace, modify conversation)
- `lib/devServerManager.ts` + `lib/staticSitePreview.ts` + `lib/previewMode.ts`: preview backend selection (local / storage / e2b)
- `sites/`: per-project generated code workspaces

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/radix ecosystem
- **Data**: Supabase (Postgres + Storage)
- **Preview runtime**: Supabase bucket `site-previews` + in-app proxy (default in dev when Storage env is set), or `OPEN_OX_PREVIEW_BACKEND=local` / `e2b`
- **LLM access**: OpenAI-compatible API interfaces

## Quick Start

### 1) Install

```bash
pnpm install
```

### 2) Configure environment

Create `.env.local` (minimum required keys depend on your enabled features):

```bash
# LLM
OPENAI_API_KEY=...
OPENAI_BASE_URL=...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# E2B preview (optional; set OPEN_OX_PREVIEW_BACKEND=e2b)
E2B_API_KEY=...

# Static preview: public URLs via Supabase Storage (no E2B). Apply migration `020_site_previews_bucket.sql`.
# OPEN_OX_PREVIEW_BACKEND=storage

# BYO Vercel Deploy (optional). Apply migration `029_vercel_deploy.sql`. See ADR-0003.
# VERCEL_CLIENT_ID=...
# VERCEL_CLIENT_SECRET=...
# VERCEL_INTEGRATION_SLUG=...
# VERCEL_TOKEN_ENCRYPTION_KEY=...
```

### 3) Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Development Commands

```bash
pnpm dev        # start app
pnpm build      # production build
pnpm start      # run production server
pnpm lint       # lint codebase
```

## Workflow Overview

1. Create a project prompt in Studio.
2. Generation pipeline runs with streamed step events.
3. Generated project files are validated and stored.
4. Preview: with **`pnpm dev`**, if `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SITE_URL` are set and `OPEN_OX_PREVIEW_BACKEND` is unset, Studio uses **Storage + `/site-previews` proxy** (same as typical prod). Set **`OPEN_OX_PREVIEW_BACKEND=local`** for per-site `next dev` in iframe, **`storage`** to force explicitly, or **`e2b`** for sandboxes.
5. Modify with natural language; inspect diffs and logs.

## Contributing

Issues and pull requests are welcome.

Recommended contribution style:

- keep changes focused and atomic,
- include verification evidence (build/lint/runtime behavior),
- document architectural decisions when changing pipeline behavior.

## Notes

- Open-OX prioritizes **deterministic, verifiable output** over one-shot flashy demos.
- If you are evaluating the system, inspect the generation and modification traces in Studio to see how each result is produced.

