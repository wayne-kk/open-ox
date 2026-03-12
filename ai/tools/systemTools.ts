/**
 * System Tools - 网站生成 Agent 常用工具聚合
 * 这里只负责聚合各独立工具的 definition + executor
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { ToolResult, ToolExecutor } from "./types";

import { writeFileTool, executeWriteFile } from "./system/writeFileTool";
import { readFileTool, executeReadFile } from "./system/readFileTool";
import { execShellTool, executeExecShell } from "./system/execShellTool";
import { listDirTool, executeListDir } from "./system/listDirTool";
import { searchCodeTool, executeSearchCode } from "./system/searchCodeTool";
import { installPackageTool, executeInstallPackage } from "./system/installPackageTool";
import { formatCodeTool, executeFormatCode } from "./system/formatCodeTool";
import { runBuildTool, executeRunBuild } from "./system/runBuildTool";

export const systemTools: ChatCompletionTool[] = [
  writeFileTool,
  readFileTool,
  execShellTool,
  listDirTool,
  searchCodeTool,
  installPackageTool,
  formatCodeTool,
  runBuildTool,
];

const executors: Record<string, ToolExecutor> = {
  write_file: executeWriteFile,
  read_file: executeReadFile,
  exec_shell: executeExecShell,
  list_dir: executeListDir,
  search_code: executeSearchCode,
  install_package: executeInstallPackage,
  format_code: executeFormatCode,
  run_build: executeRunBuild,
};

export async function executeSystemTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult | string> {
  const executor = executors[name];
  if (!executor) {
    return { success: false, error: `Unknown tool: ${name}` };
  }
  try {
    return await executor(args);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
