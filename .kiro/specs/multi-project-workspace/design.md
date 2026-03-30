# Design Document: Multi-Project Workspace

## Overview

This feature upgrades the open-ox AI website generation system from a single overwrite-based working directory (`sites/template`) to a persistent multi-project management system. Each AI-generated website is saved as an independent project under `sites/{project-id}/`. Users can view a history of all projects, reopen previews, and apply AI-assisted modifications to existing projects.

The core architectural change is introducing a `Project_Manager` service that owns project lifecycle (create, read, update, delete), a `Project_Registry` JSON file for persistence, a `Port_Allocator` for dev server management, and a `Modify_Flow` for incremental AI edits. The existing `Generate_Flow` is adapted to write into dynamic project directories instead of the fixed template path.


## Architecture

```mermaid
graph TD
    UI_BS[Build Studio\napp/build-studio] -->|POST /api/ai| API_AI[/api/ai route]
    UI_PD[Project Dashboard\napp/projects] -->|GET /api/projects| API_PROJ[/api/projects route]
    UI_PD -->|click project| UI_DETAIL[Project Detail\napp/projects/[id]]
    UI_DETAIL -->|POST /api/projects/[id]/preview| API_PREV[Preview API]
    UI_DETAIL -->|POST /api/projects/[id]/modify| API_MOD[Modify API]

    API_AI --> PM[Project Manager\nlib/projectManager.ts]
    API_PROJ --> PM
    API_PREV --> PM
    API_MOD --> PM

    PM --> REGISTRY[Project Registry\n.open-ox/projects.json]
    PM --> TEMPLATE[Template Dir\nsites/template/]
    PM --> PROJECT_DIR[Project Dir\nsites/{project-id}/]

    API_AI --> GF[Generate Flow\nrunGenerateProject]
    API_MOD --> MF[Modify Flow\nrunModifyProject]

    GF --> COMMON[ai/tools/system/common.ts\nSITE_ROOT dynamic]
    MF --> COMMON

    API_PREV --> PA[Port Allocator\nlib/portAllocator.ts]
    API_PREV --> DSM[Dev Server Manager\nlib/devServerManager.ts]
    DSM --> DS1[next dev :3100]
    DSM --> DS2[next dev :3101]
```


## Components and Interfaces

### Project Manager (`lib/projectManager.ts`)

Central service for all project lifecycle operations.

```typescript
interface ProjectMetadata {
  id: string;                    // e.g. "2026-03-26T13-32-39_my-shop"
  name: string;
  userPrompt: string;
  status: "generating" | "ready" | "failed";
  createdAt: string;             // ISO 8601
  updatedAt: string;
  completedAt?: string;
  error?: string;
  verificationStatus?: "passed" | "failed";
  blueprint?: PlannedProjectBlueprint;
  modificationHistory: ModificationRecord[];
}

interface ModificationRecord {
  instruction: string;
  modifiedAt: string;
  touchedFiles: string[];
}

// Core functions
function createProject(userPrompt: string): Promise<ProjectMetadata>
function updateProjectStatus(id: string, status: ProjectMetadata["status"], extra?: Partial<ProjectMetadata>): Promise<void>
function getProject(id: string): Promise<ProjectMetadata | null>
function listProjects(): Promise<ProjectMetadata[]>
function renameProject(id: string, name: string): Promise<void>
function deleteProject(id: string): Promise<void>
function getSiteRoot(projectId: string): string
function initProjectDir(projectId: string): Promise<void>
```


### Port Allocator (`lib/portAllocator.ts`)

Scans for available ports starting at 3100.

```typescript
async function findAvailablePort(startPort?: number): Promise<number>
// Checks if a TCP port is in use via net.createServer
```

### Dev Server Manager (`lib/devServerManager.ts`)

Manages per-project Next.js dev server processes.

```typescript
interface DevServerEntry {
  projectId: string;
  port: number;
  process: ChildProcess;
  url: string;
  status: "starting" | "running" | "stopped";
}

function startDevServer(projectId: string): Promise<{ url: string; port: number }>
function stopDevServer(projectId: string): Promise<void>
function getDevServerStatus(projectId: string): { status: "running" | "stopped"; url?: string }
```

