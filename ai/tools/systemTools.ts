/**
 * System Tools - 网站生成流程使用的工具执行入口
 */
import type { ToolResult, ToolExecutor } from "./types";

import { executeWriteFile } from "./system/writeFileTool";
import { executeReadFile } from "./system/readFileTool";
import { executeEditFile } from "./system/editFileTool";
import { executeExecShell } from "./system/execShellTool";
import { executeListDir } from "./system/listDirTool";
import { executeSearchCode } from "./system/searchCodeTool";
import { executeInstallPackage } from "./system/installPackageTool";
import { executeFormatCode } from "./system/formatCodeTool";
import { executeRunBuild } from "./system/runBuildTool";
import { executeThink } from "./system/thinkTool";
import { executeRevertFile } from "./system/revertFileTool";
import { trackFileRead, clearFileReadTracking } from "./system/fileReadTracker";

const executors: Record<string, ToolExecutor> = {
  write_file: executeWriteFile,
  read_file: executeReadFile,
  edit_file: executeEditFile,
  exec_shell: executeExecShell,
  list_dir: executeListDir,
  search_code: executeSearchCode,
  install_package: executeInstallPackage,
  format_code: executeFormatCode,
  run_build: executeRunBuild,
  think: executeThink,
  revert_file: executeRevertFile,
};

// Re-export for external consumers
export { clearFileReadTracking } from "./system/fileReadTracker";

// ── Tool Result Budget ──────────────────────────────────────────────────────
// Prevents a single tool result from consuming too much context.
const MAX_TOOL_RESULT_CHARS = 30_000;

function truncateResult(result: ToolResult | string): ToolResult | string {
  if (typeof result === "string") {
    if (result.length > MAX_TOOL_RESULT_CHARS) {
      return result.slice(0, MAX_TOOL_RESULT_CHARS) + `\n...[truncated: ${result.length} total chars]`;
    }
    return result;
  }
  if (result.output && result.output.length > MAX_TOOL_RESULT_CHARS) {
    return {
      ...result,
      output: result.output.slice(0, MAX_TOOL_RESULT_CHARS) + `\n...[truncated: ${result.output.length} total chars]`,
    };
  }
  if (result.error && result.error.length > MAX_TOOL_RESULT_CHARS) {
    return {
      ...result,
      error: result.error.slice(0, MAX_TOOL_RESULT_CHARS) + `\n...[truncated]`,
    };
  }
  return result;
}

export async function executeSystemTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult | string> {
  const executor = executors[name];
  if (!executor) {
    return { success: false, error: `Unknown tool: ${name}` };
  }
  try {
    // Track file reads
    if (name === "read_file" && args.path) {
      trackFileRead(args.path as string);
    }

    const result = await executor(args);
    return truncateResult(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
