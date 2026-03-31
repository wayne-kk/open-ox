# Testing Conventions — Open-OX

## Test Framework & Configuration

- **Framework**: Vitest v4.1+ with `@vitest/coverage-v8` for coverage
- **Config file**: `vitest.config.ts`
  ```ts
  export default defineConfig({
    test: {
      environment: "node",
      globals: true,       // describe/it/expect available without imports
    },
    resolve: {
      alias: { "@": path.resolve(__dirname, ".") },
    },
  });
  ```
- **Environment**: Node (not jsdom) — no browser/DOM testing configured
- **Globals**: Enabled — `describe`, `it`, `expect`, `beforeEach` available without explicit import (though test files still import them from `vitest` for clarity)
- **Path aliases**: `@/*` alias configured to match `tsconfig.json`

## Property-Based Testing

- **Library**: fast-check v4.6+ (installed as devDependency)
- **Usage**: Property-based tests use `fc.assert()` with `fc.property()` combinators
- **Naming convention**: `*.property.test.ts` suffix
- **Existing file**: `ai/tools/system/common.property.test.ts`
- **Patterns observed**:
  - Custom arbitraries using `fc.stringMatching()` with regex constraints
  - `fc.pre()` for precondition filtering
  - `{ numRuns: 100 }` configuration for run count
  - `beforeEach` for state reset between property tests
  - Tests validate invariants across random inputs (path isolation, directory containment)

## Test File Locations & Naming

- **Co-located with source**: Test files live next to the code they test
  - `lib/portAllocator.test.ts` tests `lib/portAllocator.ts`
  - `ai/tools/system/common.property.test.ts` tests `ai/tools/system/common.ts`
- **Unit tests**: `*.test.ts` suffix
- **Property-based tests**: `*.property.test.ts` suffix
- **No dedicated `__tests__/` or `tests/` directories**

## Types of Tests Present

### Unit Tests
- `lib/portAllocator.test.ts` — Tests port allocation logic with real network binding
  - Uses `net.createServer()` to occupy ports and verify skip behavior
  - Tests edge cases: default port, custom start port, all ports occupied
  - Async cleanup with `finally` blocks

### Property-Based Tests
- `ai/tools/system/common.property.test.ts` — Tests multi-project workspace path isolation
  - Validates `setSiteRoot`/`getSiteRoot`/`resolvePath` invariants
  - Properties tested:
    1. `setSiteRoot` correctly sets root to `WORKSPACE_ROOT/sites/{projectId}`
    2. `resolvePath` always produces paths under current `SITE_ROOT`
    3. Paths for project A never start with root of project B
    4. `setSiteRoot` throws for paths outside `WORKSPACE_ROOT/sites/`
    5. `getSiteRoot()` reflects latest `setSiteRoot` value

## Mocking Patterns

- **No mocking framework** observed (no `vi.mock()`, `vi.spyOn()` usage in existing tests)
- Tests use **real implementations** — `portAllocator.test.ts` binds actual network ports
- Property tests use **real module functions** (`setSiteRoot`, `getSiteRoot`, `resolvePath`) with state reset via `beforeEach`
- No test doubles, stubs, or dependency injection patterns in existing tests

## Coverage Configuration

- **Coverage tool**: `@vitest/coverage-v8` installed as devDependency
- **No explicit coverage thresholds** configured in `vitest.config.ts`
- **No coverage scripts** in `package.json` — would need `vitest run --coverage`

## What IS Tested

| Area | File | What's Tested |
|------|------|---------------|
| Port allocation | `lib/portAllocator.test.ts` | `findAvailablePort()` — default port, skip occupied, custom start, range exhaustion |
| Path isolation | `ai/tools/system/common.property.test.ts` | `setSiteRoot`/`getSiteRoot`/`resolvePath` — multi-project workspace path safety invariants |

## What is NOT Tested

- **React components** — No component tests (no jsdom environment, no React Testing Library)
- **API routes** — No integration tests for `app/api/` endpoints
- **AI flows** — No tests for `runGenerateProject`, `runModifyProject`, or any step functions
- **LLM interactions** — No mocked LLM tests for `callLLM`, `callLLMWithTools`
- **SSE streaming** — No tests for event stream encoding/decoding
- **Project manager** — No tests for `createProject`, `deleteProject`, `initProjectDir`, registry read/write
- **Dev server manager** — No tests for `startDevServer`, `stopDevServer`, process lifecycle
- **UI components** — No tests for shadcn/ui components or build-studio components
- **Client hooks** — No tests for `useBuildStudio`
- **Content extraction** — No tests for `extractContent`, `extractJSON`, `sanitizeTsxContent`
- **Skill discovery** — No tests for `discoverSkills`, `discoverSkillsBySectionType`
- **E2E / Integration** — No Playwright, Cypress, or similar end-to-end test setup

## Test Running Commands

```bash
# Run all tests (single run)
pnpm vitest run

# Run tests in watch mode
pnpm vitest

# Run specific test file
pnpm vitest run lib/portAllocator.test.ts

# Run property-based tests only
pnpm vitest run --testPathPattern="property.test"

# Run with coverage (v8 provider installed)
pnpm vitest run --coverage
```

Note: No `test` script is defined in `package.json` — tests are run directly via `pnpm vitest`.

## CI/CD Configuration

- **No CI/CD pipeline found** — no `.github/workflows/`, no `.gitlab-ci.yml`, no `Jenkinsfile`, no `Dockerfile`
- Tests are run locally only
- Linting available via `pnpm lint` (defined in `package.json`)
