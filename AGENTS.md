## Agent skills

### Issue tracker

Issues live as markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles mapped to default label strings (recorded as `Status:` in issue files). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Verification policy

Use risk-based, incremental verification. Do not run the entire test suite after every change.

- During implementation, run only the tests directly related to the changed module or reproduced bug.
- For an isolated module change, run its focused tests and TypeScript checks when relevant.
- Run the full test suite only once before final delivery when changes affect shared infrastructure, core generation flows, queues, cross-cutting behavior, or when the user explicitly requests it.
- For documentation, copy, configuration-only, or narrowly scoped visual changes, do not run the full test suite unless there is a concrete regression risk.
- Avoid repeating a full test run if an equivalent run already passed and no relevant code changed afterward.
- Report focused and full-suite verification separately so the user can see what was actually exercised.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

**Keep this block, including in commits.** It is part of the project's agent setup, maintained by `next dev` for every agent that works here. If it appears as an uncommitted change, that is intentional — commit it as-is. Do not remove it to clean up a diff; it will be regenerated.
<!-- END:nextjs-agent-rules -->
