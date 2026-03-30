# Open-OX Directory Structure

## Root Layout

```
open-ox/
├── app/                    # Next.js 16 App Router — host application
├── ai/                     # AI generation engine (flows, prompts, tools)
├── components/             # Shared UI components (shadcn/ui)
├── lib/                    # Server-side infrastructure services
├── sites/                  # pnpm workspace: generated site projects
├── scripts/                # Shell scripts
├── docs/                   # Architecture documentation
├── example/                # Example artifacts (design-system.md)
├── public/                 # Static assets for host app
├── .open-ox/               # Runtime state (project registry, logs, dev server state)
├── package.json            # Root package (Next.js 16, OpenAI SDK, shadcn, Tailwind)
├── pnpm-workspace.yaml     # Workspace config: packages: ["sites/*"]
├── next.config.ts          # Next.js configuration
├── tsconfig.json           # TypeScript configuration
├── vitest.config.ts        # Test configuration (Vitest + fast-check)
├── eslint.config.mjs       # ESLint configuration
├── postcss.config.mjs      # PostCSS configuration
├── components.json         # shadcn/ui configuration
└── .env.local              # Environment variables (API keys, model config)
```

## `app/` — Next.js App Router (Host Application)

```
app/
├── layout.tsx              # Root layout (Inter, JetBrains Mono, Space Grotesk fonts)
├── page.tsx                # Landing page — routes to /build-studio
├── globals.css             # Global styles (Tailwind v4, DeFi theme)
├── favicon.ico
│
├── build-studio/           # Primary creation interface
│   ├── page.tsx            # Build Studio page (prompt input + generation atlas)
│   ├── components/
│   │   ├── BuildConversation.tsx    # Prompt input + response display
│   │   ├── GenerationAtlas.tsx      # Real-time build step visualization
│   │   ├── BlueprintOverview.tsx    # Blueprint data display
│   │   ├── DetailDrawer.tsx         # Step detail drawer
│   │   ├── EventStream.tsx          # SSE event stream display
│   │   ├── PannableCanvas.tsx       # Pannable canvas for atlas
│   │   ├── StageColumn.tsx          # Build stage column
│   │   ├── StepNode.tsx             # Individual step node
│   │   ├── StepRow.tsx              # Step row display
│   │   ├── TracePanel.tsx           # LLM trace inspection panel
│   │   └── ui/                      # Build-studio-specific UI components
│   ├── hooks/
│   │   └── useBuildStudio.ts        # Main hook: manages generation state + SSE
│   ├── lib/
│   │   ├── build-studio-api.ts      # API client: runBuildSite(), clearTemplate()
│   │   └── narratives.ts            # Step narrative text
│   └── types/
│       └── build-studio.ts          # TypeScript types (BuildStep, AiResponse, etc.)
│
├── projects/               # Project management pages
│   ├── page.tsx            # Project dashboard (list all projects)
│   └── [id]/
│       └── page.tsx        # Project detail: iframe preview + modify panel
│
└── api/                    # API Route Handlers
    ├── ai/
    │   └── route.ts        # POST — generate project (SSE stream)
    ├── projects/
    │   ├── route.ts        # GET — list all projects
    │   └── [id]/
    │       ├── route.ts    # GET/PATCH/DELETE — project CRUD
    │       ├── preview/
    │       │   └── route.ts    # POST/DELETE — start/stop dev server
    │       └── modify/
    │           └── route.ts    # POST — modify project (SSE stream)
    ├── dev-servers/
    │   └── route.ts        # GET/DELETE — list/stop dev servers
    └── clear-template/
        └── route.ts        # POST — clear generated template files
```

## `ai/` — AI Generation Engine

