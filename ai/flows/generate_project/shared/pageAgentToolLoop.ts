/**
 * Page Agent tool-loop helpers: S2–S5 (compact tool results, guarded reads, compaction).
 */

import { executeSystemTool } from "@/ai/tools";
import type { ToolResult } from "@/ai/tools";
import type { ChatMessage } from "@/ai/shared/llm/types";

export const PAGE_AGENT_DEFAULT_MAX_ITERATIONS = 24;

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
  if (v === "0" || v === "false") return false;
  return true;
}

export function pageAgentCompactFromIteration(): number {
  const raw = process.env.PAGE_IMPLEMENT_AGENT_COMPACT_FROM_ITERATION;
  const parsed = raw != null ? Number(raw) : 5;
  if (!Number.isFinite(parsed) || parsed < 2) return 5;
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
}

export function createPageAgentSessionState(): PageAgentSessionState {
  return { writtenPaths: [], editedPaths: [], toolNames: [] };
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

/** S5 — collapse middle turns; keep system + user + recent tail. */
export function compactPageAgentMessages(
  messages: ChatMessage[],
  state: PageAgentSessionState,
  options?: { keepRecent?: number }
): void {
  const keepRecent = options?.keepRecent ?? 6;
  if (messages.length <= 2 + keepRecent) return;

  const head = messages.slice(0, 2);
  const tail = messages.slice(-keepRecent);

  const written =
    state.writtenPaths.length > 0 ? state.writtenPaths.join(", ") : "(none yet)";
  const edited =
    state.editedPaths.length > 0 ? state.editedPaths.join(", ") : "(none)";

  const summary: ChatMessage = {
    role: "system",
    content:
      `[Context compacted — earlier tool turns omitted from prompt]\n` +
      `- Files written: ${written}\n` +
      `- Files edited: ${edited}\n` +
      `- Re-read on-disk references only if you lost context; otherwise continue fixing and call page_implementation_complete.`,
  };

  messages.splice(0, messages.length, ...head, summary, ...tail);
}
