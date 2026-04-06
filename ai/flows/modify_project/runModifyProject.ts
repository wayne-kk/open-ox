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
import { executeSystemTool, clearFileReadTracking } from "@/ai/tools";
import { chatCompletion, type ChatMessage } from "@/ai/flows/generate_project/shared/llm";
import { getModifyModelId } from "@/lib/config/models";
import { createArtifactLogger } from "@/ai/flows/generate_project/shared/logging";
import { setRevertSnapshots, clearRevertSnapshots } from "@/ai/tools/system/revertFileTool";

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
  /** Expose snapshots for revert_file tool */
  get snapshotMap() { return this.snapshots; }
  get touchedFiles() { return Array.from(this.snapshots.keys()); }
}

// ── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert Next.js/React developer making SURGICAL, TARGETED modifications to existing projects.

## Core Principles
- Go straight to the point. Try the simplest approach first without going in circles. Do not overdo it.
- Do not propose changes to code you haven't read. Always read_file before edit_file.
- If an approach fails, diagnose WHY before switching tactics — read the error, check your assumptions, try a focused fix. Don't retry the identical action blindly, but don't abandon a viable approach after a single failure either.
- Don't add features, refactor code, or make "improvements" beyond what was asked.
- Keep your text output brief and direct. Lead with the action, not the reasoning.

## THINKING PROTOCOL (MANDATORY)
Before EVERY tool call, you MUST output a brief text explaining:
- What you know so far
- What you're about to do and why
- What you expect to find/achieve

This is non-negotiable. Tool calls without preceding analysis indicate poor engineering judgment.

## CRITICAL RULE: Only change what the user explicitly asked for
- If the user says "change the footer", ONLY modify footer-related files
- If the user provides an image, use it ONLY to understand the specific element they want changed — do NOT "fix" other things you notice in the image
- Do NOT refactor, improve, or touch files that are not directly related to the user's request
- Do NOT change styles, colors, or content in sections the user did not mention
- When in doubt, do LESS, not more

## Tools
- read_file: Read a file's content. Supports start_line/end_line for reading specific sections — use this instead of reading entire large files.
- search_code: Search for patterns across the codebase (ripgrep)
- list_dir: List directory contents
- edit_file: Make precise edits (old_string → new_string replacement)
- write_file: Create new files
- run_build: Run the project build to verify changes
- exec_shell: Run shell commands (grep, head, tail, cat, etc.) — useful for quick inspection without reading entire files
- think: Internal scratchpad — use to plan complex edits or analyze errors step by step BEFORE acting. No side effects.
- revert_file: Undo all changes to a file, restoring it to its state before this session. Use when your edits made things worse.

