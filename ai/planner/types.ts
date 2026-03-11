/**
 * Planner 相关类型
 */

/** 架构规划中的单个节点（组件/模块/页面） */
export interface ArchitectureNode {
  id: string;
  type: "page" | "component" | "layout" | "module" | "file";
  name: string;
  description?: string;
  /** 依赖的其他节点 id */
  dependsOn?: string[];
  /** 元数据，如 framework, path 等 */
  meta?: Record<string, unknown>;
}

/** 架构规划输出 */
export interface ArchitecturePlan {
  nodes: ArchitectureNode[];
  /** 技术栈/框架 */
  stack?: string;
  /** 根路径 */
  rootPath?: string;
}

/** 任务图中的单个任务 */
export interface TaskNode {
  id: string;
  type: "generate" | "write" | "exec" | "verify" | "plan";
  /** 关联的 skill 或 tool */
  skill?: string;
  tool?: string;
  /** 输入参数 */
  input?: Record<string, unknown>;
  /** 依赖的任务 id */
  dependsOn: string[];
  /** 架构节点 id（若关联） */
  architectureNodeId?: string;
  status?: "pending" | "running" | "done" | "failed";
  result?: unknown;
  error?: string;
}

/** 任务图 */
export interface TaskGraph {
  tasks: TaskNode[];
  /** 拓扑排序后的执行顺序 */
  executionOrder?: string[];
}
