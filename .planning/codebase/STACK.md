# Technology Stack — Open-OX

## Language & Runtime

- **TypeScript** `^5` — strict mode enabled, target ES2017
- **Node.js** — runtime (no explicit version pinned; uses `@types/node ^20`)
- **TSConfig**: `module: esnext`, `moduleResolution: bundler`, `jsx: react-jsx`, `incremental: true`
- Path alias: `@/*` → project root (`tsconfig.json`)
- Includes: `app/**`, `lib/**`, `ai/**`, `next.config.ts`

## Framework

- **Next.js** `16.1.6` — App Router (`app/` directory)
  - React Server Components enabled (`rsc: true` in `components.json`)
  - Config file: `next.config.ts` (currently minimal/empty)
  - Font optimization via `next/font/google` (Inter, JetBrains Mono, Space Grotesk)
- **React** `19.2.3` / **React DOM** `19.2.3`

## Monorepo / Workspace

- **pnpm** workspaces — `pnpm-workspace.yaml` includes `sites/*`
- Root project is the host app; each generated site lives under `sites/{projectId}/`
- Template scaffold at `sites/template/` is copied for new projects
- Shared dependencies are stripped from child `package.json` during `initProjectDir()`

## UI & Styling

- **Tailwind CSS** `^4` — via `@tailwindcss/postcss` plugin
  - PostCSS config: `postcss.config.mjs`
  - Global styles: `app/globals.css` (CSS variables, custom utilities, animations)
  - Tailwind v4 `@theme inline` block for design tokens
- **shadcn/ui** `^4.0.5` — component library config in `components.json`
  - Style: `radix-nova`, base color: `neutral`, icon library: `lucide`
  - Components installed to `components/ui/` (button, card, dialog, dropdown-menu, input)
- **Radix UI** `^1.4.3` — headless primitives (via shadcn)
- **Base UI** `@base-ui/react ^1.3.0`
- **Framer Motion** `^12.37.0` — animations
- **GSAP** `^3.14.2` — advanced animations (used in generated sites)
- **Lucide React** `^0.577.0` — icon library
- **Embla Carousel** `^8.6.0` — carousel component
- **Vaul** `^1.1.2` — drawer component
- **Sonner** `^2.0.7` — toast notifications
- **cmdk** `^1.1.1` — command palette
- **input-otp** `^1.4.2` — OTP input
- **react-day-picker** `^9.14.0` — date picker
- **react-resizable-panels** `^4.7.2` — resizable panel layouts
- **Recharts** `2.15.4` — charting library
- **next-themes** `^0.4.6` — dark/light theme switching
- **class-variance-authority** `^0.7.1` — variant-based class composition
- **clsx** `^2.1.1` — conditional class names
- **tailwind-merge** `^3.5.0` — Tailwind class deduplication
- **tailwindcss-animate** `^1.0.7` / **tw-animate-css** `^1.4.0` — animation utilities

## AI / LLM Dependencies

- **openai** `^4.77.0` — OpenAI-compatible SDK (used with configurable base URL)
- **gray-matter** `^4.0.3` — YAML frontmatter parsing for skill/prompt markdown files
- **diff** `^8.0.4` — line-level diff computation for the modify flow

## Build Tools

- **pnpm** — package manager (lockfile: `pnpm-lock.yaml`)
- **Next.js** built-in compiler — `next build` for production builds
- **ESLint** `^9` with `eslint-config-next 16.1.6` — core-web-vitals + TypeScript rules
  - Config: `eslint.config.mjs` (flat config format)
- **Prettier** `^3.8.1` — code formatting (dev dependency)
- **TypeScript** `^5` — type checking (`noEmit: true`, build via Next.js)

## Testing

- **Vitest** `^4.1.2` — test runner
  - Config: `vitest.config.ts` (environment: `node`, globals: `true`)
  - Path alias support via resolve config
- **@vitest/coverage-v8** `^4.1.2` — code coverage
- **fast-check** `^4.6.0` — property-based testing
- Test files: `lib/portAllocator.test.ts`, `ai/tools/system/common.property.test.ts`

## Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `next dev` | Development server |
| `build` | `next build` | Production build |
| `start` | `next start` | Production server |
| `lint` | `eslint` | Lint codebase |
| `clear:template` | `bash scripts/clear-template.sh` | Clear generated template files |

## Environment Configuration

- `.env.local` — local environment variables (gitignored)
- Key env vars (inferred from code):
  - `OPENAI_API_KEY` — API key for LLM provider
  - `OPENAI_API_URL` — custom base URL for OpenAI-compatible API
  - `OPENAI_MODEL` — model ID override (default: `gemini-3.1-pro-preview`)
  - `SITE_ROOT` — relative path to target site directory (e.g. `sites/template`)
- No `.env.example` file exists — env vars are documented only in code

## Project Structure

```
├── app/                    # Next.js App Router pages & API routes
│   ├── api/                # REST + SSE API endpoints
│   ├── build-studio/       # Build Studio UI (main generation interface)
│   └── projects/           # Project listing & detail pages
├── ai/                     # AI engine (LLM flows, prompts, tools)
│   ├── flows/              # generate_project, modify_project
│   ├── prompts/            # System prompts & skill markdown files
│   ├── shared/             # Shared utilities (skill discovery)
│   └── tools/              # System tools (write_file, exec_shell, etc.)
├── components/ui/          # shadcn/ui components
├── lib/                    # Core utilities
│   ├── config/models.ts    # LLM model configuration
│   ├── projectManager.ts   # Project CRUD & registry
│   ├── devServerManager.ts # Dev server lifecycle management
│   └── portAllocator.ts    # Port allocation for dev servers
├── sites/                  # pnpm workspace — generated project sites
│   └── template/           # Base template for new projects
├── public/                 # Static assets
└── scripts/                # Shell scripts
```