## Parallel Tool Calls
You can call multiple tools in a single response when they are independent. For example:
- Phase 1: Call search_code AND list_dir simultaneously
- Phase 2: Call read_file on 2 different files simultaneously
Do NOT parallelize dependent operations (e.g. don't edit_file and run_build in the same call).

## Understanding user intent
Users describe what they SEE on the page, not code internals. They will say things like:
- "那个极致性能的区块" → they mean a section that displays text about "performance" or "性能"
- "首页那个大标题太小了" → they mean the hero section's heading
- "导航栏的颜色不对" → they mean the layout header/navbar component
- "底部的版权信息" → they mean the footer section

Your job is to translate their visual description into the MINIMUM set of files to change.

## Workflow: 4-Phase Progressive Approach (MANDATORY)

### Phase 1: ORIENT (search + list)
Goal: Build a mental map. Do NOT read or edit files yet.
1. Extract keywords from the user's instruction (Chinese AND English — code may use either)
2. Use search_code to find those keywords in the codebase
3. Use list_dir on components/sections/ to see all section files
4. Output your findings: which files are candidates, which is most likely the target

### Phase 2: DEEP READ (read only the relevant files)
Goal: Understand the code structure before touching anything.
1. Read ONLY the 1-2 most relevant files identified in Phase 1
2. Output your analysis: what needs to change, what's the minimal edit
3. Do NOT re-read a file you've already read unless it was modified since

### Phase 3: EDIT (make the minimum changes)
Goal: Surgical modification.
1. Use edit_file with precise old_string → new_string
2. old_string must match EXACTLY one location (include surrounding lines for uniqueness)
3. If edit_file fails, analyze WHY before retrying — don't just tweak the old_string blindly

### Phase 4: VERIFY (build + self-check)
Goal: Prove it works.
1. Run run_build to verify compilation
2. If build fails, read the error carefully, identify root cause, then fix
3. Do NOT re-read the entire file just to make a small fix — use the error message to guide you

## Anti-Patterns (things you must NOT do)
- Reading the same file more than twice without editing it → you're stalling
- Editing the same file more than 3 times → you're probably fixing symptoms, not the root cause. Use think to analyze, or revert_file to start fresh.
- Making an edit, then immediately re-reading the same file → trust your edit, move to build
- Calling search_code after you've already found and read the target file → you're going backwards
- Making tool calls without any preceding text analysis → use think or output text explaining your reasoning

## edit_file rules
- old_string must match EXACTLY one location in the file (include surrounding lines for uniqueness)
- Use write_file only for brand new files
- Only edit files that are DIRECTLY related to the user's request

## If the user provides an image
- The image shows the CURRENT state of the page
- Use it to identify the SPECIFIC element the user wants changed
- Do NOT use it as a list of things to fix — only address what the user explicitly asked for

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

const ALL_TOOLS = ["read_file", "search_code", "list_dir", "edit_file", "write_file", "run_build", "exec_shell", "think", "revert_file"];

// ── Stop Hook: quality gate when LLM wants to stop ──────────────────────────

interface LoopState {
  hasEdited: boolean;
  hasSearched: boolean;
  hasBuild: boolean;
  buildPassed: boolean;
  lastBuildOutput: string;
  // Loop detection: track repeated file operations
  fileReadCounts: Map<string, number>;
  fileEditCounts: Map<string, number>;
  consecutiveSameFileOps: number;
  lastOperatedFile: string | null;
  // Phase tracking for progressive disclosure
  phase: "orient" | "read" | "edit" | "verify";
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
    // Check if we're stuck in a build-fix loop
    const totalEdits = Array.from(loopState.fileEditCounts.values()).reduce((a, b) => a + b, 0);
    if (totalEdits > 6) {
      return `The build is still failing after ${totalEdits} edits. You may be fixing symptoms, not the root cause.

STOP and use the "think" tool to analyze:
1. Re-read the build error carefully — what is the ACTUAL root cause?
2. Are you editing the right file? Maybe the issue is in a parent component, layout, or CSS.
3. Consider using revert_file to undo your changes and take a completely different approach.

Build output:
\`\`\`
${loopState.lastBuildOutput.slice(0, 2000)}
\`\`\``;
    }
    return `The build failed after your changes:\n\`\`\`\n${loopState.lastBuildOutput.slice(0, 2000)}\n\`\`\`\nPlease fix the errors using edit_file and run_build again.`;
  }
  return null;
}

// ── Agent Loop ───────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 40;
const MAX_STOP_HOOK_RETRIES = 5; // max times stop hook can push back

// ── Context Compression ──────────────────────────────────────────────────────
// Relevance-based compression: keeps recent messages + messages related to
// currently-edited files intact, compresses everything else.
const CONTEXT_COMPRESS_THRESHOLD = 50_000; // chars before compressing
const KEEP_RECENT_MESSAGES = 10;

function compressContext(messages: ChatMessage[], loopState?: LoopState): void {
  const totalChars = messages.reduce((sum, m) => {
    const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    return sum + content.length;
  }, 0);

  if (totalChars < CONTEXT_COMPRESS_THRESHOLD) return;

  // Build set of "hot" file paths — files we're actively editing
  const hotFiles = new Set<string>();
  if (loopState) {
    for (const [file, count] of loopState.fileEditCounts) {
      if (count > 0) hotFiles.add(file);
    }
    if (loopState.lastOperatedFile) hotFiles.add(loopState.lastOperatedFile);
  }

  const compressibleEnd = Math.max(2, messages.length - KEEP_RECENT_MESSAGES);
  for (let i = 1; i < compressibleEnd; i++) {
    const msg = messages[i];
    if (msg.role !== "tool" || typeof msg.content !== "string" || msg.content.length <= 300) continue;

    const content = msg.content as string;
    // Check if this tool result mentions a hot file — if so, keep it
    const mentionsHotFile = Array.from(hotFiles).some((f) => content.includes(f));
    if (mentionsHotFile) continue;

    // Compress: keep first 150 chars + last 50 chars for context
    const head = content.slice(0, 150);
    const tail = content.slice(-50);
    messages[i] = {
      ...msg,
      content: `${head}\n...[compressed: ${content.length} chars, not relevant to current edits]...\n${tail}`,
    };
  }
}

