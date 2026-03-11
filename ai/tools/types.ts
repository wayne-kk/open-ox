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

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  /** 如 write_file 返回写入路径 */
  meta?: Record<string, unknown>;
}

/** Tool 执行函数 */
export type ToolExecutor = (
  args: Record<string, unknown>
) => Promise<ToolResult | string>;
