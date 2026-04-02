/**
 * Modify Flow v3
 *
 * Architecture:
 *   Phase 1 — Plan: LLM analyzes instruction → outputs plan with reasoning per file
 *   Phase 2 — Execute: For each file, LLM outputs COMPLETE new content (not diffs)
 *   Phase 3 — Diff: Code computes real line-level diffs using `diff` library
 *
 * Key insight: LLM is good at writing code, bad at copying exact text.
 * So we let LLM write complete files, and compute diffs deterministically.
 */

import fs from "fs/promises";
import path from "path";
import { structuredPatch } from "diff";
import { setSiteRoot, clearSiteRoot } from "@/ai/tools/system/common";
import { getProject, getSiteRoot, updateProjectStatus } from "@/lib/projectManager";
import type { ModificationRecord } from "@/lib/projectManager";
import { callLLM, extractContent } from "@/ai/flows/generate_project/shared/llm";
import { stepRunBuild } from "@/ai/flows/generate_project/steps/runBuild";
import { createArtifactLogger } from "@/ai/flows/generate_project/shared/logging";

// ── Types ────────────────────────────────────────────────────────────────────

export type ModifySSEEvent =
  | { type: "step"; name: string; status: "running" | "done" | "error"; message?: string }
  | { type: "plan"; plan: ModificationPlan }
  | { type: "diff"; file: string; reasoning: string; patch: string; stats: DiffStats }
  | { type: "done" }
  | { type: "error"; message: string };

interface PlannedFileChange {
  path: string;
  action: "modify" | "create" | "delete";
  reasoning: string;
  dependsOn?: string[]; // paths of files that must be processed first
}

interface ModificationPlan {
  analysis: string;
  changes: PlannedFileChange[];
}

interface DiffStats {
  additions: number;
  deletions: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function tryReadFile(filePath: string): Promise<string | null> {
  try { return await fs.readFile(filePath, "utf-8"); } catch { return null; }
}

const CONTEXT_FILES = [
  "app/page.tsx", "app/globals.css", "app/layout.tsx", "design-system.md",
];

async function readProjectContext(projectDir: string, blueprint: unknown): Promise<string> {
  const parts: string[] = [];
  if (blueprint) {
    parts.push(`## Project Blueprint\n\`\`\`json\n${JSON.stringify(blueprint, null, 2)}\n\`\`\``);
  }
  parts.push("## Project Files");
  for (const relPath of CONTEXT_FILES) {
    const content = await tryReadFile(path.join(projectDir, relPath));
    if (content) parts.push(`### ${relPath}\n\`\`\`\n${content}\n\`\`\``);
  }

  // Read all sub-page files (app/[slug]/page.tsx) — not just home
  const appDir = path.join(projectDir, "app");
  try {
    const entries = await fs.readdir(appDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === "api") continue;
      const pagePath = path.join(appDir, entry.name, "page.tsx");
      const content = await tryReadFile(pagePath);
      if (content) parts.push(`### app/${entry.name}/page.tsx\n\`\`\`tsx\n${content}\n\`\`\``);
    }
  } catch { /* no sub-pages */ }

  // Read all section components (no arbitrary slice limit)
  const sectionsDir = path.join(projectDir, "components", "sections");
  try {
    const files = await fs.readdir(sectionsDir);
    for (const file of files) {
      const content = await tryReadFile(path.join(sectionsDir, file));
      if (content) parts.push(`### components/sections/${file}\n\`\`\`tsx\n${content}\n\`\`\``);
    }
  } catch { /* no sections dir */ }
  return parts.join("\n\n");
}

function computeDiff(filePath: string, oldContent: string, newContent: string): { patch: string; stats: DiffStats } {
  const structured = structuredPatch(filePath, filePath, oldContent, newContent, "before", "after", { context: 3 });
  const stats: DiffStats = { additions: 0, deletions: 0 };
  const lines: string[] = [
    `--- ${structured.oldHeader}`,
    `+++ ${structured.newHeader}`,
  ];
  for (const hunk of structured.hunks) {
    lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);
    for (const line of hunk.lines) {
      lines.push(line);
      if (line.startsWith("+")) stats.additions++;
      else if (line.startsWith("-")) stats.deletions++;
    }
  }
  return { patch: lines.join("\n"), stats };
}

