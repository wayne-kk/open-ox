/**
 * Modify Flow v7 — Claude Code-inspired Agent Loop
 *
 * Architecture based on Claude Code's query() loop (docs/claude-code/01-agent-loop.md):
 *
 * Key design decisions from Claude Code:
 *   1. First iteration forces tool_choice="required" — agent MUST act before thinking
 *   2. Stop hooks with transition tracking — prevents infinite retry loops
 *   3. Context-aware stop hooks — extract keywords from user instruction to guide recovery
 *   4. Conversation memory — DB-persisted + session history, deduplicated, capped at 10 turns
 *   5. LLM thinking streamed to client — user always sees what the agent is doing
 *   6. Error recovery — chatCompletion failures caught and reported, never silent
 *
 * Loop lifecycle (per Claude Code's four-layer model):
 *   Layer 1: runModifyProject() — session-level state (project, history, siteRoot)
 *   Layer 2: Context building — file tree, design system, conversation memory
 *   Layer 3: runAgentLoop() — core while(true) with stop hooks
 *   Layer 4: Tool execution — sequential, with snapshot tracking for diffs
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
import { getModifyModelId } from "@/lib/config/models";
import { createArtifactLogger } from "@/ai/flows/generate_project/shared/logging";

// ── Types ────────────────────────────────────────────────────────────────────

export type ModifySSEEvent =
  | { type: "step"; name: string; status: "running" | "done" | "error"; message?: string }
  | { type: "plan"; plan: { analysis: string; changes: Array<{ path: string; action: string; reasoning: string }> } }
  | { type: "diff"; file: string; reasoning: string; patch: string; stats: DiffStats }
  | { type: "tool_call"; tool: string; args: Record<string, unknown>; result: string }
  | { type: "thinking"; content: string }
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

const SYSTEM_PROMPT = `You are an expert Next.js/React developer modifying existing projects.

## Tools
- read_file: Read a file's content
- search_code: Search for patterns across the codebase (ripgrep)
- list_dir: List directory contents
- edit_file: Make precise edits (old_string → new_string replacement)
- write_file: Create new files
- run_build: Run the project build to verify changes

## Understanding user intent
Users describe what they SEE on the page, not code internals. They will say things like:
- "那个极致性能的区块" → they mean a section that displays text about "performance" or "性能"
- "首页那个大标题太小了" → they mean the hero section's heading
- "导航栏的颜色不对" → they mean the layout header/navbar component
- "底部的版权信息" → they mean the footer section

Your job is to translate their visual description into code locations:
1. Extract keywords from their instruction (both Chinese and English — the code may use either)
2. Use search_code to find those keywords in the codebase (try the Chinese text first, then English equivalents)
3. Use list_dir on components/sections/ to see all available sections
4. Read the matching files to confirm which one the user is referring to
5. Make the changes and verify with run_build

## Workflow (MANDATORY — you must follow this order)
Step 1: SEARCH — Use search_code with keywords from the user's instruction. Also list_dir components/sections/ to see all section files.
Step 2: READ — Use read_file on the files you found to understand the code.
Step 3: EDIT — Use edit_file to make changes. old_string must match exactly one location.
Step 4: BUILD — Use run_build to verify.

You MUST complete at least Step 1 before you can stop. If you stop without using any tools, you will be asked to try again.

## edit_file rules
- old_string must match EXACTLY one location in the file (include surrounding lines for uniqueness)
- Use write_file only for brand new files

## Conversation memory
You may receive a "Previous Modifications" section listing past user instructions and their results.
Use this to understand context: what was already changed, what the user might be referring to with vague follow-ups.

## Project structure
- Pages: app/{slug}/page.tsx
- Sections: components/sections/{scope}_{Name}Section.tsx (e.g. home_PerformanceSection.tsx)
- Layout: app/layout.tsx, components/sections/layout_*.tsx
- Styles: app/globals.css (Tailwind v4)
- Design tokens: design-system.md

## If you cannot complete the task
After searching and reading, if you still cannot determine what to change, you MUST respond with:
1. What keywords you searched for
2. What files you found and examined
3. Your best guess at what the user means
4. A specific question to help narrow it down (e.g. "I found 3 sections with '性能' — do you mean the PerformanceSection or the BenchmarkSection?")
Never give a generic "I couldn't do it" response.`;

// ── All tools, always available ──────────────────────────────────────────────

const ALL_TOOLS = ["read_file", "search_code", "list_dir", "edit_file", "write_file", "run_build"];

// ── Stop Hook: quality gate when LLM wants to stop ──────────────────────────

interface LoopState {
  hasEdited: boolean;
  hasSearched: boolean;
  hasBuild: boolean;
  buildPassed: boolean;
  lastBuildOutput: string;
}

/**
 * Runs when LLM stops calling tools. Returns null if task is complete,
 * or a blocking error message that gets injected back into the conversation.
 * userInstruction is passed so the stop hook can extract keywords for guidance.
 */
