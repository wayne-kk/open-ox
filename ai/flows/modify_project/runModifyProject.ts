/**
 * Modify Flow v6 — Stop Hook Architecture
 *
 * Modeled after Claude Code's query() loop:
 *   - LLM has FULL freedom: all tools available, tool_choice="auto"
 *   - while(true) loop: LLM calls API → executes tools → feeds results back
 *   - When LLM stops calling tools (wants to finish), stop hooks run
 *   - Stop hooks do quality gates: did it edit? did build pass?
 *   - If gates fail → inject error as message → loop continues
 *   - LLM is never restricted — it's guided by stop hooks
 */

import fs from "fs/promises";
import path from "path";
import { structuredPatch } from "diff";
import { setSiteRoot, clearSiteRoot } from "@/ai/tools/system/common";
import { getProject, getSiteRoot as pmGetSiteRoot, updateProjectStatus } from "@/lib/projectManager";
import type { ModificationRecord } from "@/lib/projectManager";
import { getSystemToolDefinitions } from "@/ai/tools/systemToolCatalog";
import { executeSystemTool } from "@/ai/tools";
import { chatCompletion, type ChatMessage } from "@/ai/flows/generate_project/shared/llm";
import { getModelId } from "@/lib/config/models";
import { createArtifactLogger } from "@/ai/flows/generate_project/shared/logging";
import type { ToolResult } from "@/ai/tools/types";

// ── Types ────────────────────────────────────────────────────────────────────

export type ModifySSEEvent =
  | { type: "step"; name: string; status: "running" | "done" | "error"; message?: string }
  | { type: "plan"; plan: { analysis: string; changes: Array<{ path: string; action: string; reasoning: string }> } }
  | { type: "diff"; file: string; reasoning: string; patch: string; stats: DiffStats }
  | { type: "tool_call"; tool: string; args: Record<string, unknown>; result: string }
  | { type: "done" }
  | { type: "error"; message: string };

interface DiffStats { additions: number; deletions: number }

// ── Helpers ──────────────────────────────────────────────────────────────────

async function tryReadFile(filePath: string): Promise<string | null> {
  try { return await fs.readFile(filePath, "utf-8"); } catch { return null; }
}

function computeDiff(filePath: string, oldContent: string, newContent: string): { patch: string; stats: DiffStats } {
  const s = structuredPatch(filePath, filePath, oldContent, newContent, "before", "after", { context: 3 });
  const stats: DiffStats = { additions: 0, deletions: 0 };
  const lines = [`--- ${s.oldHeader}`, `+++ ${s.newHeader}`];
  for (const h of s.hunks) {
    lines.push(`@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`);
    for (const l of h.lines) { lines.push(l); if (l[0] === "+") stats.additions++; else if (l[0] === "-") stats.deletions++; }
  }
  return { patch: lines.join("\n"), stats };
}

async function buildFileTree(dir: string): Promise<string> {
  const r: string[] = [];
  async function walk(d: string, p: string) {
    for (const e of await fs.readdir(d, { withFileTypes: true })) {
      if (["node_modules", ".next", ".git"].includes(e.name)) continue;
      const rel = p ? `${p}/${e.name}` : e.name;
      if (e.isDirectory()) { r.push(`${rel}/`); await walk(path.join(d, e.name), rel); }
      else r.push(rel);
    }
  }
  await walk(dir, "");
  return r.join("\n");
}

class FileSnapshotTracker {
  private snapshots = new Map<string, string>();
  constructor(private projectDir: string) { }
  async capture(relPath: string) {
    if (!this.snapshots.has(relPath))
      this.snapshots.set(relPath, await tryReadFile(path.join(this.projectDir, relPath)) ?? "");
  }
  async computeAllDiffs() {
    const diffs: Array<{ file: string; patch: string; stats: DiffStats }> = [];
    for (const [rel, old] of this.snapshots) {
      const cur = await tryReadFile(path.join(this.projectDir, rel)) ?? "";
      if (old !== cur) diffs.push({ file: rel, ...computeDiff(rel, old, cur) });
    }
    return diffs;
  }
  get touchedFiles() { return Array.from(this.snapshots.keys()); }
}

// ── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert Next.js/React developer. You modify existing projects by reading code, making precise edits, and verifying builds.

You have these tools:
- read_file: Read a file's content
- search_code: Search for patterns across the codebase (ripgrep)
- list_dir: List directory contents
- edit_file: Make precise edits (old_string → new_string replacement)
- write_file: Create new files
- run_build: Run the project build to verify changes

## How to work
Read the files you need, understand the code, make your edits, then verify with run_build.
Use edit_file for modifications (old_string must match exactly one location — include surrounding lines for uniqueness).
Use write_file only for brand new files.

