# Implementation Plan: Multi-Project Workspace

## Overview

Upgrade the open-ox AI website generation system from a single overwrite-based working directory to a persistent multi-project management system. Implementation proceeds in layers: core data/service layer first, then API routes, then UI, then the modify flow.

## Tasks

- [x] 1. Set up pnpm workspace and shared dependency configuration
  - Update `pnpm-workspace.yaml` to include `sites/*` as workspace packages, preserving existing `ignoredBuiltDependencies`
  - Audit `sites/template/package.json` to identify all shared dependencies
  - Add all shared dependencies (next, react, react-dom, radix-ui, tailwindcss, framer-motion, lucide-react, clsx, tailwind-merge, etc.) to root `package.json`
  - _Requirements: 8.1, 8.2, 8.6, 8.7_

- [x] 2. Implement Project Manager core (`lib/projectManager.ts`)
  - [x] 2.1 Implement registry read/write with atomic writes (write to temp file, rename)
    - Implement `listProjects()` returning `[]` when file missing or malformed
    - Implement `getProject(id)` returning `null` when not found
    - Implement internal `writeRegistry()` using atomic temp-file-then-rename pattern
    - _Requirements: 1.6, 2.1, 5.4, 5.5_

  - [ ]* 2.2 Write property test for registry round-trip (Property 5)
    - **Property 5: Registry round-trip preserves all fields**
    - **Validates: Requirements 1.6, 5.4**

  - [x] 2.3 Implement `createProject(userPrompt)` and `getSiteRoot(projectId)`
    - Generate Project_ID in `{ISO-timestamp-with-dashes}_{slug}` format
    - Write initial registry entry with `status: "generating"`
    - Implement `getSiteRoot(projectId)` returning `path.join(WORKSPACE_ROOT, "sites", projectId)`
    - Validate path stays within `WORKSPACE_ROOT/sites/` to prevent traversal
    - _Requirements: 1.1, 6.2, 6.4_

  - [ ]* 2.4 Write property test for unique project IDs (Property 1)
    - **Property 1: Project creation produces unique IDs**
    - **Validates: Requirements 1.1**

  - [ ]* 2.5 Write property test for getSiteRoot path (Property 13)
    - **Property 13: getSiteRoot returns correct absolute path**
    - **Validates: Requirements 6.2, 6.4**

  - [x] 2.6 Implement `updateProjectStatus`, `renameProject`, `deleteProject`
    - `updateProjectStatus(id, status, extra?)` merges extra fields and updates `updatedAt`
    - `renameProject(id, name)` updates `name` and `updatedAt`
    - `deleteProject(id)` removes registry entry and deletes `sites/{id}/` directory
    - _Requirements: 1.4, 1.5, 5.1, 5.2_

  - [ ]* 2.7 Write property test for rename updates fields (Property 10)
    - **Property 10: Rename updates name and updatedAt**
    - **Validates: Requirements 5.1**

  - [ ]* 2.8 Write property test for delete cleans up (Property 11)
    - **Property 11: Delete removes project from registry and filesystem**
    - **Validates: Requirements 5.2**

  - [ ]* 2.9 Write property test for project status lifecycle (Property 4)
    - **Property 4: Project status lifecycle is correct**
    - **Validates: Requirements 1.4, 1.5**

- [x] 3. Implement `initProjectDir` (template copy + package.json cleanup)
  - [x] 3.1 Implement `initProjectDir(projectId)` in `lib/projectManager.ts`
    - Copy all files from `sites/template/` to `sites/{project-id}/`, excluding AI-generated files (`components/sections/`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `design-system.md`)
    - Update copied `package.json` `name` field to the project ID
    - Strip all packages already declared in root `package.json` from the project's `package.json`
    - Validate `package.json` and `next.config.ts` exist after copy; throw and set status `"failed"` if missing
    - Clean up partially-created directory on failure
    - _Requirements: 1.3, 7.1, 7.2, 7.4, 7.5, 7.6_

  - [ ]* 3.2 Write property test for template scaffold copy (Property 3)
    - **Property 3: Template scaffold is fully copied to new project**
    - **Validates: Requirements 1.3, 7.1, 7.6**

  - [ ]* 3.3 Write property test for stripped shared dependencies (Property 15)
    - **Property 15: Template package.json is stripped of shared dependencies**
    - **Validates: Requirements 7.2**

