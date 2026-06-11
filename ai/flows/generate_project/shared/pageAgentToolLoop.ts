/**
 * Page Agent tool-loop helpers: S2–S5 (compact tool results, guarded reads, compaction).
 */

import { executeSystemTool } from "@/ai/tools";
import type { ToolResult } from "@/ai/tools";
import type { ChatMessage } from "@/ai/shared/llm/types";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export const PAGE_AGENT_DEFAULT_MAX_ITERATIONS = 36;

/** Read-only tools available only after bootstrap or when lint/debug needs them. */
export const PAGE_AGENT_OBSERVE_TOOL_NAMES = new Set(["read_file", "list_dir", "search_code"]);

export const PAGE_AGENT_ACT_TOOL_NAMES = [
  "write_file",
  "edit_file",
  "read_lints",
  "think",
  "generate_image",
  "exec_shell",
  "install_package",
  "revert_file",
] as const;

export function normalizeAgentRelativePath(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.\//, "");
}

export function resolvePageAgentMaxIterations(): number {
  const raw = process.env.PAGE_IMPLEMENT_AGENT_MAX_ITERATIONS;
  const parsed = raw != null ? Number(raw) : PAGE_AGENT_DEFAULT_MAX_ITERATIONS;
  if (!Number.isFinite(parsed)) return PAGE_AGENT_DEFAULT_MAX_ITERATIONS;
  return Math.max(12, Math.min(96, parsed));
}

export function isPageAgentBatchFirstRoundEnabled(): boolean {
  const v = process.env.PAGE_IMPLEMENT_AGENT_BATCH_FIRST_ROUND;
  if (v === "1" || v === "true") return true;
  return false;
}

export function pageAgentCompactFromIteration(): number {
  const raw = process.env.PAGE_IMPLEMENT_AGENT_COMPACT_FROM_ITERATION;
  const parsed = raw != null ? Number(raw) : 8;
  if (!Number.isFinite(parsed) || parsed < 2) return 8;
  return Math.floor(parsed);
}

export function pageAgentReadMaxBytes(): number {
  const raw = process.env.PAGE_IMPLEMENT_AGENT_READ_MAX_BYTES;
  const parsed = raw != null ? Number(raw) : 12_000;
  if (!Number.isFinite(parsed) || parsed < 2_000) return 12_000;
  return Math.min(100_000, Math.floor(parsed));
}

export interface PageAgentSessionState {
  writtenPaths: string[];
  editedPaths: string[];
  toolNames: string[];
  /** When true, read_file / list_dir / search_code are exposed in the tool list. */
  allowObserveTools: boolean;
  bootstrapSummary: string;
  actNudgeSent: boolean;
}

export function createPageAgentSessionState(bootstrapSummary = ""): PageAgentSessionState {
  return {
    writtenPaths: [],
    editedPaths: [],
    toolNames: [],
    allowObserveTools: false,
    bootstrapSummary,
    actNudgeSent: false,
  };
}

export function shouldRunPageAgentCompaction(
  state: PageAgentSessionState,
  iteration: number,
  compactFromIteration: number
): boolean {
  if (state.writtenPaths.length === 0) return false;
  return iteration + 1 >= compactFromIteration;
}

export function filterPageAgentToolsForPhase(
  tools: ChatCompletionTool[],
  allowObserve: boolean
): ChatCompletionTool[] {
  if (allowObserve) return tools;
  return tools.filter((t) => {
    const name = t.function?.name;
    return !name || !PAGE_AGENT_OBSERVE_TOOL_NAMES.has(name);
  });
}

export function recordPageAgentToolCall(
  state: PageAgentSessionState,
  name: string,
  args: Record<string, unknown>
): void {
  state.toolNames.push(name);
  const path = normalizeAgentRelativePath(args.path);
  if (!path) return;
  if (name === "write_file") {
    if (!state.writtenPaths.includes(path)) state.writtenPaths.push(path);
  }
  if (name === "edit_file") {
    if (!state.editedPaths.includes(path)) state.editedPaths.push(path);
  }
}

function countLinesFromWriteArgs(args: Record<string, unknown>): number | null {
  const content = args.content;
  if (typeof content !== "string") return null;
  return content.split("\n").length;
}

function diagnosticsExcerpt(result: ToolResult, max = 600): string {
  if (result.diagnostics?.length) {
    const lines = result.diagnostics
      .slice(0, 6)
      .map((d) => `${d.file}:${d.line} ${d.message}`);
    return truncateForToolMessage(lines.join("\n"), max);
  }
  if (result.output && result.meta?.verifyErrorCount) {
    return truncateForToolMessage(result.output, max);
  }
  return "";
}

