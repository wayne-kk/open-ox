import type { ToolResult } from "@/ai/tools";
import type { ToolSemantics } from "./types";

const MUTATIONS = new Set([
  "create_file", "write_file", "apply_file_patch", "edit_file", "replace_file",
  "create_target_page", "create_page_component", "replace_page_file",
]);
const OBSERVATIONS = new Set([
  "read_file", "read_file_snapshot", "read_page_file", "search_code", "list_dir", "glob",
]);
const VERIFICATIONS = new Set(["verify_files", "verify_page_files", "typecheck", "lint"]);
const TRANSITIONS = new Set(["yield_to_user", "commit_generate"]);

function parsed(value: ToolResult | string): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value) as unknown; } catch { return value; }
}

export function inferToolSemantics(
  toolName: string,
  args: unknown,
  result: ToolResult | string,
): ToolSemantics {
  const value = parsed(result);
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const success = record.success === true || record.ok === true;
  const diagnostics = Array.isArray(record.diagnostics)
    ? record.diagnostics
    : record.output && typeof record.output === "object" && Array.isArray((record.output as Record<string, unknown>).diagnostics)
      ? (record.output as Record<string, unknown>).diagnostics as unknown[]
      : [];
  const argRecord = args && typeof args === "object" ? args as Record<string, unknown> : {};
  const path = typeof argRecord.path === "string" ? argRecord.path : undefined;
  const effect = MUTATIONS.has(toolName) ? "mutate"
    : OBSERVATIONS.has(toolName) ? "observe"
      : VERIFICATIONS.has(toolName) ? "verify"
        : TRANSITIONS.has(toolName) ? "transition"
          : "opaque";
  return {
    outcome: success ? "success" : "failure",
    effect,
    reproducible: effect === "observe" || effect === "verify",
    ...(path ? { resource: { kind: "file", key: path } } : {}),
    diagnostics: { state: diagnostics.length > 0 ? "unresolved" : "none" },
  };
}