```
ai/
├── index.ts                # Main entry: processInput(), re-exports
│
├── flows/
│   ├── index.ts            # Re-exports from generate_project
│   │
│   ├── generate_project/   # Full website generation pipeline
│   │   ├── index.ts
│   │   ├── runGenerateProject.ts   # Main orchestrator (step sequencing, repair loop)
│   │   ├── types.ts                # All type definitions (Blueprint, Section, Build, etc.)
│   │   │
│   │   ├── steps/                  # Individual pipeline steps
│   │   │   ├── analyzeProjectRequirement.ts   # User prompt → ProjectBlueprint
│   │   │   ├── planProject.ts                 # Blueprint → PlannedProjectBlueprint
│   │   │   ├── generateProjectDesignSystem.ts # → design-system.md
│   │   │   ├── applyProjectDesignTokens.ts    # → globals.css + tailwind tokens
│   │   │   ├── generateSection.ts             # → individual .tsx section component
│   │   │   ├── selectComponentSkills.ts       # Skill selection for sections
│   │   │   ├── composeLayout.ts               # → app/layout.tsx
│   │   │   ├── composePage.ts                 # → app/{slug}/page.tsx
│   │   │   ├── installDependencies.ts         # Auto-install missing packages
│   │   │   ├── runBuild.ts                    # Execute next build
│   │   │   └── repairBuild.ts                 # LLM-driven build error repair
│   │   │
│   │   ├── prompts/                # Markdown prompt templates
│   │   │   ├── steps/             # Step-level prompts
│   │   │   │   ├── analyzeProjectRequirement.md
│   │   │   │   ├── planProject.md
│   │   │   │   ├── generateProjectDesignSystem.md
│   │   │   │   ├── applyProjectDesignTokens.md
│   │   │   │   ├── composeLayout.md
│   │   │   │   ├── composePage.md
│   │   │   │   ├── repairBuild.md
│   │   │   │   └── dependencyResolver.md
│   │   │   ├── sections/          # Section-type prompts (convention: section.{type}.md)
│   │   │   │   ├── section.hero.md
│   │   │   │   ├── section.features.md
│   │   │   │   ├── section.pricing.md
│   │   │   │   ├── section.testimonials.md
│   │   │   │   ├── section.faq.md
│   │   │   │   ├── section.cta.md
│   │   │   │   ├── section.stats.md
│   │   │   │   ├── section.navigation.md
│   │   │   │   ├── section.footer.md
│   │   │   │   └── section.default.md         # Fallback for unknown types
│   │   │   ├── skills/            # Component variant skills (YAML frontmatter + prompt)
│   │   │   │   ├── component.hero.dashboard.md
│   │   │   │   ├── component.hero.editorial.md
│   │   │   │   ├── component.hero.impactful.md
│   │   │   │   ├── component.hero.lighting.md
│   │   │   │   └── component.hero.particle.md
│   │   │   ├── rules/             # Cross-cutting constraint prompts
│   │   │   │   ├── section.core.md
│   │   │   │   ├── section.accessibility.md
│   │   │   │   ├── section.styles.md
│   │   │   │   ├── section.typography.md
│   │   │   │   ├── section.layout.md
│   │   │   │   ├── section.above-fold.md
│   │   │   │   ├── section.interactive.md
│   │   │   │   ├── project.accessibility.md
│   │   │   │   ├── project.consistency.md
│   │   │   │   ├── outputJson.md
│   │   │   │   └── outputTsx.md
│   │   │   ├── layouts/           # Layout variant patterns
│   │   │   │   ├── hero.centered.md
│   │   │   │   ├── hero.split.md
│   │   │   │   ├── features.grid.md
│   │   │   │   ├── pricing.three-tier.md
│   │   │   │   └── faq.two-column.md
│   │   │   ├── motions/           # Animation/motion patterns
│   │   │   │   ├── motion.ambient.md
│   │   │   │   ├── motion.energetic.md
│   │   │   │   └── motion.subtle.md
│   │   │   └── capabilities/      # Capability-specific patterns
│   │   │       ├── pattern.hero.dashboard.md
│   │   │       └── pattern.hero.editorial.md
│   │   │
│   │   ├── selectors/
│   │   │   └── sectionPromptSelector.ts   # Convention-based: section.{type}.md → fallback
│   │   ├── planners/
│   │   │   └── defaultProjectPlanner.ts   # Default planning strategy
│   │   ├── registry/
│   │   │   └── layoutSections.ts          # Identifies layout vs page sections
│   │   └── shared/
│   │       ├── files.ts           # File I/O, prompt loading, validation markers
│   │       ├── llm.ts            # LLM call wrapper (OpenAI SDK)
│   │       ├── logging.ts        # Step logger + artifact logger
│   │       └── paths.ts          # Path conventions (slug→page, section file paths)
│   │
│   └── modify_project/
│       └── runModifyProject.ts    # 3-phase modify: Plan → Execute → Diff
│
├── tools/
│   ├── index.ts                   # Re-exports executeSystemTool
│   ├── types.ts                   # ToolDefinition, ToolResult, ToolExecutor
│   ├── systemTools.ts             # Tool executor registry
│   ├── systemToolCatalog.ts       # OpenAI function-calling tool definitions
│   └── system/                    # Individual tool implementations
│       ├── common.ts              # WORKSPACE_ROOT, SITE_ROOT, resolvePath()
│       ├── writeFileTool.ts       # Write file (scoped to SITE_ROOT)
│       ├── readFileTool.ts        # Read file
│       ├── listDirTool.ts         # List directory
│       ├── searchCodeTool.ts      # Search code
│       ├── execShellTool.ts       # Execute shell command
│       ├── installPackageTool.ts  # Install npm package
│       ├── formatCodeTool.ts      # Format code (Prettier)
│       ├── runBuildTool.ts        # Run next build
│       └── common.property.test.ts # Property tests for path safety
│
├── shared/
│   ├── index.ts                   # Re-exports skill discovery
│   └── skillDiscovery.ts          # Scan .md files, parse YAML frontmatter → SkillMetadata
│
└── prompts/
    └── systems/
        └── frontend.md            # System-level frontend prompt
```


