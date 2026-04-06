import { existsSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "../types";
import { resolvePath } from "./common";

/**
 * Revert file tool — undo all changes made to a file during this session.
 *
 * Works with FileSnapshotTracker: when the agent first touches a file,
 * the tracker captures the original content. This tool restores that snapshot.
 *
 * The snapshot map is injected at runtime via setRevertSnapshots().
 */

let _snapshots: Map<string, string> | null = null;

export function setRevertSnapshots(snapshots: Map<string, string>): void {
  _snapshots = snapshots;
}

export function clearRevertSnapshots(): void {
  _snapshots = null;
}

export const revertFileTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "revert_file",
    description:
      "Revert a file to its original state (before any edits in this session). " +
      "Use when your edits made things worse and you want to start fresh on a file. " +
      "Only works for files that were modified during this session.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path of the file to revert",
        },
      },
      required: ["path"],
    },
  },
};

export const executeRevertFile: ToolExecutor = async (
  args: Record<string, unknown>
): Promise<ToolResult | string> => {
  const filePath = args.path as string;
  if (!filePath) return { success: false, error: "Missing path" };

  if (!_snapshots) {
    return { success: false, error: "No snapshots available — revert only works during a modify session." };
  }

  const originalContent = _snapshots.get(filePath);
  if (originalContent === undefined) {
    const available = Array.from(_snapshots.keys()).join(", ") || "(none)";
    return {
      success: false,
      error: `No snapshot for "${filePath}". Files with snapshots: ${available}`,
    };
  }

  const fullPath = resolvePath(filePath);
  const dir = dirname(fullPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, originalContent, "utf-8");

  return {
    success: true,
    output: `Reverted "${filePath}" to its original state (${originalContent.length} bytes).`,
  };
};