### API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List all projects, sorted by createdAt desc |
| GET | `/api/projects/[id]` | Get single project metadata |
| PATCH | `/api/projects/[id]` | Rename project |
| DELETE | `/api/projects/[id]` | Delete project + dir |
| POST | `/api/projects/[id]/preview` | Start dev server, return URL |
| DELETE | `/api/projects/[id]/preview` | Stop dev server |
| GET | `/api/projects/[id]/preview/status` | Dev server status |
| POST | `/api/projects/[id]/modify` | Trigger Modify_Flow (SSE) |

### Modified: `ai/tools/system/common.ts`

`SITE_ROOT` becomes a runtime-overridable value rather than a module-level constant:

```typescript
// Instead of a const, export a mutable reference + setter
let _siteRoot: string = process.env.SITE_ROOT
  ? join(WORKSPACE_ROOT, process.env.SITE_ROOT)
  : WORKSPACE_ROOT;

export function getSiteRoot(): string { return _siteRoot; }
export function setSiteRoot(path: string): void { _siteRoot = path; }
// Keep SITE_ROOT export for backward compat (reads _siteRoot at call time via getter)
```

### Modified: `ai/flows/generate_project/runGenerateProject.ts`

Accepts an optional `projectId` parameter. When provided, sets `SITE_ROOT` to `sites/{projectId}` before running and removes the `clearTemplate()` call.

### New: `ai/flows/modify_project/runModifyProject.ts`

Incremental modification flow. Reads existing project files and blueprint, sends targeted edit instructions to the LLM, writes only changed files, and streams SSE progress events in the same format as `Generate_Flow`.


## Data Models

### Project Registry (`.open-ox/projects.json`)

```json
{
  "projects": [
    {
      "id": "2026-03-26T13-32-39_my-shop",
      "name": "My Shop",
      "userPrompt": "Build a DeFi token swap interface...",
      "status": "ready",
      "createdAt": "2026-03-26T13:32:39.000Z",
      "updatedAt": "2026-03-26T13:45:00.000Z",
      "completedAt": "2026-03-26T13:45:00.000Z",
      "verificationStatus": "passed",
      "modificationHistory": []
    }
  ]
}
```

### Project ID Format

`{ISO-timestamp-with-dashes}_{slug}` — e.g. `2026-03-26T13-32-39_my-shop`

- Timestamp uses `-` instead of `:` for filesystem compatibility
- Slug is derived from the first 5 words of the user prompt, lowercased and hyphenated
- Guaranteed unique because timestamp is millisecond-precision

### Project Directory Layout

```
sites/
  {project-id}/
    package.json          # name = project-id, only project-specific deps
    tsconfig.json
    next.config.ts
    postcss.config.mjs
    tailwind.config.ts
    components.json
    app/
      globals.css         # generated by AI
      layout.tsx          # generated by AI
      page.tsx            # generated by AI
      [slug]/
        page.tsx          # generated by AI (non-home pages)
    components/
      sections/           # generated by AI
      ui/                 # copied from template
    lib/
      utils.ts            # copied from template
    public/               # copied from template
```

### pnpm Workspace Configuration

`pnpm-workspace.yaml` (root):
```yaml
packages:
  - "sites/*"
ignoredBuiltDependencies:
  - sharp
  - unrs-resolver
```

Root `package.json` declares all shared dependencies (next, react, react-dom, radix-ui, tailwindcss, framer-motion, lucide-react, clsx, tailwind-merge, etc.) so they are hoisted to root `node_modules` and available to all `sites/*` projects without per-project installation.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Project creation produces unique IDs

*For any* two calls to `createProject`, the resulting project IDs must be distinct, and each ID must appear exactly once in the Project Registry.

**Validates: Requirements 1.1**

### Property 2: Generated files land in the correct project directory

*For any* project ID, all files written by `Generate_Flow` must have paths that begin with `sites/{project-id}/` and must not exist under any other project's directory.

**Validates: Requirements 1.2**

### Property 3: Template scaffold is fully copied to new project