// ── Phase 1: Plan ────────────────────────────────────────────────────────────

const PLAN_SYSTEM_PROMPT = `You are an expert Next.js developer analyzing a modification request.

Create a modification plan. For each file that needs to change, explain WHY.
If files depend on each other (e.g. file B imports a new component from file A),
declare the dependency so they are processed in the right order.

## Project file conventions
- Pages live in \`app/{slug}/page.tsx\` (Next.js App Router)
- Section components live in \`components/sections/{scope}_{Name}Section.tsx\`
  - scope = page slug (e.g. "home", "about") or "layout" for shared sections
- Layout sections (nav, footer) are in \`components/sections/layout_*.tsx\`
- The root layout is \`app/layout.tsx\` — it imports layout sections
- Each page imports its section components and composes them
- Styles are in \`app/globals.css\` (Tailwind v4)
- Design system doc is \`design-system.md\`

## When adding a new page
You must create:
1. Section component(s) in \`components/sections/{slug}_{Name}Section.tsx\`
2. Page file \`app/{slug}/page.tsx\` that imports and renders the sections
3. Modify the navigation section to add a link to the new page

## When adding a new section to an existing page
You must:
1. Create the section component in \`components/sections/{slug}_{Name}Section.tsx\`
2. Modify the page file \`app/{slug}/page.tsx\` (or \`app/page.tsx\` for home) to import and render it

Output a JSON object:
{
  "analysis": "2-3 sentences: what the user wants and your approach",
  "changes": [
    {
      "path": "relative/path/to/file.tsx",
      "action": "modify" | "create" | "delete",
      "reasoning": "1-2 sentences: why this file changes and what you'll do",
      "dependsOn": ["path/of/file/that/must/be/done/first.tsx"]
    }
  ]
}

Rules:
- Only include files that actually need to change
- Be specific: not "update styles" but "change hero gradient from dark to primary color"
- dependsOn is optional — only include it when file B needs to see file A's new content
- Output ONLY the JSON`;

async function generatePlan(contextStr: string, instruction: string): Promise<ModificationPlan> {
  const raw = await callLLM(PLAN_SYSTEM_PROMPT, `${contextStr}\n\n## Modification Instruction\n${instruction}`, 0.2);
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON");
    return JSON.parse(raw.slice(start, end + 1)) as ModificationPlan;
  } catch {
    return { analysis: "Failed to parse plan from LLM output", changes: [] };
  }
}

// ── Phase 2: Generate complete file content ──────────────────────────────────

const MODIFY_SYSTEM_PROMPT = `You are an expert Next.js/React developer.
You will receive an existing file and a modification instruction.
Output the COMPLETE updated file content.

Rules:
- Output ONLY the file content, no explanation
- Preserve all existing functionality unless the instruction says to change it
- Keep imports, types, and structure intact unless changes are needed
- Do not wrap in markdown code fences`;

const CREATE_SYSTEM_PROMPT = `You are an expert Next.js/React developer.
Create a new file based on the instruction.

Project conventions:
- Use Tailwind CSS for styling, use design system utility classes (ds-*) from globals.css
- Section components: export default function, accept no props, self-contained
- Page files: import section components, compose them in order, can export metadata
- Use "use client" only if the component needs hooks, event handlers, or browser APIs
- NEVER use <style jsx> — use Tailwind classes or inline styles only

Output ONLY the complete file content, no explanation, no markdown fences.`;