function truncateForToolMessage(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

/** S2 — shorten tool payloads returned to the model (Page Agent only). */
export function formatPageAgentToolResultForModel(info: {
  name: string;
  args: Record<string, unknown>;
  result: ToolResult | string;
}): string {
  const { name, args, result } = info;

  if (typeof result === "string") {
    return truncateForToolMessage(result, 800);
  }

  if (!result.success) {
    return JSON.stringify({
      success: false,
      error: result.error ?? "tool failed",
      ...(result.output ? { output: truncateForToolMessage(result.output, 400) } : {}),
    });
  }

  const path = normalizeAgentRelativePath(args.path ?? result.meta?.path ?? "");

  if (name === "write_file") {
    const lines = countLinesFromWriteArgs(args);
    const errN = Number(result.meta?.verifyErrorCount ?? 0);
    const warnN = Number(result.meta?.verifyWarningCount ?? 0);
    if (errN === 0 && !result.diagnostics?.length) {
      const linePart = lines != null ? `${lines} lines` : "ok";
      return `✓ wrote ${path || "(file)"} (${linePart}, 0 errors${warnN ? `, ${warnN} warnings` : ""})`;
    }
    const excerpt = diagnosticsExcerpt(result);
    return `✓ wrote ${path} with ${errN} error(s)${warnN ? `, ${warnN} warning(s)` : ""}${excerpt ? `\n${excerpt}` : ""}`;
  }

  if (name === "edit_file") {
    const errN = Number(result.meta?.verifyErrorCount ?? 0);
    const added = result.meta?.addedLines;
    const removed = result.meta?.removedLines;
    const delta =
      typeof added === "number" && typeof removed === "number"
        ? `+${added}/-${removed} lines`
        : "patched";
    if (errN === 0 && !result.diagnostics?.length) {
      return `✓ edited ${path || "(file)"} (${delta}, 0 errors)`;
    }
    const excerpt = diagnosticsExcerpt(result);
    return `✓ edited ${path} (${delta}, ${errN} error(s))${excerpt ? `\n${excerpt}` : ""}`;
  }

  if (name === "read_file" && typeof result.output === "string") {
    return truncateForToolMessage(result.output, pageAgentReadMaxBytes());
  }

  if (name === "read_lints" || name === "search_code" || name === "list_dir") {
    const out = result.output ?? "";
    return truncateForToolMessage(typeof out === "string" ? out : JSON.stringify(out), 2_000);
  }

  if (result.output && typeof result.output === "string") {
    return truncateForToolMessage(result.output, 1_200);
  }

  return JSON.stringify({
    success: true,
    ...(result.meta ? { meta: result.meta } : {}),
  });
}

/** Cap read_file payload returned to the model on subsequent turns (Page Agent only). */
export function createBootstrapGuardedReadExecutor(
  bootstrappedPaths: Set<string>
): (args: Record<string, unknown>) => Promise<ToolResult | string> {
  return async (args: Record<string, unknown>) => {
    const path = normalizeAgentRelativePath(args.path);
    if (path && bootstrappedPaths.has(path)) {
      return {
        success: true,
        output:
          `Already in workspace bootstrap — do not re-read \`${path}\`. ` +
          `Use write_file / edit_file for the target page, then page_implementation_complete.`,
      };
    }
    return executePageAgentReadFile(args);
  };
}

/** list_dir for trees already in bootstrap — steer agent to write. */
export function createBootstrapGuardedListDirExecutor(
  bootstrappedPaths: Set<string>
): (args: Record<string, unknown>) => Promise<ToolResult | string> {
  return async (args: Record<string, unknown>) => {
    const path = normalizeAgentRelativePath(args.path ?? ".");
    const isBootstrapTree =
      path === "" ||
      path === "." ||
      path === "app" ||
      path === "components" ||
      path.startsWith("app/") ||
      path.startsWith("components/");
    if (isBootstrapTree && bootstrappedPaths.size > 0) {
      return {
        success: true,
        output:
          "Directory tree is in the workspace bootstrap message. Do not list again — write the target page.",
      };
    }
    return executePageAgentListDir(args);
  };
}

export async function executePageAgentReadFile(
  args: Record<string, unknown>
): Promise<ToolResult | string> {
  const result = await executeSystemTool("read_file", args);
  if (typeof result === "string") {
    return truncateForToolMessage(result, pageAgentReadMaxBytes());
  }
  if (result.success && typeof result.output === "string") {
    return {
      ...result,
      output: truncateForToolMessage(result.output, pageAgentReadMaxBytes()),
    };
  }
  return result;
}

/** @deprecated Alias — list_dir is no longer blocked for Page Agent. */
export async function executePageAgentListDir(
  args: Record<string, unknown>
): Promise<ToolResult | string> {
  return executeSystemTool("list_dir", args);
}

/** S5 — collapse middle turns after first write; re-inject bootstrap summary. */
export function compactPageAgentMessages(
  messages: ChatMessage[],
  state: PageAgentSessionState,
  options?: { keepRecent?: number; bootstrapSummary?: string; preserveHeadCount?: number }
): void {
  const keepRecent = options?.keepRecent ?? 6;
  const preserveHeadCount = options?.preserveHeadCount ?? 2;
  if (messages.length <= preserveHeadCount + keepRecent) return;

  const head = messages.slice(0, preserveHeadCount);
  const tail = messages.slice(-keepRecent);

  const written =
    state.writtenPaths.length > 0 ? state.writtenPaths.join(", ") : "(none yet)";
  const edited =
    state.editedPaths.length > 0 ? state.editedPaths.join(", ") : "(none)";
  const bootstrapNote =
    options?.bootstrapSummary?.trim() ||
    state.bootstrapSummary.trim() ||
    "Bootstrap context was provided earlier — do not re-read those files.";

  const summary: ChatMessage = {
    role: "system",
    content:
      `[Context compacted — earlier tool turns omitted from prompt]\n` +
      `${bootstrapNote}\n` +
      `- Files written: ${written}\n` +
      `- Files edited: ${edited}\n` +
      `- Do NOT re-read bootstrap paths. Finish \`app/page.tsx\` (or target route) and call page_implementation_complete.`,
  };

  messages.splice(0, messages.length, ...head, summary, ...tail);
}