## Project structure
- Pages: app/{slug}/page.tsx
- Sections: components/sections/{scope}_{Name}Section.tsx
- Layout: app/layout.tsx, components/sections/layout_*.tsx
- Styles: app/globals.css (Tailwind v4)
- Design tokens: design-system.md`;

// ── All tools, always available ──────────────────────────────────────────────

const ALL_TOOLS = ["read_file", "search_code", "list_dir", "edit_file", "write_file", "run_build"];

// ── Stop Hook: quality gate when LLM wants to stop ──────────────────────────

interface LoopState {
  hasEdited: boolean;
  hasBuild: boolean;
  buildPassed: boolean;
  lastBuildOutput: string;
}

/**
 * Runs when LLM stops calling tools. Returns null if task is complete,
 * or a blocking error message that gets injected back into the conversation.
 * This is the Claude Code "stop hook" pattern.
 */
function runStopHook(loopState: LoopState): string | null {
  if (!loopState.hasEdited) {
    return "You haven't made any changes yet. The user asked you to modify the project. Please read the relevant files and use edit_file to make the requested changes.";
  }
  if (!loopState.hasBuild) {
    return "You've made changes but haven't verified them. Please call run_build to check that the project still compiles.";
  }
  if (!loopState.buildPassed) {
    return `The build failed after your changes:\n\`\`\`\n${loopState.lastBuildOutput.slice(0, 2000)}\n\`\`\`\nPlease fix the errors using edit_file and run_build again.`;
  }
  // All gates passed — task is complete
  return null;
}

// ── Agent Loop ───────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 40;
const MAX_STOP_HOOK_RETRIES = 5; // max times stop hook can push back

async function runAgentLoop(
  messages: ChatMessage[],
  tracker: FileSnapshotTracker,
  onEvent: (event: ModifySSEEvent) => void,
): Promise<{ messages: ChatMessage[]; loopState: LoopState; iterations: number }> {
  const model = getModelId();
  const tools = getSystemToolDefinitions(ALL_TOOLS);
  const loopState: LoopState = { hasEdited: false, hasBuild: false, buildPassed: false, lastBuildOutput: "" };
  let iterations = 0;
  let stopHookRetries = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // ── Call LLM — full freedom, all tools, auto choice ──────────────────
    const res = await chatCompletion({
      model,
      messages,
      temperature: 0.1,
      tools,
      tool_choice: "auto",
    });

    const choice = res.choices[0];
    if (!choice?.message) break;
    const msg = choice.message;

    console.log(`[agent] iter=${iterations} tools=${msg.tool_calls?.length ?? 0} content=${(msg.content?.length ?? 0)} edited=${loopState.hasEdited} built=${loopState.hasBuild}`);

    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });

    // ── LLM wants to stop (no tool calls) → run stop hook ────────────────
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const blockingError = runStopHook(loopState);
      if (blockingError && stopHookRetries < MAX_STOP_HOOK_RETRIES) {
        stopHookRetries++;
        console.log(`[agent] stop hook blocked (retry ${stopHookRetries}/${MAX_STOP_HOOK_RETRIES}): ${blockingError.slice(0, 100)}`);
        messages.push({ role: "user", content: blockingError });
        continue; // Loop continues — LLM sees the error and tries again
      }
      break; // Either all gates passed, or we've retried enough
    }

    // ── Execute tool calls ───────────────────────────────────────────────
    for (const tc of msg.tool_calls) {
      const name = tc.function.name;
      let args: Record<string, unknown>;
      try { args = JSON.parse(tc.function.arguments ?? "{}"); } catch { args = {}; }

      // Snapshot before writes
      if ((name === "edit_file" || name === "write_file") && args.path) {
        await tracker.capture(args.path as string);
      }

      // Execute
      const result = await executeSystemTool(name, args);

      // Update loop state
      if (name === "edit_file" || name === "write_file") {
        if (typeof result === "object" ? result.success : true) loopState.hasEdited = true;
      }
      if (name === "run_build") {
        loopState.hasBuild = true;
        loopState.buildPassed = typeof result === "object" ? result.success : !String(result).includes("failed");
        loopState.lastBuildOutput = typeof result === "object" ? (result.output ?? result.error ?? "") : String(result);
      }

      // Stream to client
      const out = typeof result === "string" ? result : (result.success ? result.output ?? "ok" : result.error ?? "failed");
      onEvent({ type: "tool_call", tool: name, args, result: out.slice(0, 500) });

      // Feed result back to LLM
      messages.push({ role: "tool", tool_call_id: tc.id, content: typeof result === "string" ? result : JSON.stringify(result) });
    }

    stopHookRetries = 0; // Reset after successful tool use
  }

  return { messages, loopState, iterations };
}
