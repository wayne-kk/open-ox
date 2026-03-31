# Open-OX Codebase Concerns

> Internal technical debt and risk assessment. Generated from source analysis.

---

## 1. Critical Security Concerns

### 1.1 No Authentication or Authorization on Any API Route

Every API endpoint is completely open — no auth middleware, no session checks, no API keys.

- `app/api/ai/route.ts` — triggers expensive LLM generation (cost exposure)
- `app/api/projects/[id]/modify/route.ts` — modifies project files on disk
- `app/api/projects/[id]/route.ts` DELETE — deletes project directories from filesystem
- `app/api/projects/[id]/preview/route.ts` POST — spawns child processes (dev servers)
- `app/api/dev-servers/route.ts` DELETE — kills running processes by projectId
- `app/api/clear-template/route.ts` POST — deletes files from disk

**Severity: Critical.** Anyone with network access can trigger LLM calls, spawn processes, delete files, and modify the filesystem.

### 1.2 Shell Injection via AI Tool System

`ai/tools/system/execShellTool.ts` passes LLM-generated commands directly to `execSync()` with no sanitization or allowlist:

```typescript
// Line 34-38 — execShellTool.ts
const output = execSync(command, {
  cwd: fullCwd,
  encoding: "utf-8",
  maxBuffer: 1024 * 1024,
});
```

The LLM decides what shell command to run. There is no command allowlist, no sandboxing, and no validation. The `exec_shell` tool description even encourages arbitrary commands.

`ai/tools/system/installPackageTool.ts` also has injection risk — the `pkg` argument is interpolated directly into a shell command:

```typescript
// Line 36 — installPackageTool.ts
const cmd = dev ? `pnpm add -D ${pkg}` : `pnpm add ${pkg}`;
```

A malicious package name like `foo; rm -rf /` would execute arbitrary commands.


`ai/tools/system/searchCodeTool.ts` also interpolates user-controlled input into a shell command (line 37):

```typescript
`rg "${pattern.replace(/"/g, '\\"')}" "${fullPath}" ...`
```

The quote-escaping is insufficient — backticks, `$()`, and other shell metacharacters are not escaped.

**Severity: Critical.** LLM-controlled arbitrary code execution on the host.

### 1.3 Exposed API Key in `.env.local`

`.env.local` contains a plaintext `OPENAI_API_KEY` and a custom `OPENAI_API_URL` pointing to an internal server (`http://152.136.41.186:30131/v1`). While `.env*` is in `.gitignore`, the key is present in the working directory and could be leaked through the `exec_shell` tool (e.g., `env` or `printenv` commands).

### 1.4 Path Traversal — Partial Protection

`ai/tools/system/common.ts` `resolvePath()` (line 40-46) checks that resolved paths start with `SITE_ROOT`, but uses simple string prefix matching after only normalizing forward slashes. It does **not** call `path.resolve()` or `fs.realpathSync()` to canonicalize symlinks or `..` sequences that survive `path.join()`.

`lib/projectManager.ts` `getSiteRoot()` (line 73-79) has better protection with explicit `..` check, but the AI tools system uses the weaker `common.ts` version.

### 1.5 No Rate Limiting

No rate limiting on any endpoint. The `/api/ai` route triggers multi-step LLM generation that can run for minutes and cost significant API credits per request.

### 1.6 No Input Sanitization on User Prompts

`app/api/ai/route.ts` accepts `userPrompt` and passes it directly to the LLM pipeline. No length limits, no content filtering, no prompt injection defenses.

---

## 2. Race Conditions and Data Integrity

### 2.1 Registry File Race Condition

`lib/projectManager.ts` uses a read-modify-write pattern for `projects.json` without any file locking:

```typescript
// createProject, updateProjectStatus, renameProject, deleteProject all do:
const projects = await listProjects();  // READ
// ... modify array ...
await writeRegistry(projects);          // WRITE
```

Concurrent requests (e.g., two simultaneous project creations, or a create + status update) will cause lost writes. The atomic temp-file-rename only prevents partial writes, not lost updates.

### 2.2 Dev Server State File Race Condition

`lib/devServerManager.ts` has the same read-modify-write pattern for `dev-servers.json` (lines 95-113). Concurrent `startDevServer` / `stopDevServer` calls can corrupt state.

### 2.3 Mutable Global `_siteRoot`

