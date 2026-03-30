# External Integrations — Open-OX

## 1. AI / LLM Provider (OpenAI-Compatible API)

**SDK**: `openai ^4.77.0`
**Config**: `ai/flows/generate_project/shared/llm.ts`

The project uses the OpenAI SDK with a configurable base URL, allowing it to target any OpenAI-compatible API (OpenAI, Azure OpenAI, Google Gemini via OpenAI-compat endpoint, local models, etc.).

```typescript
// ai/flows/generate_project/shared/llm.ts
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_URL,
});
```

**Supported models** (from `lib/config/models.ts`):
- `gemini-3.1-pro-preview` (default) — 128k context
- `gpt-5.2` — 128k context
- `gemini-3-flash-preview` — 128k context

**Model selection**: `OPENAI_MODEL` env var, defaults to `gemini-3.1-pro-preview`

**LLM call patterns** (all in `ai/flows/generate_project/shared/llm.ts`):
- `callLLM()` — simple system+user prompt → text response
- `callLLMWithMeta()` — same but returns token usage metadata
- `callLLMWithTools()` — agentic tool-use loop (up to 8 iterations), executes system tools (write_file, exec_shell, etc.) between LLM calls

**Usage across flows**:
- `ai/flows/generate_project/` — multi-step website generation pipeline
- `ai/flows/modify_project/runModifyProject.ts` — plan + execute file modifications

## 2. Database / Persistence

**No external database.** All state is file-based:

- **Project registry**: `.open-ox/projects.json` — JSON file managed by `lib/projectManager.ts`
  - CRUD operations with atomic writes (write to `.tmp`, then rename)
  - Stores project metadata, status, blueprint, modification history
- **Dev server state**: `.open-ox/dev-servers.json` — tracks running dev server PIDs/ports (`lib/devServerManager.ts`)
- **Build logs**: `.open-ox/logs/` — per-run artifact logging (`ai/flows/generate_project/shared/logging.ts`)
- **Generated sites**: `sites/{projectId}/` — full Next.js project directories

## 3. API Routes (Internal REST + SSE)

All API routes are Next.js App Router route handlers:

| Endpoint | Method | File | Purpose |
|----------|--------|------|---------|
| `/api/ai` | POST | `app/api/ai/route.ts` | Generate new project (SSE stream) |
| `/api/projects` | GET | `app/api/projects/route.ts` | List all projects |
| `/api/projects/[id]` | GET | `app/api/projects/[id]/route.ts` | Get project details |
| `/api/projects/[id]` | PATCH | `app/api/projects/[id]/route.ts` | Rename project |
| `/api/projects/[id]` | DELETE | `app/api/projects/[id]/route.ts` | Delete project + stop dev server |
| `/api/projects/[id]/modify` | POST | `app/api/projects/[id]/modify/route.ts` | Modify project (SSE stream) |
| `/api/projects/[id]/preview` | POST | `app/api/projects/[id]/preview/route.ts` | Start dev server for preview |
| `/api/projects/[id]/preview` | DELETE | `app/api/projects/[id]/preview/route.ts` | Stop dev server |
| `/api/dev-servers` | GET | `app/api/dev-servers/route.ts` | List all running dev servers |
| `/api/dev-servers` | DELETE | `app/api/dev-servers/route.ts` | Stop a dev server by projectId |
| `/api/clear-template` | POST | `app/api/clear-template/route.ts` | Clear generated template files |

**SSE streaming** is used for both generate and modify flows — events are pushed as `data: {JSON}\n\n` chunks.

## 4. Dev Server Management

**File**: `lib/devServerManager.ts`

Each generated project can be previewed via a spawned Next.js dev server:
- Spawns `next dev --port {port}` as a child process in the project's `sites/{id}/` directory
- Port allocation: `lib/portAllocator.ts` — scans ports 3100–3200 for availability (IPv4 + IPv6 bind check)
- State persisted to `.open-ox/dev-servers.json` (PID, port, URL)
- Health checks via TCP socket connection and HTTP readiness polling
- Automatic cleanup on process exit

## 5. System Tools (AI Agent Tooling)

The AI engine exposes a set of system tools that the LLM can invoke during generation/repair:

