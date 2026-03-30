# Open-OX Architecture

## Architectural Pattern

Open-OX is a **pnpm workspace monorepo** with a Next.js 16 App Router host application that orchestrates an AI-powered website generation engine. The host app serves as both the builder UI and the API backend, while each generated website lives as an independent Next.js project inside the `sites/` workspace.

**Key characteristics:**
- Single Next.js 16 host app (root `app/`) — serves the Build Studio UI and all API routes
- AI engine (`ai/`) — a deterministic, multi-step pipeline that generates complete Next.js websites
- Generated sites (`sites/*`) — each is a standalone Next.js project managed as a pnpm workspace package
- Dev server management — the host app spawns and manages `next dev` processes for generated sites
- File-based persistence — project registry and dev server state stored in `.open-ox/` JSON files

## Layers and Boundaries

### 1. UI Layer (`app/`, `components/`)
The user-facing Next.js application with three main surfaces:
- **Landing page** (`app/page.tsx`) — marketing/entry point, routes to Build Studio
- **Build Studio** (`app/build-studio/`) — the primary creation interface where users input prompts and watch real-time generation progress via SSE
- **Projects Dashboard** (`app/projects/`) — lists all projects; project detail page (`app/projects/[id]/`) embeds a live iframe preview and a modification panel

The UI layer communicates with the backend exclusively through API routes. The Build Studio uses SSE (Server-Sent Events) for real-time step-by-step progress streaming.

### 2. API Layer (`app/api/`)
Next.js Route Handlers that bridge the UI to backend services:
- `POST /api/ai` — triggers full project generation, returns SSE stream
- `GET /api/projects` — lists all projects from registry
- `GET/PATCH/DELETE /api/projects/[id]` — CRUD for individual projects
- `POST /api/projects/[id]/preview` — starts a dev server for the project
- `DELETE /api/projects/[id]/preview` — stops the dev server
- `POST /api/projects/[id]/modify` — triggers modification flow, returns SSE stream
- `GET/DELETE /api/dev-servers` — list/stop all dev servers
- `POST /api/clear-template` — clears generated content from template

### 3. AI Engine (`ai/`)
The core generation pipeline. This is NOT an open-ended agent — it follows a **fixed, deterministic flow** with bounded planning and controlled repair.

**Two flows:**
- **Generate Project** (`ai/flows/generate_project/`) — creates a new website from a user prompt
- **Modify Project** (`ai/flows/modify_project/`) — applies targeted modifications to an existing project

**Sub-layers within the AI engine:**
- `ai/flows/` — orchestration logic (step sequencing, error handling, artifact logging)
- `ai/flows/generate_project/steps/` — individual pipeline steps (analyze, plan, design, generate, build, repair)
- `ai/flows/generate_project/prompts/` — markdown prompt templates organized by category (sections, skills, rules, layouts, motions, capabilities, steps)
- `ai/flows/generate_project/selectors/` — convention-based prompt selection (e.g., `section.{type}.md`)
- `ai/flows/generate_project/planners/` — project planning strategies
- `ai/flows/generate_project/registry/` — section type registries (e.g., layout section identification)
- `ai/flows/generate_project/shared/` — shared utilities (LLM calls, file I/O, logging, path conventions)
- `ai/tools/` — sandboxed system tools the AI can invoke (write_file, read_file, exec_shell, install_package, run_build, etc.)
- `ai/shared/` — cross-flow utilities (skill discovery from markdown frontmatter)
- `ai/prompts/systems/` — system-level prompts (e.g., `frontend.md`)

### 4. Infrastructure Layer (`lib/`)
Server-side services shared across API routes and the AI engine:
- `lib/projectManager.ts` — project CRUD, registry persistence (`.open-ox/projects.json`), template copying
- `lib/devServerManager.ts` — spawns/manages `next dev` child processes for generated sites, persists state to `.open-ox/dev-servers.json`
- `lib/portAllocator.ts` — finds available ports in range 3100–3200
- `lib/clearTemplate.ts` — removes AI-generated files from a site directory
- `lib/config/models.ts` — LLM model configuration (Gemini, GPT)
- `lib/atlas/` — build step parsing utilities

### 5. Generated Sites (`sites/`)
Each generated project is a complete, independent Next.js application:
- `sites/template/` — the golden template that new projects are cloned from
- `sites/{timestamp}_{slug}/` — generated project directories


