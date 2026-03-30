---
inclusion: manual
---

# gsd-map-codebase

Analyze codebase with parallel mapper agents to produce .planning/codebase/ documents

## 目标

Analyze existing codebase using parallel gsd-codebase-mapper agents to produce structured codebase documents.

Each mapper agent explores a focus area and **writes documents directly** to `.planning/codebase/`. The orchestrator only receives confirmations, keeping context usage minimal.

Output: .planning/codebase/ folder with 7 structured documents about the codebase state.

## 上下文

Focus area: (用户提供的参数) (optional - if provided, tells agents to focus on specific subsystem)

**Load project state if exists:**
Check for .planning/STATE.md - loads context if project already initialized

**This command can run:**
- Before /gsd-new-project (brownfield codebases) - creates codebase map first
- After /gsd-new-project (greenfield codebases) - updates codebase map as code evolves
- Anytime to refresh codebase understanding

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/map-codebase.md]]

## 执行流程

1. Check if .planning/codebase/ already exists (offer to refresh or skip)
2. Create .planning/codebase/ directory structure
3. Spawn 4 parallel gsd-codebase-mapper agents:
   - Agent 1: tech focus → writes STACK.md, INTEGRATIONS.md
   - Agent 2: arch focus → writes ARCHITECTURE.md, STRUCTURE.md
   - Agent 3: quality focus → writes CONVENTIONS.md, TESTING.md
   - Agent 4: concerns focus → writes CONCERNS.md
4. Wait for agents to complete, collect confirmations (NOT document contents)
5. Verify all 7 documents exist with line counts
6. Commit codebase map
7. Offer next steps (typically: /gsd-new-project or /gsd-plan-phase)

## 成功标准

- [ ] .planning/codebase/ directory created
- [ ] All 7 codebase documents written by mapper agents
- [ ] Documents follow template structure
- [ ] Parallel agents completed without errors
- [ ] User knows next steps
