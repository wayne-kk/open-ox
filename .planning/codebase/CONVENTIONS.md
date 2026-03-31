# Codebase Conventions — Open-OX

## Code Style & Formatting

- **Formatter**: Prettier v3.8+ (installed as devDependency, no `.prettierrc` config file — uses defaults: double quotes, trailing commas, 2-space indent)
- **Linter**: ESLint 9 flat config (`eslint.config.mjs`) extending `next/core-web-vitals` and `next/typescript`
- **No semicolons rule**: The codebase is inconsistent — some files omit semicolons (`components/ui/button.tsx`, `lib/utils.ts`), while most use them. The shadcn/ui-generated files tend to omit semicolons; hand-written code uses them.
- **Quotes**: Double quotes throughout (Prettier default)
- **Trailing commas**: ES5-style trailing commas on multi-line structures

## Naming Conventions

### Files
- **React components**: PascalCase (e.g. `BlueprintOverview.tsx`, `StepNode.tsx`, `EventStream.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g. `useBuildStudio.ts`)
- **Utility/library modules**: camelCase (e.g. `portAllocator.ts`, `devServerManager.ts`, `projectManager.ts`)
- **Type-only files**: camelCase (e.g. `build-studio.ts` in `types/`, `types.ts` in `ai/tools/`)
- **AI flow steps**: camelCase with `step` prefix pattern (e.g. `analyzeProjectRequirement.ts`, `generateSection.ts`)
- **Test files**: `*.test.ts` for unit tests, `*.property.test.ts` for property-based tests — co-located with source
- **API routes**: Next.js App Router convention — `route.ts` inside directory segments

### Functions & Variables
- **Functions**: camelCase, descriptive verbs (e.g. `findAvailablePort`, `runGenerateProject`, `buildProcessContent`)
- **Step functions**: prefixed with `step` (e.g. `stepGenerateSection`, `stepRunBuild`, `stepRepairBuild`)
- **Constants**: UPPER_SNAKE_CASE for true constants (e.g. `WORKSPACE_ROOT`, `REGISTRY_PATH`, `MODELS`, `CONTEXT_FILES`)
- **Interfaces**: PascalCase, no `I` prefix (e.g. `ProjectMetadata`, `BuildStep`, `ToolResult`)
- **Type aliases**: PascalCase (e.g. `ModelId`, `GuardrailId`, `VerificationStatus`, `PreviewState`)

## Import Patterns & Module Organization

- **Path aliases**: `@/*` maps to project root (configured in `tsconfig.json` and `vitest.config.ts`)
  - Used consistently in API routes and cross-module imports: `import { cn } from "@/lib/utils"`
  - Relative imports used within the same module subtree (e.g. `ai/flows/generate_project/` uses `../shared/llm`)
- **Import order** (informal, no enforced rule):
  1. External packages (`next`, `react`, `openai`, `fs/promises`, `path`)
  2. Internal `@/` aliases
  3. Relative imports (`./`, `../`)
  4. Type-only imports use `import type { ... }` syntax consistently
- **Re-exports**: Barrel files (`ai/flows/index.ts`, `ai/index.ts`) re-export public API and types from submodules
- **Type exports**: Heavy use of `export type { ... }` in barrel files to keep type-only boundaries clean

## Error Handling Patterns

### API Routes (`app/api/`)
- Outer `try/catch` wrapping the entire handler, returning `NextResponse.json({ error, code }, { status })` on failure
- Structured error responses with `error` (human message) and `code` (machine-readable) fields:
  ```ts
  return NextResponse.json(
    { error: "Project not found", code: "PROJECT_NOT_FOUND" },
    { status: 404 }
  );
  ```
- SSE streaming routes (`/api/ai`, `/api/projects/[id]/modify`) catch errors inside the stream controller and emit `{ type: "error", message }` events before closing
- `console.error("[TAG]", err)` used for server-side logging with bracketed context tags

### Library/AI Code
- `error instanceof Error ? error.message : String(error)` pattern used universally for safe error message extraction
- Functions that can fail gracefully return result objects with `success` boolean (e.g. `ToolResult`, `GenerateProjectResult`, `BuildRepairResult`)
- `try/catch` with empty catch blocks (`catch { /* ignore */ }`) used for non-critical operations (e.g. artifact logging, symlink creation)
- Path traversal protection: `setSiteRoot()` and `getSiteRoot()` validate paths stay within `WORKSPACE_ROOT/sites/`

### Client Components
- `try/catch` around `fetch()` calls with silent error handling (`catch { /* silently ignore */ }`) or setting error state
- `confirm()` dialogs for destructive actions (delete project)
- No React Error Boundaries observed in the codebase

## TypeScript Usage

- **Strict mode**: Enabled (`"strict": true` in `tsconfig.json`)
- **Target**: ES2017 with ESNext module system, bundler module resolution
- **`interface` vs `type`**: Interfaces for object shapes and contracts (`ProjectMetadata`, `BuildStep`, `ToolResult`); type aliases for unions, string literals, and mapped types (`VerificationStatus`, `ModelId`, `PreviewState`)
- **Generics**: Used in utility functions like `StepLogger.timed<T>()` and `timedWithTrace<T>()`
- **`as const`**: Used for constant objects (`MODELS` in `lib/config/models.ts`)
- **Type assertions**: Minimal — `as ModelId` in `getModelId()`, `as Record<string, unknown>` for JSON parsing
- **`unknown` over `any`**: Preferred — `blueprint?: unknown`, `modificationHistory: unknown[]`, catch clauses use `unknown`
- **Discriminated unions**: SSE event types use `type` field discriminator (`SSEEvent`, `ModifySSEEvent`)

## Component Patterns

### React Server Components (RSC) vs Client Components
- **Server Components** (default): `app/page.tsx`, `app/layout.tsx` — no `"use client"` directive, used for static/SSR pages
- **Client Components**: Explicitly marked with `"use client"` at top of file
  - All interactive pages: `app/projects/page.tsx`, `app/projects/[id]/page.tsx`, `app/build-studio/page.tsx`
  - All build-studio components: `app/build-studio/components/*.tsx`
  - Custom hooks: `app/build-studio/hooks/useBuildStudio.ts`
- **shadcn/ui components** (`components/ui/`): Follow shadcn conventions — function components, `cn()` utility, CVA for variants, `data-slot` attributes
- **Component composition**: Pages import and compose section components; sections are self-contained with no props

### State Management
- **No global state library** — React `useState`/`useEffect` hooks only
- **Custom hooks** encapsulate complex state logic (e.g. `useBuildStudio` manages build flow state, SSE streaming, timers)
- **Polling**: `setInterval` with cleanup for real-time updates (project list polls every 3s while generating)
- **AbortController**: Used for cancellable fetch requests in `useBuildStudio`

## Async Patterns

- **`async/await`** used exclusively — no raw `.then()` chains
- **`Promise.allSettled`**: Used for parallel section generation where partial failures are acceptable (`runSectionBatch`)
- **`Promise.all`**: Used for parallel page generation where all must succeed
- **SSE streaming**: `ReadableStream` with `TextEncoder` for server-to-client streaming in API routes; `ReadableStream.getReader()` for client-side consumption
- **Timed execution**: `StepLogger.timed()` wraps async operations with automatic timing and error logging

## Logging Patterns

- **Console logging**: `console.log("[prefix] ✓/✗ step: detail (+Xs)")` format in AI flow steps
- **Artifact logging**: `ArtifactLogger` writes JSON and text artifacts to `.open-ox/logs/generate_project/` for debugging
- **API route logging**: `console.error("[TAG]", err)` with bracketed route/module tags (e.g. `[AI API]`, `[GET /api/projects]`, `[projectManager]`)
- **No structured logging library** — all logging is `console.log`/`console.error`/`console.warn`

## Comment & Documentation Style

- **JSDoc-style comments**: Used on exported functions and modules, especially in `ai/` and `lib/` (e.g. `/** 处理建站请求 */`, `/** Returns the current dynamic site root directory. */`)
- **Module-level comments**: Chinese + English mix describing module purpose (e.g. `/** AI Engine - 建站 Flow 主入口 */`, `/** System Tools - 网站生成流程使用的工具执行入口 */`)
- **Inline comments**: Sparse, used for non-obvious logic (e.g. `// Must be free on both IPv4 and IPv6 interfaces`)
- **Bilingual**: Comments and UI strings mix Chinese (zh-CN) and English — Chinese for user-facing text and some module descriptions, English for technical comments
- **Architecture comments**: Block comments at top of complex files explaining design decisions (e.g. `runModifyProject.ts` has a multi-line architecture comment)
- **Section dividers**: `// ── Section Name ──────` style used in longer files (`runModifyProject.ts`, `devServerManager.ts`)
