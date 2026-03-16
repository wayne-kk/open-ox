/**
 * System Tools - 网站生成流程使用的工具执行入口
 */
import type { ToolResult, ToolExecutor } from "./types";

import { executeWriteFile } from "./system/writeFileTool";
import { executeReadFile } from "./system/readFileTool";
import { executeExecShell } from "./system/execShellTool";
import { executeListDir } from "./system/listDirTool";
import { executeSearchCode } from "./system/searchCodeTool";
import { executeInstallPackage } from "./system/installPackageTool";
import { executeFormatCode } from "./system/formatCodeTool";
import { executeRunBuild } from "./system/runBuildTool";

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