*For any* new project directory, after `initProjectDir` completes, the project dir must contain `package.json` and `next.config.ts`, and must not contain any of the AI-generated files (`components/sections/`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `design-system.md`).

**Validates: Requirements 1.3, 7.1, 7.6**

### Property 4: Project status lifecycle is correct

*For any* generation run, if the run succeeds the project status in the registry must be `"ready"` with a `completedAt` timestamp; if the run throws an error the status must be `"failed"` with an `error` field set.

**Validates: Requirements 1.4, 1.5**

### Property 5: Registry round-trip preserves all fields

*For any* project metadata object written to the Project Registry, reading the registry back and finding that project must return an object with all fields equal to the original.

**Validates: Requirements 1.6, 5.4**

### Property 6: Project list is sorted descending by createdAt

*For any* set of projects in the registry, `GET /api/projects` must return them ordered so that `projects[i].createdAt >= projects[i+1].createdAt` for all valid indices.

**Validates: Requirements 2.1**

### Property 7: Port allocator returns first free port at or above 3100

*For any* set of occupied ports, `findAvailablePort` must return the smallest integer >= 3100 that is not in the occupied set.

**Validates: Requirements 3.3**

### Property 8: Preview start is idempotent

*For any* project with a running dev server, calling `POST /api/projects/{id}/preview` a second time must return the same URL and port without spawning a new process.

**Validates: Requirements 3.5**

### Property 9: Modification history grows monotonically

*For any* project, after each successful `Modify_Flow` run, the length of `modificationHistory` must be exactly one greater than before, and the new entry must contain the instruction and a non-empty `touchedFiles` list.

**Validates: Requirements 4.4**

### Property 10: Rename updates name and updatedAt

*For any* project and any valid new name string, after `PATCH /api/projects/{id}` the registry entry must have `name` equal to the new name and `updatedAt` greater than the previous value.

**Validates: Requirements 5.1**

### Property 11: Delete removes project from registry and filesystem

*For any* existing project, after `DELETE /api/projects/{id}` the project must not appear in `listProjects()` and the directory `sites/{project-id}/` must not exist on disk.

**Validates: Requirements 5.2**

### Property 12: Missing project returns 404

*For any* project-specific API endpoint and any project ID that does not exist in the registry, the response status must be 404.

**Validates: Requirements 5.5**

### Property 13: getSiteRoot returns correct absolute path

*For any* project ID, `getSiteRoot(projectId)` must return a string equal to `path.join(WORKSPACE_ROOT, "sites", projectId)`.

**Validates: Requirements 6.2, 6.4**

### Property 14: Project-specific dependencies are scoped to the project

*For any* package installed via `installPackageTool` during a generation or modification run, the `pnpm add` command must be executed with `cwd` set to `sites/{project-id}/`, and the package must appear in that project's `package.json` and not in the root `package.json`.

**Validates: Requirements 7.3, 8.4**

### Property 15: Template package.json is stripped of shared dependencies

*For any* new project, after `initProjectDir` the project's `package.json` must not declare any package that is already declared in the root `package.json` dependencies or devDependencies.

**Validates: Requirements 7.2**


## Error Handling

### Project Registry Errors

- If `.open-ox/projects.json` does not exist, `listProjects()` returns `[]` (never throws).
- If the file exists but is malformed JSON, the error is logged and an empty list is returned to avoid crashing the dashboard.
- All writes to the registry use atomic write (write to temp file, then rename) to prevent corruption on crash.

### Template Copy Errors

- If `sites/template/` does not exist or a file copy fails, `initProjectDir` throws, the project status is set to `"failed"`, and the partially-created project directory is cleaned up.
- Validation after copy checks for `package.json` and `next.config.ts`; missing either is treated as a copy failure.

### Dev Server Errors

- If `findAvailablePort` cannot find a free port in the range 3100–3200, it throws with a clear message.
- If the `next dev` process exits unexpectedly, the `DevServerManager` updates the entry status to `"stopped"` and the status endpoint reflects this.
- Starting a dev server for a project whose directory does not exist returns HTTP 404.