- [x] 4. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 5. Adapt `ai/tools/system/common.ts` for dynamic SITE_ROOT
  - Replace the module-level `SITE_ROOT` constant with a mutable `_siteRoot` variable
  - Export `getSiteRoot(): string` and `setSiteRoot(path: string): void`
  - Keep a backward-compatible `SITE_ROOT` export that reads `_siteRoot` at call time
  - Throw in `setSiteRoot` if the path is outside `WORKSPACE_ROOT/sites/`
  - _Requirements: 6.1, 6.3_

  - [x]* 5.1 Write property test for files land in correct project directory (Property 2)
    - **Property 2: Generated files land in the correct project directory**
    - **Validates: Requirements 1.2**

- [x] 6. Adapt `runGenerateProject.ts` to accept `projectId`
  - Add optional `projectId` parameter to `runGenerateProject`
  - When `projectId` is provided, call `setSiteRoot(getSiteRoot(projectId))` before running and skip `clearTemplate()`
  - When `projectId` is absent, fall back to existing behavior (backward compat with `SITE_ROOT` env var)
  - _Requirements: 1.2, 1.7, 6.1_

- [x] 7. Implement Port Allocator (`lib/portAllocator.ts`)
  - Implement `findAvailablePort(startPort = 3100)` scanning up to port 3200 using `net.createServer`
  - Throw with a clear message if no free port found in range
  - _Requirements: 3.3_

  - [ ]* 7.1 Write property test for port allocator (Property 7)
    - **Property 7: Port allocator returns first free port at or above 3100**
    - **Validates: Requirements 3.3**

- [x] 8. Implement Dev Server Manager (`lib/devServerManager.ts`)
  - Implement `startDevServer(projectId)`: allocate port, spawn `next dev --port {port}` in `sites/{projectId}/`, store `DevServerEntry`, return `{ url, port }`
  - Implement idempotent behavior: if a running entry exists for `projectId`, return existing URL without spawning
  - Implement `stopDevServer(projectId)`: kill process, update entry status to `"stopped"`
  - Implement `getDevServerStatus(projectId)`: return `{ status, url? }`
  - Update entry status to `"stopped"` when process exits unexpectedly
  - Return HTTP 404 if project directory does not exist when starting
  - _Requirements: 3.2, 3.3, 3.5, 3.6, 3.7, 5.3_

  - [ ]* 8.1 Write property test for idempotent preview start (Property 8)
    - **Property 8: Preview start is idempotent**
    - **Validates: Requirements 3.5**

- [x] 9. Implement API routes for project management
  - [x] 9.1 Create `app/api/projects/route.ts` — `GET /api/projects`
    - Call `listProjects()`, sort by `createdAt` descending, return JSON array
    - Return `[]` when registry missing
    - _Requirements: 2.1, 2.5_

  - [ ]* 9.2 Write property test for project list sorted descending (Property 6)
    - **Property 6: Project list is sorted descending by createdAt**
    - **Validates: Requirements 2.1**

  - [x] 9.3 Create `app/api/projects/[id]/route.ts` — `GET`, `PATCH`, `DELETE`
    - `GET`: return full project metadata including `modificationHistory`; 404 if not found
    - `PATCH`: accept `{ name }`, call `renameProject`, return updated metadata; 404 if not found
    - `DELETE`: stop dev server if running, call `deleteProject`; 404 if not found
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 9.4 Write property test for 404 on missing project (Property 12)
    - **Property 12: Missing project returns 404**
    - **Validates: Requirements 5.5**

  - [x] 9.5 Create `app/api/projects/[id]/preview/route.ts` — `POST`, `DELETE`
    - `POST`: call `startDevServer(id)`, return `{ url, port }`; 404 if project dir missing
    - `DELETE`: call `stopDevServer(id)`
    - _Requirements: 3.2, 3.5, 3.6_

  - [x] 9.6 Create `app/api/projects/[id]/preview/status/route.ts` — `GET`
    - Call `getDevServerStatus(id)`, return `{ status, url? }`
    - _Requirements: 3.7_