function runStopHook(loopState: LoopState, userInstruction: string): string | null {
  if (!loopState.hasSearched && !loopState.hasEdited) {
    // Extract keywords from user instruction to guide the LLM
    const keywords = userInstruction
      .replace(/[，。！？、\s]+/g, " ")
      .split(" ")
      .filter((w) => w.length >= 2)
      .slice(0, 5);
    const keywordList = keywords.map((k) => `"${k}"`).join(", ");

    return `You stopped without using any tools. This is not allowed.

You MUST search the codebase first. The user said: "${userInstruction}"

Try these steps NOW:
1. Call list_dir with path "components/sections" to see all section files
2. Call search_code with keywords from the user's instruction: ${keywordList}
3. If Chinese keywords don't match, try English equivalents (e.g. 性能→Performance, 导航→Nav, 标题→title/heading)

Do NOT respond with text only. Use tools.`;
  }
  if (!loopState.hasEdited) {
    return `You searched but didn't make any changes. The user asked you to modify something.

If you found the relevant files, read them and make the edits now.
If you're unsure which component the user means, explain what you found and ask a specific question — but include the file names you discovered so the user can point you to the right one.

Do not give up without explaining your search results.`;
  }
  if (!loopState.hasBuild) {
    return "You've made changes but haven't verified them. Please call run_build to check that the project still compiles.";
  }
  if (!loopState.buildPassed) {
    return `The build failed after your changes:\n\`\`\`\n${loopState.lastBuildOutput.slice(0, 2000)}\n\`\`\`\nPlease fix the errors using edit_file and run_build again.`;
  }
  return null;
}

// ── Agent Loop ───────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 40;
const MAX_STOP_HOOK_RETRIES = 5; // max times stop hook can push back

async function runAgentLoop(
  messages: ChatMessage[],
  tracker: FileSnapshotTracker,
  onEvent: (event: ModifySSEEvent) => void,
  userInstruction: string,
): Promise<{ messages: ChatMessage[]; loopState: LoopState; iterations: number }> {
  const model = getModifyModelId();
  const tools = getSystemToolDefinitions(ALL_TOOLS);
  const loopState: LoopState = { hasEdited: false, hasSearched: false, hasBuild: false, buildPassed: false, lastBuildOutput: "" };
  let iterations = 0;
  let stopHookRetries = 0;
  // Track why we continued — prevents infinite stop hook loops (Claude Code's transition pattern)
  let lastTransition: "initial" | "stop_hook_retry" | "tool_execution" = "initial";

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // ── Determine tool_choice — force tools on first iteration ───────────
    // Claude Code's philosophy: always act first, think later.
    // First iteration: tool_choice="required" — LLM MUST call a tool.
    // After stop hook retry: "required" — LLM was told to use tools, enforce it.
    // After tool execution: "auto" — LLM has context now, let it decide.
    const toolChoice = (iterations === 1 || lastTransition === "stop_hook_retry")
      ? "required" as const
      : "auto" as const;

    // ── Call LLM with retry for transient errors ──────────────────────
    let res;
    const MAX_LLM_RETRIES = 2;
    for (let attempt = 0; attempt <= MAX_LLM_RETRIES; attempt++) {
      try {
        res = await chatCompletion({
          model,
          messages,
          temperature: 0.1,
          tools,
          tool_choice: toolChoice,
        });
        break; // success
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isRetryable = /400|429|500|502|503|504|ETIMEDOUT|ECONNRESET|Thought signature/i.test(errMsg);
        if (isRetryable && attempt < MAX_LLM_RETRIES) {
          const delayMs = 1000 * (attempt + 1);
          console.warn(`[agent] chatCompletion failed (attempt ${attempt + 1}/${MAX_LLM_RETRIES + 1}), retrying in ${delayMs}ms:`, errMsg);
          onEvent({ type: "thinking", content: `[LLM Retry] Attempt ${attempt + 1} failed: ${errMsg.slice(0, 200)}. Retrying...` });
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        console.error(`[agent] chatCompletion failed at iter=${iterations} (no more retries):`, errMsg);
        onEvent({ type: "thinking", content: `[LLM Error] ${errMsg}` });
        res = null;
        break;
      }
    }
    if (!res) break;

    const choice = res.choices?.[0];
    if (!choice?.message) {
      console.error(`[agent] empty response at iter=${iterations}:`, JSON.stringify(res).slice(0, 500));
      onEvent({ type: "thinking", content: `[LLM Error] Empty response from model (no choices). Raw: ${JSON.stringify(res).slice(0, 300)}` });
      break;
    }
    const msg = choice.message;

    console.log(`[agent] iter=${iterations} tc=${toolChoice} tools=${msg.tool_calls?.length ?? 0} content=${(msg.content?.length ?? 0)} edited=${loopState.hasEdited} built=${loopState.hasBuild}`);

    messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: msg.tool_calls });

    // ── Stream LLM thinking content to client ────────────────────────────
    if (msg.content && msg.content.trim()) {
      onEvent({ type: "thinking", content: msg.content });
    }

    // ── Always stream iteration debug info to client ─────────────────────
    const toolNames = msg.tool_calls?.map((tc) => tc.function.name).join(", ") || "none";
    onEvent({
      type: "thinking",
      content: `[iter ${iterations}] tool_choice=${toolChoice}, tools=[${toolNames}], content_len=${msg.content?.length ?? 0}, finish_reason=${choice.finish_reason}`,
    });

    // ── LLM wants to stop (no tool calls) → run stop hook ────────────────
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      onEvent({ type: "thinking", content: `[iter ${iterations}] LLM stopped calling tools. hasSearched=${loopState.hasSearched}, hasEdited=${loopState.hasEdited}, hasBuild=${loopState.hasBuild}` });
      const blockingError = runStopHook(loopState, userInstruction);
      if (blockingError && stopHookRetries < MAX_STOP_HOOK_RETRIES) {
        stopHookRetries++;
        lastTransition = "stop_hook_retry";
        onEvent({ type: "thinking", content: `[stop hook] retry ${stopHookRetries}/${MAX_STOP_HOOK_RETRIES}: ${blockingError.slice(0, 200)}` });
        console.log(`[agent] stop hook blocked (retry ${stopHookRetries}/${MAX_STOP_HOOK_RETRIES}): ${blockingError.slice(0, 100)}`);
        messages.push({ role: "user", content: blockingError });
        continue;
      }
      if (blockingError) {
        onEvent({ type: "thinking", content: `[stop hook] max retries reached (${MAX_STOP_HOOK_RETRIES}). Giving up.` });
      } else {
        onEvent({ type: "thinking", content: `[stop hook] all gates passed. Task complete.` });
      }
      break;
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
      if (name === "search_code" || name === "list_dir" || name === "read_file") {
        loopState.hasSearched = true;
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

    lastTransition = "tool_execution";
    stopHookRetries = 0; // Reset after successful tool use
  }

  return { messages, loopState, iterations };
}