## `lib/` — Infrastructure Services

```
lib/
├── projectManager.ts       # Project CRUD, registry I/O, template copying
│                           #   createProject(), initProjectDir(), updateProjectStatus()
│                           #   deleteProject(), getSiteRoot(), writeRegistry()
├── devServerManager.ts     # Dev server lifecycle management
│                           #   startDevServer(), stopDevServer(), getDevServerStatus()
│                           #   Persists to .open-ox/dev-servers.json
├── portAllocator.ts        # Port scanning (3100–3200 range)
│                           #   findAvailablePort() — checks IPv4 + IPv6
├── clearTemplate.ts        # Removes AI-generated files from site directory
├── utils.ts                # General utilities (cn() for Tailwind class merging)
├── config/
│   └── models.ts           # LLM model registry (Gemini 3.1 Pro, GPT-5.2, etc.)
│                           #   getModelId() reads OPENAI_MODEL env var
└── atlas/
    ├── parseSteps.ts       # Build step parsing utilities
    └── types.ts            # Atlas type definitions
```

## `sites/` — Generated Website Projects (pnpm Workspace)

```
sites/
├── template/               # Golden template — cloned for each new project
│   ├── app/
│   │   ├── layout.tsx      # Base layout (overwritten by AI)
│   │   ├── globals.css     # Base styles (overwritten by AI)
│   │   └── favicon.ico
│   ├── components/
│   │   ├── ui/             # shadcn/ui components (copied to projects)
│   │   └── sections/       # Empty — AI generates section components here
│   ├── hooks/
│   │   └── use-mobile.ts
│   ├── lib/
│   │   └── utils.ts
│   ├── public/             # Static assets
│   ├── package.json        # Site-level dependencies
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── design-system.md    # Overwritten by AI
│   ├── components.json     # shadcn/ui config
│   └── pnpm-workspace.yaml
│
└── {timestamp}_{slug}/     # Generated project (e.g., 2026-03-30T03-46-10-704Z_)
    ├── app/
    │   ├── layout.tsx      # AI-generated layout (imports layout sections)
    │   ├── page.tsx        # AI-generated home page
    │   ├── globals.css     # AI-generated styles + design tokens
    │   └── {slug}/         # Additional pages (e.g., about/, pricing/)
    │       └── page.tsx
    ├── components/
    │   ├── ui/             # Copied from template
    │   └── sections/       # AI-generated section components
    │       ├── layout_NavigationSection.tsx
    │       ├── layout_FooterSection.tsx
    │       ├── home_HeroSection.tsx
    │       ├── home_FeaturesSection.tsx
    │       └── {slug}_{Name}Section.tsx
    ├── design-system.md    # AI-generated design system document
    ├── package.json        # Stripped of shared root deps
    └── ... (same structure as template)
```

## `.open-ox/` — Runtime State