### Generate / Modify Flow Errors

- If `setSiteRoot` is called with a path outside `WORKSPACE_ROOT/sites/`, it throws to prevent path traversal.
- If `Modify_Flow` cannot read the existing blueprint metadata, it falls back to reading the source files directly and proceeds without blueprint context.
- SSE streams always emit a final `{"type":"error"}` or `{"type":"done"}` event so clients can detect completion.

### API Error Responses

All API routes return structured JSON errors:
```json
{ "error": "Human-readable message", "code": "MACHINE_CODE" }
```

HTTP status codes: 400 (bad input), 404 (not found), 409 (conflict, e.g. project already generating), 500 (internal).


## Testing Strategy

### Unit Tests

Unit tests cover specific examples, edge cases, and error conditions. They should be kept focused — property tests handle broad input coverage.

Key unit test targets:
- `createProject`: verify ID format matches `{timestamp}_{slug}` pattern
- `initProjectDir`: verify excluded files are not copied, verify `package.json` name is updated
- `findAvailablePort`: verify returns 3100 when no ports are occupied; verify skips occupied ports
- `getSiteRoot`: verify returns correct absolute path for a known project ID
- `GET /api/projects` with missing registry file: verify returns `[]`
- `DELETE /api/projects/{id}` with running dev server: verify server is stopped before directory removal
- `PATCH /api/projects/{id}` with non-existent ID: verify 404
- `POST /api/projects/{id}/preview` called twice: verify same URL returned, single process

### Property-Based Tests

Property tests use [fast-check](https://github.com/dubzzz/fast-check) (TypeScript). Each test runs a minimum of 100 iterations.

Each test is tagged with a comment in the format:
`// Feature: multi-project-workspace, Property {N}: {property_text}`

| Property | Test Description | fast-check Arbitraries |
|----------|-----------------|----------------------|
| P1: Unique IDs | Generate N random prompts, create N projects, assert all IDs distinct | `fc.array(fc.string(), {minLength: 2})` |
| P2: Files in correct dir | Random projectId + file list, assert all paths start with `sites/{id}/` | `fc.string(), fc.array(fc.string())` |
| P3: Template scaffold | Random projectId, run initProjectDir, assert required files present and generated files absent | `fc.string({minLength: 1})` |
| P4: Status lifecycle | Simulate success/failure outcomes, assert correct status transitions | `fc.boolean()` (success flag) |
| P5: Registry round-trip | Random ProjectMetadata, write then read, assert deep equality | `fc.record({...})` |
| P6: List sorted desc | Random array of projects with random createdAt, assert sorted order | `fc.array(fc.record({createdAt: fc.date()}))` |
| P7: Port allocator | Random set of occupied ports in 3100–3200, assert result is min free port >= 3100 | `fc.set(fc.integer({min: 3100, max: 3200}))` |
| P8: Idempotent preview | Call startDevServer twice for same projectId, assert same URL | `fc.string()` (projectId) |
| P9: Modification history grows | Random instruction + touched files, assert history length +1 | `fc.string(), fc.array(fc.string())` |
| P10: Rename updates fields | Random name string, assert name updated and updatedAt increased | `fc.string({minLength: 1})` |
| P11: Delete cleans up | Random project, create then delete, assert absent from registry and disk | `fc.string()` |
| P12: 404 for missing project | Random non-existent IDs, assert all endpoints return 404 | `fc.string()` |
| P13: getSiteRoot path | Random projectId, assert result equals `join(WORKSPACE_ROOT, "sites", projectId)` | `fc.string({minLength: 1})` |
| P14: Dep scoping | Random package name + projectId, assert install cwd is project dir | `fc.string(), fc.string()` |
| P15: Stripped shared deps | Random project init, assert no overlap between project and root package.json deps | `fc.record({...})` |

### Integration Tests

- Full generate flow with a real project ID: verify registry entry created, files written to correct dir, status transitions to `"ready"`.
- Full delete flow with running dev server: verify process killed, directory removed, registry entry gone.
- pnpm workspace resolution: verify a `sites/{id}` project can import shared deps without a local `node_modules`.