- [x] 10. Update `POST /api/ai` route to use Project Manager
  - Before calling `runGenerateProject`, call `createProject(userPrompt)` to get a `projectId`
  - Call `initProjectDir(projectId)` to scaffold the project directory
  - Pass `projectId` to `runGenerateProject`
  - On success, call `updateProjectStatus(id, "ready", { completedAt })` 
  - On error, call `updateProjectStatus(id, "failed", { error: e.message })`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 11. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement Modify Flow (`ai/flows/modify_project/runModifyProject.ts`)
  - [x] 12.1 Implement `runModifyProject(projectId, userInstruction)` skeleton with SSE streaming
    - Accept `projectId` and `userInstruction`
    - Set `SITE_ROOT` to the project's directory via `setSiteRoot`
    - Read existing project files and `blueprint` metadata from the registry as LLM context
    - Fall back to reading source files directly if blueprint is unavailable
    - Stream SSE progress events in the same format as `Generate_Flow`
    - Emit final `{"type":"done"}` or `{"type":"error"}` event
    - _Requirements: 4.1, 4.2, 4.3, 4.6_

  - [x] 12.2 Update `modificationHistory` on completion
    - After successful modification, call `updateProjectStatus` to update `updatedAt` and append a `ModificationRecord` to `modificationHistory` with `instruction`, `modifiedAt`, and `touchedFiles`
    - _Requirements: 4.4_

  - [ ]* 12.3 Write property test for modification history grows monotonically (Property 9)
    - **Property 9: Modification history grows monotonically**
    - **Validates: Requirements 4.4**

  - [x] 12.4 Create `app/api/projects/[id]/modify/route.ts` — `POST`
    - Accept `{ userInstruction }`, stream SSE response from `runModifyProject`
    - Return 404 if project not found
    - _Requirements: 4.1_

- [x] 13. Implement Project Dashboard UI (`app/projects/page.tsx`)
  - Create the `Project_Dashboard` page that fetches `GET /api/projects` on load
  - Display each project's `name`, `userPrompt` summary (first 100 chars), `status`, `createdAt`, and `verificationStatus`
  - Show distinct visual status badges for `"ready"`, `"generating"`, and `"failed"`
  - Poll every 3 seconds for projects with `status: "generating"` until status changes
  - Navigate to `/projects/{id}` on clicking a `"ready"` project
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 14. Implement Project Detail UI (`app/projects/[id]/page.tsx`)
  - On load, call `POST /api/projects/{id}/preview` and display the returned URL in an `<iframe>`
  - Show a text input for submitting modification instructions that POSTs to `/api/projects/{id}/modify` and streams SSE progress
  - Display modification progress inline while streaming
  - _Requirements: 3.1, 3.2, 3.4, 4.1, 4.6_

- [x] 15. Wire `installPackageTool` to use project-scoped `cwd`
  - Update `ai/tools/system/installPackageTool` (or equivalent) to run `pnpm add {package}` with `cwd` set to the current project's `getSiteRoot()` directory
  - Ensure the package is written to the project's `package.json`, not the root
  - _Requirements: 7.3, 8.4_

  - [ ]* 15.1 Write property test for project-specific dependency scoping (Property 14)
    - **Property 14: Project-specific dependencies are scoped to the project**
    - **Validates: Requirements 7.3, 8.4**

- [x] 16. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- The design uses TypeScript throughout; all new files should be `.ts` or `.tsx`
- Atomic registry writes (temp file + rename) are required to prevent corruption
- `setSiteRoot` must validate the path stays within `WORKSPACE_ROOT/sites/` to prevent path traversal
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) with a minimum of 100 iterations each
- Each property test file should include the comment: `// Feature: multi-project-workspace, Property {N}: {property_text}`
