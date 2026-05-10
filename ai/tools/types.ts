/**
 * Tool System - 系统工具类型
 * 用于 Code Agent 执行写文件、执行命令等操作
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

/**
 * Structured diagnostic surfaced by tools (write_file, edit_file, read_lints).
 * Mirrors the shape an LSP client receives so the agent can localise errors
 * by `file:line:column` and pick the right repair edit.
 */
export interface ToolDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning";
  source: "ts" | "parser" | "eslint" | "build";
  code: string | number;
  message: string;
}

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  /** 如 write_file 返回写入路径 */
  meta?: Record<string, unknown>;
  /**
   * Structured diagnostics produced while running the tool (e.g. write_file
   * runs a single-file `tsc` pass after writing). Populated when the tool can
   * cheaply verify its output. The tool loop renders these alongside `output`
   * so the agent sees the errors in the same turn it produced them.
   */
  diagnostics?: ToolDiagnostic[];
}

/** Tool 执行函数 */
export type ToolExecutor = (
  args: Record<string, unknown>
) => Promise<ToolResult | string>;
