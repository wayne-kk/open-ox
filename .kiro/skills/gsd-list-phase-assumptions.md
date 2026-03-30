---
inclusion: manual
---

# gsd-list-phase-assumptions

Surface Claude's assumptions about a phase approach before planning

## 目标

Analyze a phase and present Claude's assumptions about technical approach, implementation order, scope boundaries, risk areas, and dependencies.

Purpose: Help users see what Claude thinks BEFORE planning begins - enabling course correction early when assumptions are wrong.
Output: Conversational output only (no file creation) - ends with "What do you think?" prompt

## 上下文

Phase number: (用户提供的参数) (required)

Project state and roadmap are loaded in-workflow using targeted reads.

## 工作流文件

- #[[file:.cursor/get-shit-done/workflows/list-phase-assumptions.md]]

## 执行流程

1. Validate phase number argument (error if missing or invalid)
2. Check if phase exists in roadmap
3. Follow list-phase-assumptions.md workflow:
   - Analyze roadmap description
   - Surface assumptions about: technical approach, implementation order, scope, risks, dependencies
   - Present assumptions clearly
   - Prompt "What do you think?"
4. Gather feedback and offer next steps

## 成功标准

- Phase validated against roadmap
- Assumptions surfaced across five areas
- User prompted for feedback
- User knows next steps (discuss context, plan phase, or correct assumptions)