// ── Main Export ──────────────────────────────────────────────────────────────

export async function runModifyProject(
  projectId: string,
  userInstruction: string,
  onEvent: (event: ModifySSEEvent) => void,
  conversationHistory?: Array<{ instruction: string; summary: string }>,
  clearContext = false,
  imageBase64?: string, // optional: base64-encoded image (data URL or raw base64)
): Promise<void> {
  const artifactLogger = createArtifactLogger("modify_project");
  await artifactLogger.writeJson("run", "input", { projectId, userInstruction });

  // Step 1: Resolve project
  onEvent({ type: "step", name: "resolve_project", status: "running" });
  const project = await getProject(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const projectDir = pmGetSiteRoot(projectId);
  setSiteRoot(projectDir);
  onEvent({ type: "step", name: "resolve_project", status: "done" });

  try {
    // Step 2: Build context
    onEvent({ type: "step", name: "read_context", status: "running" });
    const fileTree = await buildFileTree(projectDir);
    const designSystem = await tryReadFile(path.join(projectDir, "design-system.md")) ?? "";
    const globalsCss = await tryReadFile(path.join(projectDir, "app/globals.css")) ?? "";
    onEvent({ type: "step", name: "read_context", status: "done" });

    // Step 3: Run agent loop
    onEvent({ type: "step", name: "agent_loop", status: "running" });
    const tracker = new FileSnapshotTracker(projectDir);

    // Collect toolCalls and thinking for persistence
    const collectedToolCalls: Array<{ tool: string; args: Record<string, unknown>; result: string }> = [];
    const collectedThinking: string[] = [];
    const collectingOnEvent = (event: ModifySSEEvent) => {
      if (event.type === "tool_call") {
        collectedToolCalls.push({ tool: event.tool, args: event.args, result: event.result });
      } else if (event.type === "thinking") {
        collectedThinking.push(event.content);
      }
      onEvent(event);
    };

    // ── Build conversation context from history ──────────────────────────
    const dbHistory = clearContext ? [] : (project.modificationHistory ?? []).map((r) => ({
      instruction: r.instruction,
      summary: r.plan?.analysis
        ? `${r.plan.analysis} Files: ${r.touchedFiles.join(", ")}`
        : `Modified ${r.touchedFiles.length} file(s): ${r.touchedFiles.join(", ")}`,
    }));
    const sessionHistory = conversationHistory ?? [];

    // Deduplicate: session history may overlap with DB history
    const seenInstructions = new Set(dbHistory.map((h) => h.instruction));
    const mergedHistory = [
      ...dbHistory,
      ...sessionHistory.filter((h) => !seenInstructions.has(h.instruction)),
    ];

    // Build context string — compact summaries, most recent N turns
    const MAX_HISTORY_TURNS = 10;
    const recentHistory = mergedHistory.slice(-MAX_HISTORY_TURNS);
    const historyContext = recentHistory.length > 0
      ? `\n## Previous Modifications (conversation memory)\n${recentHistory.map((h, i) => `${i + 1}. User: "${h.instruction}"\n   Result: ${h.summary}`).join("\n")}\n`
      : "";

    const userMessage = `## User Instruction
${userInstruction}
${historyContext}
## Project File Tree
\`\`\`
${fileTree}
\`\`\`

## Design System
${designSystem.slice(0, 2000)}

## Current globals.css (first 1000 chars)
\`\`\`css
${globalsCss.slice(0, 1000)}
\`\`\`

Please read the relevant files, make the requested changes, and verify with run_build.`;

    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: imageBase64
          ? [
            {
              type: "image_url" as const,
              image_url: {
                url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/png;base64,${imageBase64}`,
                detail: "high" as const,
              },
            },
            { type: "text" as const, text: userMessage },
          ]
          : userMessage,
      },
    ];

    const { loopState, iterations } = await runAgentLoop(messages, tracker, collectingOnEvent, userInstruction);
    collectingOnEvent({
      type: "step", name: "agent_loop",
      status: loopState.buildPassed ? "done" : (loopState.hasEdited ? "error" : "done"),
      message: `${iterations} iterations, edited=${loopState.hasEdited}, build=${loopState.buildPassed ? "passed" : "failed"}`,
    });

    // Step 4: Compute diffs and emit
    const diffs = await tracker.computeAllDiffs();
    for (const d of diffs) {
      onEvent({ type: "diff", file: d.file, reasoning: userInstruction, patch: d.patch, stats: d.stats });
    }

    // Emit plan summary — use LLM's own analysis, never hardcoded fallback
    // Collect all assistant messages with content (LLM thinking across all iterations)
    const allThinking = messages
      .filter((m) => m.role === "assistant" && typeof m.content === "string" && m.content.trim().length > 0)
      .map((m) => (m.content as string).trim())
      .join("\n\n");

    const analysisText = diffs.length > 0
      ? `Agent made ${diffs.length} file change(s) in ${iterations} iterations.`
      : allThinking.length > 0
        ? allThinking.slice(0, 2000)
        : `Agent ran ${iterations} iterations but made no changes. The LLM did not provide an explanation.`;

    onEvent({
      type: "plan",
      plan: {
        analysis: analysisText,
        changes: diffs.map((d) => ({ path: d.file, action: "modify", reasoning: `+${d.stats.additions} -${d.stats.deletions}` })),
      },
    });

    // Step 5: Update registry
    onEvent({ type: "step", name: "update_registry", status: "running" });
    const touchedFiles = diffs.map((d) => d.file);
    const record: ModificationRecord = {
      instruction: userInstruction,
      modifiedAt: new Date().toISOString(),
      touchedFiles,
      plan: {
        analysis: `${diffs.length} file(s) modified`,
        changes: diffs.map((d) => ({ path: d.file, action: "modify", reasoning: `+${d.stats.additions} -${d.stats.deletions}` })),
      },
      diffs: diffs.map((d) => ({ file: d.file, reasoning: userInstruction, patch: d.patch, stats: d.stats })),
      // Persist agent trace for conversation history (truncate to keep DB size reasonable)
      toolCalls: collectedToolCalls.map((tc) => ({
        tool: tc.tool,
        args: tc.args,
        result: tc.result.slice(0, 500),
      })),
      thinking: collectedThinking.map((t) => t.slice(0, 500)),
      image: imageBase64 ? (imageBase64.length > 200_000 ? imageBase64.slice(0, 200_000) : imageBase64) : null,
    };
    const existingHistory = project.modificationHistory ?? [];
    await updateProjectStatus(projectId, "ready", {
      modificationHistory: [...existingHistory, record],
      verificationStatus: loopState.buildPassed ? "passed" : "failed",
    });
    onEvent({
      type: "step", name: "update_registry", status: "done",
      message: `${touchedFiles.length} file(s): ${touchedFiles.join(", ")}`,
    });

    await artifactLogger.writeJson("run", "result", {
      projectId, instruction: userInstruction, touchedFiles,
      buildPassed: loopState.buildPassed, iterations,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[modify] runModifyProject error:", errMsg);
    onEvent({ type: "step", name: "agent_loop", status: "error", message: errMsg });
    onEvent({ type: "error", message: errMsg });
  } finally {
    clearSiteRoot();
  }
}