## Data Flow

### Generation Flow (User Prompt → Live Website)

```
User enters prompt in Build Studio UI
        │
        ▼
POST /api/ai (SSE stream)
        │
        ├─ 1. createProject() → writes to .open-ox/projects.json
        ├─ 2. initProjectDir() → copies sites/template → sites/{id}/
        │      (strips shared deps, updates package.json name)
        │
        ▼
runGenerateProject() — fixed pipeline:
        │
        ├─ Step 1: analyzeProjectRequirement
        │    User prompt → LLM → ProjectBlueprint (roles, pages, sections, design intent)
        │
        ├─ Step 2: planProject
        │    ProjectBlueprint → LLM → PlannedProjectBlueprint (design plans per section)
        │
        ├─ Step 3: generateProjectDesignSystem
        │    Blueprint → LLM → design-system.md (written to site)
        │
        ├─ Step 4: applyProjectDesignTokens
        │    design-system.md → LLM → globals.css + tailwind tokens
        │
        ├─ Step 5: generateSharedLayoutSections (parallel)
        │    For each layout section (nav, footer):
        │      section spec + design plan + skill selection → LLM → .tsx component
        │    Then: composeLayout → writes app/layout.tsx
        │
        ├─ Step 6: generatePages (parallel per page, parallel sections within)
        │    For each page, for each section:
        │      section spec + design plan + skill prompt → LLM → .tsx component
        │    Then: composePage → writes app/{slug}/page.tsx
        │
        ├─ Step 7: installDependencies
        │    Scans generated files for imports → auto-installs missing packages
        │
        ├─ Step 8: runBuild (with repair loop, max 2 retries)
        │    next build → if fails → LLM repair → rebuild
        │
        └─ Step 9: syncValidationMarkers
             Marks files as validated/unvalidated based on build result
        │
        ▼
SSE streams each step back to Build Studio UI in real-time
        │
        ▼
updateProjectStatus("ready") → .open-ox/projects.json
```

### Modification Flow (Instruction → Updated Website)

```
User types instruction in Project Detail page
        │
        ▼
POST /api/projects/[id]/modify (SSE stream)
        │
        ▼
runModifyProject() — 3-phase pipeline:
        │
        ├─ Phase 1: Plan
        │    Read project context (blueprint, existing files) → LLM → modification plan
        │
        ├─ Phase 2: Execute (topologically sorted by dependencies)
        │    For each file change: LLM generates COMPLETE new file content
        │
        ├─ Phase 3: Diff
        │    Deterministic line-level diff computed using `diff` library
        │    Diffs streamed to client for display
        │
        └─ Update registry with modification record
```

### Preview Flow (Project → Live Dev Server)

```
User opens project detail page
        │
        ▼
POST /api/projects/[id]/preview
        │
        ├─ Check .open-ox/dev-servers.json for existing entry
        ├─ If alive (pid + port check) → reuse
        ├─ Otherwise → findAvailablePort(3100-3200)
        │              → spawn `next dev --port {port}` in sites/{id}/
        │              → wait for "Ready" signal
        │              → persist to dev-servers.json
        │
        ▼
Returns { url, port } → iframe loads http://localhost:{port}
```

## Key Abstractions and Interfaces

### ProjectBlueprint / PlannedProjectBlueprint
The central data structure produced by the AI analysis step. Contains:
- `brief` — project title, description, language, product scope, user roles, task loops, capabilities
- `experience` — design intent (mood, color direction, style, keywords)
- `site` — information architecture, layout sections, pages with their sections

The `Planned` variant adds `designPlan` to each section and `pageDesignPlan` to each page, plus project-level `guardrailIds`.

### SectionSpec / PlannedSectionSpec
Describes a single UI section (hero, features, pricing, etc.):
- `type`, `intent`, `contentHints`, `fileName`
- `primaryRoleIds`, `supportingCapabilityIds`, `sourceTaskLoopIds`
- `designPlan` (in Planned variant) — detailed layout, visual, interaction, and content strategy

### Skill System
Markdown files with YAML frontmatter in `ai/flows/generate_project/prompts/skills/`. Each skill is a specialized prompt for generating a specific component variant (e.g., `component.hero.dashboard`, `component.hero.particle`). Skills are discovered at runtime via `ai/shared/skillDiscovery.ts` which scans directories and parses frontmatter for metadata (section types, priority, conditions).