`ai/tools/system/common.ts` uses a module-level mutable variable `_siteRoot` (line 15). Both `runGenerateProject` and `runModifyProject` call `setSiteRoot()` to redirect file operations. If two generation flows run concurrently, they will clobber each other's `_siteRoot`, causing files to be written to the wrong project directory.

---

## 3. Performance Concerns

### 3.1 Synchronous File I/O in Hot Paths

Multiple modules use synchronous `fs` operations that block the Node.js event loop:

- `ai/tools/system/writeFileTool.ts` — `writeFileSync`, `existsSync`, `mkdirSync`
- `ai/tools/system/readFileTool.ts` — `readFileSync`
- `ai/tools/system/listDirTool.ts` — `readdirSync`
- `ai/flows/generate_project/shared/files.ts` — `readFileSync`, `existsSync` throughout
- `lib/clearTemplate.ts` — `existsSync`, `readdirSync`, `rmSync` (all sync)
- `ai/shared/skillDiscovery.ts` — `readFileSync`, `readdirSync`, `existsSync`

These are called during API request handling and will block the event loop for the entire Next.js server.

### 3.2 Synchronous `execSync` in Tool Execution

`execShellTool.ts`, `installPackageTool.ts`, `formatCodeTool.ts`, `runBuildTool.ts`, and `searchCodeTool.ts` all use `execSync`, which blocks the Node.js event loop for the duration of the child process. A `pnpm install` or `next build` can take 30+ seconds.

### 3.3 Dev Server Process Accumulation

`lib/devServerManager.ts` spawns Next.js dev server child processes. The `child.on("exit")` handler calls `removeEntry()` but there's no periodic cleanup of stale entries. If the parent process crashes, orphan dev servers remain running and their state file entries become stale.

### 3.4 Port Range Limitation

`lib/portAllocator.ts` scans ports 3100-3200 sequentially (line 36-42). Only 101 ports available — with many concurrent projects this becomes a bottleneck. The sequential scan is also slow when many ports are occupied.

---


## 4. Fragile Architecture

### 4.1 Hardcoded Paths and Values

- `lib/portAllocator.ts` — port range 3100-3200 hardcoded (line 36)
- `lib/devServerManager.ts` — `"127.0.0.1"` hardcoded (line 41), 90s timeout hardcoded (line 62)
- `lib/projectManager.ts` — `TEMPLATE_EXCLUDE` set hardcoded (line 143-155), must be manually kept in sync with template structure
- `ai/tools/system/common.ts` — `SITE_ROOT` env var fallback to `WORKSPACE_ROOT` (line 15-17) means without env config, AI tools write to the monorepo root
- `lib/config/models.ts` — model IDs hardcoded with `as const`, `getModelId()` casts env var with `as ModelId` (line 14) — no runtime validation, invalid model names silently pass

### 4.2 Tight Coupling Between AI Tools and Global State

The `setSiteRoot()` / `getSiteRoot()` pattern in `ai/tools/system/common.ts` creates implicit coupling. Every tool call reads from a mutable global. The generate and modify flows must remember to call `setSiteRoot()` before any tool execution, and there's no scoping mechanism to prevent cross-contamination.

### 4.3 Template Symlink Strategy

`lib/projectManager.ts` `initProjectDir()` (line 213-221) creates a symlink from each project's `node_modules` to `sites/template/node_modules`. This is fragile:
- If template's `node_modules` doesn't exist, projects silently lack dependencies
- If template's dependencies change, all projects are affected simultaneously
- Symlinks can break on Windows or in Docker volumes

### 4.4 Workspace Configuration Mismatch

`pnpm-workspace.yaml` does **not** include `sites/*` as workspace packages — it only has `ignoredBuiltDependencies`. The requirements spec (`kiro/specs/multi-project-workspace/requirements.md`) explicitly states `sites/*` should be declared as workspace packages (Requirement 8.1). This means pnpm workspace dependency hoisting is not actually working as designed.

---

## 5. Missing Infrastructure

### 5.1 No Database

All state is stored in JSON files on disk (`.open-ox/projects.json`, `.open-ox/dev-servers.json`). No ACID guarantees, no concurrent access safety, no query capability.

### 5.2 No Test Coverage for API Routes

Only one test file exists: `ai/tools/system/common.property.test.ts` (property-based tests for path resolution). No tests for:
- API route handlers
- Project manager CRUD operations
- Dev server lifecycle
- AI flow orchestration
- Modify flow

