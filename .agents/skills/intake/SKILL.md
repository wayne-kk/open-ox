---
name: intake
description: Intake a new idea or need — who hurts, why now, constraints, success — before any plan or PRD.
disable-model-invocation: true
---

# Intake

Run an **intake** interview until we share a clear view of the **problem space**. Stay in the problem space: who is hurting, what fails today, why it matters now, what must stay true, and how we will know we succeeded. Solution shape, module seams, and implementation belong later — hand those to `/grilling` then `/to-prd`.

## Process

### 1. Orient

If the user named a rough idea, restate it in one sentence and ask them to correct it. If the area already has glossary terms or ADRs, load them and use that vocabulary. If a *fact* about the current product lives in the codebase, look it up rather than asking.

**Done when:** one corrected problem sentence is on the table.

### 2. Interview (one question at a time)

Walk the problem space one decision at a time. For each question, give your recommended answer, then wait. Cover every facet below before leaving this step — skip a facet only when the user already settled it in this conversation:

| Facet | What to pin down |
| --- | --- |
| Actor | Who feels the pain (role, not "the user") |
| Pain | What breaks or costs them today |
| Trigger | Why this matters *now* |
| Success | Observable outcome that means we shipped the right thing |
| Constraints | Hard limits (platform, time, compliance, existing UX) |
| Non-goals | What we will refuse even if asked later |
| Open questions | What we still cannot answer without research or a prototype |

Prefer questions that expose trade-offs over questions that invite feature lists.

**Done when:** every facet has an explicit answer or an explicit "unknown → next skill" note, and the user has responded to the last question.

### 3. Publish an Intake Brief

Write the brief in the chat (do not publish to the issue tracker — that is `/to-prd`). Use this shape:

```markdown
## Intake Brief

### Problem
<one paragraph, user perspective>

### Actors & pain
- ...

### Why now
<trigger>

### Success looks like
- <observable outcomes>

### Constraints
- ...

### Non-goals
- ...

### Open questions
- <item> → research | prototype | decide in grilling
```

Ask the user to confirm or correct the brief.

**Done when:** the user confirms the brief (or a corrected version) as shared understanding.

### 4. Hand off

Stop. Suggest the next skill only:

- Open questions that need facts → `/research` or `/prototype`
- Brief confirmed, ready to shape a plan → `/grilling` (then `/to-prd`)
- Brief already is a plan the user wants to stress-test → `/grilling` directly

Do not write a PRD, do not open issues, and do not start implementation in this skill.
