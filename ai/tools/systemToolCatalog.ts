import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { editFileTool } from "./system/editFileTool";
import { execShellTool } from "./system/execShellTool";
import { formatCodeTool } from "./system/formatCodeTool";
import { installPackageTool } from "./system/installPackageTool";
import { listDirTool } from "./system/listDirTool";
import { readFileTool } from "./system/readFileTool";
import { runBuildTool } from "./system/runBuildTool";
import { searchCodeTool } from "./system/searchCodeTool";
import { writeFileTool } from "./system/writeFileTool";
import { thinkTool } from "./system/thinkTool";
import { revertFileTool } from "./system/revertFileTool";
import { generateImageTool } from "./system/generateImageTool";

const toolDefinitions: Record<string, ChatCompletionTool> = {
  write_file: writeFileTool,
  read_file: readFileTool,
  edit_file: editFileTool,
  exec_shell: execShellTool,
  list_dir: listDirTool,
  search_code: searchCodeTool,
  install_package: installPackageTool,
  format_code: formatCodeTool,
  run_build: runBuildTool,
  think: thinkTool,
  revert_file: revertFileTool,
  generate_image: generateImageTool,
};

export function getSystemToolDefinitions(names: string[]): ChatCompletionTool[] {
  return names
    .map((name) => toolDefinitions[name])
    .filter((tool): tool is ChatCompletionTool => Boolean(tool));
}