async function generateNewContent(
  projectDir: string,
  change: PlannedFileChange,
  instruction: string,
  completedChanges: Map<string, string>
): Promise<string> {
  // Build context from already-completed files in this batch
  const depContext = change.dependsOn?.length
    ? change.dependsOn
      .filter((dep) => completedChanges.has(dep))
      .map((dep) => `### ${dep} (already modified)\n\`\`\`\n${completedChanges.get(dep)}\n\`\`\``)
      .join("\n\n")
    : "";
  const depBlock = depContext ? `\n\n## Related files (already updated in this batch)\n${depContext}` : "";

  // Read design system + globals for style context (especially for create)
  const designSystem = await tryReadFile(path.join(projectDir, "design-system.md")) ?? "";
  const globalsCss = await tryReadFile(path.join(projectDir, "app/globals.css")) ?? "";
  const styleContext = (designSystem || globalsCss)
    ? `\n\n## Design System\n${designSystem}\n\n## Available CSS utilities\n\`\`\`css\n${globalsCss}\n\`\`\``
    : "";

  if (change.action === "create") {
    const raw = await callLLM(
      CREATE_SYSTEM_PROMPT,
      `Create file: ${change.path}\nPurpose: ${change.reasoning}\nInstruction: ${instruction}${styleContext}${depBlock}`,
      0.3
    );
    return extractContent(raw, change.path.endsWith(".tsx") ? "tsx" : "");
  }

  const currentContent = await tryReadFile(path.join(projectDir, change.path));
  if (!currentContent) {
    const raw = await callLLM(
      CREATE_SYSTEM_PROMPT,
      `Create file: ${change.path}\nPurpose: ${change.reasoning}\nInstruction: ${instruction}${depBlock}`,
      0.3
    );
    return extractContent(raw, change.path.endsWith(".tsx") ? "tsx" : "");
  }

  const raw = await callLLM(
    MODIFY_SYSTEM_PROMPT,
    `## File: ${change.path}\n\`\`\`\n${currentContent}\n\`\`\`\n\n## What to change\n${change.reasoning}\n\n## Instruction\n${instruction}${depBlock}`,
    0.2
  );
  return extractContent(raw, change.path.endsWith(".tsx") ? "tsx" : "");
}

// ── Dependency ordering ──────────────────────────────────────────────────────

function topoSort(changes: PlannedFileChange[]): PlannedFileChange[] {
  const byPath = new Map(changes.map((c) => [c.path, c]));
  const visited = new Set<string>();
  const result: PlannedFileChange[] = [];

  function visit(c: PlannedFileChange) {
    if (visited.has(c.path)) return;
    visited.add(c.path);
    for (const dep of c.dependsOn ?? []) {
      const depChange = byPath.get(dep);
      if (depChange) visit(depChange);
    }
    result.push(c);
  }

  for (const c of changes) visit(c);
  return result;
}

// ── Main entry ───────────────────────────────────────────────────────────────

