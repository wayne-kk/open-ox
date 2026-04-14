# Open-OX

**Open-OX** is an AI-native website production engine: from one natural-language prompt to a runnable, verifiable, editable Next.js project.

Unlike demo generators that output snippets, Open-OX ships a complete delivery pipeline:

- requirement analysis and planning,
- design-system synthesis,
- section-level parallel code generation,
- build verification with auto-repair,
- cloud preview in isolated E2B sandboxes,
- iterative modification via conversational agent loops.

## Why Open-OX

- **Production-oriented output**: generates real project files, not screenshots or pseudo-code.
- **Transparent pipeline**: every stage is streamed and traceable in the studio UI.
- **Modification-first workflow**: users keep iterating with natural language after initial generation.
- **Preview reliability**: each project runs in isolated sandbox infrastructure for reproducible previews.

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
      -> Supabase (project registry + storage)
      -> E2B Sandboxes (build + preview runtime)
```

Important directories:

- `ai/flows/generate_project`: end-to-end generation pipeline
- `ai/flows/modify_project`: iterative agent-based modification pipeline
- `app/studio`: build studio UI (topology, trace, modify conversation)
- `lib/devServerManager.ts`: E2B preview orchestration
- `sites/`: per-project generated code workspaces

## Tech Stack

- **Framework**: Next.js (App Router), React, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/radix ecosystem
- **Data**: Supabase (Postgres + Storage)
- **Sandbox runtime**: E2B
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

# E2B preview
E2B_API_KEY=...
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
4. Preview is started or rebuilt in E2B.
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