| Tool | File | Purpose |
|------|------|---------|
| `write_file` | `ai/tools/system/writeFileTool.ts` | Write generated code to project files |
| `read_file` | `ai/tools/system/readFileTool.ts` | Read existing project files |
| `exec_shell` | `ai/tools/system/execShellTool.ts` | Execute shell commands in project dir |
| `list_dir` | `ai/tools/system/listDirTool.ts` | List directory contents |
| `search_code` | `ai/tools/system/searchCodeTool.ts` | Search code in project files |
| `install_package` | `ai/tools/system/installPackageTool.ts` | Install npm packages via `pnpm add` |
| `format_code` | `ai/tools/system/formatCodeTool.ts` | Format generated code |
| `run_build` | `ai/tools/system/runBuildTool.ts` | Run `pnpm run build` to verify compilation |

All tools are sandboxed to the current `SITE_ROOT` via `resolvePath()` in `ai/tools/system/common.ts`.

Tool catalog is registered in `ai/tools/systemToolCatalog.ts` as OpenAI `ChatCompletionTool` definitions.

## 6. Skill / Prompt System

**Directory**: `ai/flows/generate_project/prompts/`

A markdown-based prompt/skill system with YAML frontmatter:
- **Skills**: `prompts/skills/` — component generation skills (e.g. hero variants)
- **Sections**: `prompts/sections/` — section-type prompts (hero, features, pricing, etc.)
- **Layouts**: `prompts/layouts/` — layout pattern prompts
- **Motions**: `prompts/motions/` — animation style prompts (ambient, energetic, subtle)
- **Rules**: `prompts/rules/` — code generation rules (accessibility, styles, typography)
- **Capabilities**: `prompts/capabilities/` — capability pattern prompts
- **Steps**: `prompts/steps/` — step-specific system prompts

Discovery via `ai/shared/skillDiscovery.ts` — scans `.md` files, parses frontmatter with `gray-matter`, returns `SkillMetadata[]`.

## 7. Template System

**Directory**: `sites/template/`

New projects are scaffolded by copying the template directory:
- `lib/projectManager.ts` → `initProjectDir()` copies template, excluding AI-generated content and build artifacts
- Excluded from copy: `components/sections/`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `design-system.md`, `.next/`, `node_modules/`, etc.
- Project `package.json` is updated: name set to projectId, shared root dependencies stripped

## 8. Authentication

**None.** No authentication or authorization is implemented. The application runs as a local development tool.

## 9. File Storage / CDN

**None.** All files are stored on the local filesystem. No cloud storage or CDN integration.

## 10. Email / Notifications

**None.** No email or push notification services. In-app toast notifications via Sonner (`sonner ^2.0.7`).

## 11. Webhooks / Event Systems

**SSE (Server-Sent Events)** is the primary real-time communication pattern:
- Generate flow: `POST /api/ai` → streams `BuildStep` events
- Modify flow: `POST /api/projects/[id]/modify` → streams plan, diff, and step events
- Client consumption: `app/build-studio/lib/build-studio-api.ts` parses SSE via `ReadableStream` reader

No external webhook integrations.

## 12. Third-Party SDKs Summary

| Package | Version | Purpose | Integration Point |
|---------|---------|---------|-------------------|
| `openai` | `^4.77.0` | LLM API client | `ai/flows/generate_project/shared/llm.ts` |
| `gray-matter` | `^4.0.3` | YAML frontmatter parsing | `ai/shared/skillDiscovery.ts` |
| `diff` | `^8.0.4` | Unified diff computation | `ai/flows/modify_project/runModifyProject.ts` |
| `date-fns` | `^4.1.0` | Date formatting utilities | UI components |
| `typescript` (API) | `^5` | TSX transpile validation | `ai/flows/generate_project/shared/llm.ts` (sanitizeTsxContent) |

## 13. Key Environment Variables

| Variable | Required | Default | Used In |
|----------|----------|---------|---------|
| `OPENAI_API_KEY` | Yes | — | `ai/flows/generate_project/shared/llm.ts` |
| `OPENAI_API_URL` | Yes | — | `ai/flows/generate_project/shared/llm.ts` |
| `OPENAI_MODEL` | No | `gemini-3.1-pro-preview` | `lib/config/models.ts` |
| `SITE_ROOT` | No | workspace root | `ai/tools/system/common.ts` |