```
.open-ox/
├── projects.json           # Project registry (array of ProjectMetadata)
│                           #   { id, name, userPrompt, status, createdAt, blueprint, ... }
├── dev-servers.json        # Active dev server state
│                           #   [{ projectId, port, url, pid }]
└── logs/
    └── generate_project/   # Per-run artifact logs
        └── {run-id}/       # JSON + text artifacts for each step
            ├── run/input.json
            ├── analyze_project_requirement/output.json
            ├── plan_project/output.json
            ├── generate_section:home:HeroSection/output.json
            └── run/result.json
```

## `components/` — Shared UI Components (Host App)

```
components/
└── ui/                     # shadcn/ui components used by host app
    ├── button.tsx
    ├── card.tsx
    ├── dialog.tsx
    ├── dropdown-menu.tsx
    └── input.tsx
```

## Other Directories

```
docs/                       # Architecture documentation
├── architecture-core.md
├── architecture-section-prompts.md
├── architecture-skill-selector.md
└── section-skill-rules.md

example/                    # Example artifacts
└── design-system.md        # Sample design system output

scripts/
└── clear-template.sh       # Shell script to clear template

public/                     # Host app static assets
├── file.svg, globe.svg, next.svg, vercel.svg, window.svg
```

## Naming Conventions

### Files
- **Pages**: `app/{slug}/page.tsx` (Next.js App Router convention)
- **API routes**: `app/api/{resource}/route.ts`
- **Section components**: `components/sections/{scope}_{PascalName}Section.tsx`
  - `scope` = page slug (`home`, `about`, `pricing`) or `layout` for shared sections
  - Example: `home_HeroSection.tsx`, `layout_NavigationSection.tsx`
- **Prompt files**: `{category}.{type}.md` (e.g., `section.hero.md`, `component.hero.dashboard.md`)
- **Step files**: named after the step function (e.g., `analyzeProjectRequirement.ts` → `analyzeProjectRequirement.md`)
- **Tool files**: `{name}Tool.ts` (e.g., `writeFileTool.ts`)

### Project IDs
Format: `{ISO-timestamp}_{slug}` where timestamp has colons/dots replaced with hyphens.
Example: `2026-03-30T03-46-10-704Z_my-project-name`

### Prompt Organization
Prompts use a dot-separated naming convention that maps to directory structure:
- `section.hero` → `prompts/sections/section.hero.md`
- `component.hero.dashboard` → `prompts/skills/component.hero.dashboard.md`
- `motion.ambient` → `prompts/motions/motion.ambient.md`

## Generated vs Static Content Boundaries

| Content | Location | Origin |
|---|---|---|
| Host app UI | `app/`, `components/ui/` | Static (developer-written) |
| API routes | `app/api/` | Static (developer-written) |
| AI engine | `ai/` | Static (developer-written) |
| Infrastructure | `lib/` | Static (developer-written) |
| Prompt templates | `ai/flows/generate_project/prompts/` | Static (developer-written) |
| Site template | `sites/template/` | Static (developer-written base) |
| Generated sites | `sites/{id}/` | **AI-generated** (cloned from template, then AI writes into) |
| Project registry | `.open-ox/projects.json` | **Runtime-generated** |
| Dev server state | `.open-ox/dev-servers.json` | **Runtime-generated** |
| Build logs | `.open-ox/logs/` | **Runtime-generated** |
| Design system docs | `sites/{id}/design-system.md` | **AI-generated** |
| Section components | `sites/{id}/components/sections/*.tsx` | **AI-generated** |
| Page files | `sites/{id}/app/**/page.tsx` | **AI-generated** |
| Layout file | `sites/{id}/app/layout.tsx` | **AI-generated** |
| Global styles | `sites/{id}/app/globals.css` | **AI-generated** |

## Workspace Structure

The pnpm workspace (`pnpm-workspace.yaml`) declares `sites/*` as workspace packages. This means:
- The root `package.json` holds shared dependencies (Next.js, React, Tailwind, OpenAI SDK, etc.)
- Each `sites/{id}/package.json` only declares site-specific dependencies not already in root
- `initProjectDir()` in `lib/projectManager.ts` strips shared deps from the cloned template's `package.json`
- Generated sites can add their own dependencies via the `installDependencies` step (e.g., `gsap`, `framer-motion`)
- Each site runs its own `next dev` process on a unique port (3100–3200 range)