### 5.3 No Input Validation Library

API routes do manual `typeof` checks. No schema validation (zod, joi, etc.) for request bodies. Missing validation:
- `userPrompt` length limits in `/api/ai`
- `userInstruction` length limits in `/api/projects/[id]/modify`
- `projectId` format validation in `/api/dev-servers` DELETE
- `name` length/character limits in `/api/projects/[id]` PATCH

### 5.4 No Logging Infrastructure

Errors are logged with `console.error`. No structured logging, no log levels, no log aggregation. Artifact logging exists for AI flows but not for API/infrastructure layer.

### 5.5 No Health Check Endpoint

No `/api/health` or similar endpoint for monitoring.

---

## 6. Known Issues

### 6.1 `sites/template` — Nested Repository Ambiguity

`sites/template/` is tracked as a regular directory in git (confirmed via `git ls-tree`), not a submodule. However, it has its own `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.gitignore`, and full Next.js project structure. It functions as an independent project embedded in the monorepo. No `.gitmodules` file exists. This is the intended design (template scaffold), not a submodule issue.

However, `sites/template/tsconfig.tsbuildinfo` is tracked in git despite `*.tsbuildinfo` being in `.gitignore` — this is a build artifact that should not be committed.

### 6.2 Duplicate Code in `ai/index.ts` and `app/api/ai/route.ts`

`ai/index.ts` `buildProcessContent()` and `app/api/ai/route.ts` (lines 56-72) contain nearly identical response-building logic. The `processInput()` wrapper in `ai/index.ts` appears to be legacy dead code — the API route calls `runGenerateProject` directly.

### 6.3 `clearTemplate()` Still Referenced

`lib/clearTemplate.ts` and the `/api/clear-template` route still exist and operate on the old single-template model. `runGenerateProject.ts` still calls `clearTemplate()` when no `projectId` is provided (line 310-320). This legacy path should be removed or deprecated.

### 6.4 Missing Error Handling in API Routes

- `app/api/dev-servers/route.ts` GET — no try/catch around `listDevServers()` (line 5-7)
- `app/api/projects/[id]/preview/status/route.ts` — no try/catch around `getDevServerStatus()` (line 7-9)
- `app/api/projects/[id]/preview/route.ts` DELETE — no try/catch around `stopDevServer()` (line 28-30)
- `app/api/projects/[id]/route.ts` GET/DELETE — no try/catch around main operations

---

## 7. Dependency Risks

### 7.1 Large Dependency Surface

`package.json` includes 30+ runtime dependencies. Several are heavy UI libraries (recharts, framer-motion, gsap, embla-carousel) that are likely only used in generated sites, not the builder itself. These inflate the root `node_modules` and slow installs.

### 7.2 OpenAI SDK Version

`openai: ^4.77.0` — using caret range. Major API changes in the OpenAI SDK could break the LLM integration on `pnpm update`.

---

## 8. Recommendations (by severity)

| Priority | Issue | Recommendation |
|----------|-------|----------------|
| **P0** | Shell injection in AI tools | Add command allowlist to `execShellTool`, sanitize package names in `installPackageTool`, escape shell args in `searchCodeTool` |
| **P0** | No auth on API routes | Add middleware-level auth (even a simple API key check) before any route that mutates state or triggers LLM calls |
| **P0** | Mutable global `_siteRoot` | Replace with a scoped context object passed through the flow, or use AsyncLocalStorage |
| **P1** | Registry race conditions | Add file locking (e.g., `proper-lockfile`) or move to SQLite |
| **P1** | No rate limiting | Add rate limiting middleware to `/api/ai` and `/api/projects/[id]/modify` |
| **P1** | Sync I/O blocking | Convert all `*Sync` calls to async equivalents, especially in tool executors |
| **P1** | No input validation | Add zod schemas for all API request bodies |
| **P2** | Missing `sites/*` in pnpm-workspace.yaml | Add workspace packages config per the spec requirements |
| **P2** | No test coverage | Add integration tests for API routes and project manager |
| **P2** | Dead code cleanup | Remove `processInput()` in `ai/index.ts`, evaluate `clearTemplate` route |
| **P3** | Structured logging | Replace `console.error` with a proper logger (pino, winston) |
| **P3** | Port range limitation | Use OS-assigned ports (port 0) instead of scanning a fixed range |
| **P3** | Template symlink fragility | Consider pnpm workspace hoisting instead of manual symlinks |