### System Tools (`ai/tools/`)
A sandboxed tool system that the AI engine uses to interact with the file system:
- `write_file`, `read_file`, `list_dir`, `search_code` — file operations scoped to SITE_ROOT
- `exec_shell` — shell command execution
- `install_package` — npm package installation
- `format_code` — code formatting (Prettier)
- `run_build` — `next build` execution

Tools are registered in `systemToolCatalog.ts` as OpenAI function-calling compatible definitions.

### Prompt System
Hierarchical markdown prompt templates:
- **Step prompts** (`prompts/steps/`) — orchestrate each pipeline step
- **Section prompts** (`prompts/sections/`) — per-section-type generation instructions
- **Skill prompts** (`prompts/skills/`) — specialized component variant prompts
- **Rule prompts** (`prompts/rules/`) — cross-cutting constraints (accessibility, styles, typography)
- **Layout prompts** (`prompts/layouts/`) — layout variant patterns
- **Motion prompts** (`prompts/motions/`) — animation/motion patterns
- **Capability prompts** (`prompts/capabilities/`) — capability-specific patterns

Selection is convention-based: `section.{type}.md` falls back to `section.default.md`.

## Entry Points

| Entry Point | Path | Purpose |
|---|---|---|
| Landing page | `app/page.tsx` | Marketing page, routes to Build Studio |
| Build Studio | `app/build-studio/page.tsx` | Primary creation UI |
| Projects list | `app/projects/page.tsx` | Project dashboard |
| Project detail | `app/projects/[id]/page.tsx` | Preview + modify interface |
| AI generation API | `app/api/ai/route.ts` | SSE endpoint for project generation |
| Project CRUD API | `app/api/projects/route.ts` | List projects |
| Project detail API | `app/api/projects/[id]/route.ts` | Get/rename/delete project |
| Preview API | `app/api/projects/[id]/preview/route.ts` | Start/stop dev server |
| Modify API | `app/api/projects/[id]/modify/route.ts` | SSE endpoint for modifications |
| Dev servers API | `app/api/dev-servers/route.ts` | List/stop all dev servers |
| AI engine entry | `ai/index.ts` | `processInput()` — main AI entry |
| Generate flow | `ai/flows/generate_project/runGenerateProject.ts` | Full generation pipeline |
| Modify flow | `ai/flows/modify_project/runModifyProject.ts` | Modification pipeline |

## Module Boundaries and Dependencies

```
┌─────────────────────────────────────────────────────┐
│                    UI Layer                          │
│  app/page.tsx, app/build-studio/, app/projects/     │
│  components/ui/                                     │
│                                                     │
│  Depends on: API routes (fetch calls only)          │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (fetch + SSE)
┌──────────────────────▼──────────────────────────────┐
│                   API Layer                          │
│  app/api/ai/, app/api/projects/, app/api/dev-servers│
│                                                     │
│  Depends on: AI Engine, Infrastructure              │
└──────────┬───────────────────────┬──────────────────┘
           │                       │
┌──────────▼──────────┐  ┌────────▼─────────────────┐
│     AI Engine       │  │   Infrastructure (lib/)   │
│  ai/flows/          │  │  projectManager.ts        │
│  ai/tools/          │  │  devServerManager.ts      │
│  ai/prompts/        │  │  portAllocator.ts         │
│  ai/shared/         │  │  clearTemplate.ts         │
│                     │  │  config/models.ts         │
│  Depends on:        │  │                           │
│  - lib/ (project    │  │  Depends on:              │
│    manager, config) │  │  - File system            │
│  - OpenAI SDK       │  │  - Child processes        │
│  - File system      │  │  - .open-ox/ state files  │
└─────────────────────┘  └───────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│              Generated Sites (sites/*)              │
│  Independent Next.js apps                           │
│  Written to by AI Engine, served by Dev Server Mgr  │
│                                                     │
│  No runtime dependency on host app                  │
└─────────────────────────────────────────────────────┘
```

**Dependency rules:**
- UI layer → API layer (HTTP only, no direct imports)
- API layer → AI engine + Infrastructure (direct imports)
- AI engine → Infrastructure (`lib/projectManager`, `lib/config/models`)
- AI engine → File system (via sandboxed `ai/tools/system/`)
- Infrastructure → File system + child processes
- Generated sites → No dependency on host app (fully standalone)