export async function runModifyProject(
  projectId: string,
  userInstruction: string,
  onEvent: (event: ModifySSEEvent) => void
): Promise<void> {
  const artifactLogger = createArtifactLogger("modify_project");
  await artifactLogger.writeJson("run", "input", { projectId, userInstruction });

  // Step 1: Resolve project
  onEvent({ type: "step", name: "resolve_project", status: "running" });
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const projectDir = getSiteRoot(projectId);
  setSiteRoot(projectDir);
  onEvent({ type: "step", name: "resolve_project", status: "done" });

  // Wrap everything in try/finally so setSiteRoot is always reset,
  // even if the flow throws mid-way (problem 1 fix).
  try {
    // Step 2: Read context
    onEvent({ type: "step", name: "read_context", status: "running" });
    const contextStr = await readProjectContext(projectDir, project.blueprint ?? null);
    await artifactLogger.writeText("read_context", "context", contextStr, "md");
    onEvent({ type: "step", name: "read_context", status: "done" });

    // Step 3: Plan
    onEvent({ type: "step", name: "plan", status: "running" });
    const plan = await generatePlan(contextStr, userInstruction);
    await artifactLogger.writeJson("plan", "plan", plan);
    onEvent({ type: "plan", plan });
    onEvent({
      type: "step", name: "plan", status: "done",
      message: `${plan.analysis}\n→ ${plan.changes.length} file(s)`,
    });

    if (plan.changes.length === 0) {
      onEvent({ type: "step", name: "plan", status: "error", message: "No changes planned" });
      return;
    }

    // Step 4: Execute changes (in dependency order)
    const sortedChanges = topoSort(plan.changes);
    const touchedFiles: string[] = [];
    const completedChanges = new Map<string, string>(); // path → new content
    const collectedDiffs: Array<{ file: string; reasoning: string; patch: string; stats: DiffStats }> = [];

    for (const change of sortedChanges) {
      const stepName = `${change.action}:${change.path}`;
      onEvent({ type: "step", name: stepName, status: "running", message: change.reasoning });

      try {
        const absPath = path.resolve(projectDir, change.path);
        if (!absPath.startsWith(projectDir + path.sep) && absPath !== projectDir) {
          onEvent({ type: "step", name: stepName, status: "error", message: "Path traversal blocked" });
          continue;
        }

        if (change.action === "delete") {
          await fs.rm(absPath, { force: true });
          onEvent({
            type: "diff", file: change.path, reasoning: change.reasoning,
            patch: `File deleted`, stats: { additions: 0, deletions: 0 },
          });
          touchedFiles.push(change.path);
          onEvent({ type: "step", name: stepName, status: "done", message: "Deleted" });
          continue;
        }

        // Read old content (empty string for new files)
        const oldContent = await tryReadFile(absPath) ?? "";

        // LLM generates complete new content (with context from completed deps)
        const newContent = await generateNewContent(projectDir, change, userInstruction, completedChanges);

        // Compute real diff
        const { patch, stats } = computeDiff(change.path, oldContent, newContent);

        // Log everything
        const safeStepName = stepName.replace(/[/\\:]/g, "_");
        await artifactLogger.writeText(safeStepName, "old", oldContent, "tsx");
        await artifactLogger.writeText(safeStepName, "new", newContent, "tsx");
        await artifactLogger.writeText(safeStepName, "diff", patch, "diff");

        // Stream diff to client
        onEvent({ type: "diff", file: change.path, reasoning: change.reasoning, patch, stats });
        collectedDiffs.push({ file: change.path, reasoning: change.reasoning, patch, stats });

        // Write file
        await fs.mkdir(path.dirname(absPath), { recursive: true });
        await fs.writeFile(absPath, newContent, "utf-8");

        touchedFiles.push(change.path);
        completedChanges.set(change.path, newContent);
        onEvent({
          type: "step", name: stepName, status: "done",
          message: `+${stats.additions} -${stats.deletions} lines`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await artifactLogger.writeJson(stepName.replace(/[/\\:]/g, "_"), "error", { error: msg });
        onEvent({ type: "step", name: stepName, status: "error", message: msg });
      }
    }

    // Step 5: Build verification (problem 5 fix)
    onEvent({ type: "step", name: "run_build", status: "running" });
    const buildResult = await stepRunBuild();
    await artifactLogger.writeText("run_build", "output", buildResult.output, "log");
    onEvent({
      type: "step", name: "run_build",
      status: buildResult.success ? "done" : "error",
      message: buildResult.output.slice(0, 300),
    });

    // Step 6: Update registry
    onEvent({ type: "step", name: "update_registry", status: "running" });
    const record: ModificationRecord = {
      instruction: userInstruction,
      modifiedAt: new Date().toISOString(),
      touchedFiles,
      plan: { analysis: plan.analysis, changes: plan.changes },
      diffs: collectedDiffs,
    };
    const existingHistory = project.modificationHistory ?? [];
    await updateProjectStatus(projectId, "ready", {
      modificationHistory: [...existingHistory, record],
      verificationStatus: buildResult.success ? "passed" : "failed",
    });

    await artifactLogger.writeJson("run", "result", {
      projectId, instruction: userInstruction, touchedFiles,
      buildPassed: buildResult.success,
      logDirectory: artifactLogger.runDirRelative,
    });

    onEvent({
      type: "step", name: "update_registry", status: "done",
      message: `${touchedFiles.length} file(s): ${touchedFiles.join(", ")}`,
    });
  } finally {
    // Always reset SITE_ROOT regardless of success or failure (problem 1 fix)
    clearSiteRoot();
  }
}