async function runAgentLoop(
  messages: ChatMessage[],
  tracker: FileSnapshotTracker,
  onEvent: (event: ModifySSEEvent) => void,
  userInstruction: string,
  modelOverride?: string,
): Promise<{ messages: ChatMessage[]; loopState: LoopState; iterations: number }> {
  const model = modelOverride || getModifyModelId();
  console.log(`[agent] using model: ${model}`);
  const tools = getSystemToolDefinitions(ALL_TOOLS);
  const loopState: LoopState = {
    hasEdited: false, hasSearched: false, hasBuild: false, buildPassed: false, lastBuildOutput: "",
    fileReadCounts: new Map(), fileEditCounts: new Map(),
    consecutiveSameFileOps: 0, lastOperatedFile: null,
    phase: "orient",
  };
  let iterations = 0;
  let stopHookRetries = 0;
  // Track why we continued — prevents infinite stop hook loops (Claude Code's transition pattern)
  let lastTransition: "initial" | "stop_hook_retry" | "tool_execution" = "initial";

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // Compress old tool results to prevent context blowout
    compressContext(messages, loopState);

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
          parallel_tool_calls: true,
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
        const filePath = args.path as string;
        if (filePath) {
          loopState.fileEditCounts.set(filePath, (loopState.fileEditCounts.get(filePath) ?? 0) + 1);
        }
      }
      if (name === "search_code" || name === "list_dir" || name === "read_file" || name === "exec_shell") {
        loopState.hasSearched = true;
        if (name === "read_file" && args.path) {
          const filePath = args.path as string;
          loopState.fileReadCounts.set(filePath, (loopState.fileReadCounts.get(filePath) ?? 0) + 1);
        }
      }
      if (name === "run_build") {
        loopState.hasBuild = true;
        loopState.buildPassed = typeof result === "object" ? result.success : !String(result).includes("failed");
        loopState.lastBuildOutput = typeof result === "object" ? (result.output ?? result.error ?? "") : String(result);
      }

      // Track consecutive operations on same file (loop detection)
      const opFile = args.path as string | undefined;
      if (opFile) {
        if (opFile === loopState.lastOperatedFile) {
          loopState.consecutiveSameFileOps++;
        } else {
          loopState.consecutiveSameFileOps = 1;
          loopState.lastOperatedFile = opFile;
        }
      }

      // Update phase based on what's happened
      if (!loopState.hasSearched) {
        loopState.phase = "orient";
      } else if (!loopState.hasEdited) {
        loopState.phase = "read";
      } else if (!loopState.hasBuild) {
        loopState.phase = "edit";
      } else {
        loopState.phase = "verify";
      }

      // Stream to client
      const out = typeof result === "string" ? result : (result.success ? result.output ?? "ok" : result.error ?? "failed");
      onEvent({ type: "tool_call", tool: name, args, result: out.slice(0, 500) });

      // Feed result back to LLM
      messages.push({ role: "tool", tool_call_id: tc.id, content: typeof result === "string" ? result : JSON.stringify(result) });
    }

    // ── Loop detection: inject nudge if agent is spinning on same file ───
    if (loopState.consecutiveSameFileOps >= 4) {
      const spinFile = loopState.lastOperatedFile;
      const readCount = loopState.fileReadCounts.get(spinFile!) ?? 0;
      const editCount = loopState.fileEditCounts.get(spinFile!) ?? 0;
      onEvent({ type: "thinking", content: `[loop detect] ${spinFile} read=${readCount} edit=${editCount} — injecting strategy nudge` });
      messages.push({
        role: "user",
        content: `⚠️ You've operated on "${spinFile}" ${readCount + editCount} times. You may be going in circles.

STOP. Call the "think" tool to analyze step by step:
1. What EXACTLY is the problem you're trying to solve right now?
2. What have you tried so far and why didn't it work?
3. Is the issue in this file, or could it be in a parent/sibling component, layout, or CSS?
4. Should you revert_file "${spinFile}" and take a completely different approach?

Use the think tool NOW before making any more edits.`,
      });
      loopState.consecutiveSameFileOps = 0; // Reset after nudge
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
  modelOverride?: string, // optional: explicit model override (bypasses global state)
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
    // Wire up revert_file tool to use tracker's snapshots
    setRevertSnapshots(tracker.snapshotMap);

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
⚠️ SCOPE: Only modify files directly related to the instruction above. Do not change other sections or files.
${imageBase64 ? "⚠️ IMAGE: Use the image only to identify the specific element mentioned in the instruction. Do not fix other things you see in the image.\n" : ""}
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

Please read the relevant files, make ONLY the requested changes, and verify with run_build.`;

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

    const { loopState, iterations } = await runAgentLoop(messages, tracker, collectingOnEvent, userInstruction, modelOverride);
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
    clearRevertSnapshots();
    clearFileReadTracking();
    clearSiteRoot();
  }
}
