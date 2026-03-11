/**
 * Memory / State 类型定义
 */

/** 单次会话中的事件 */
export interface MemoryEvent {
  id: string;
  type: "tool" | "skill" | "plan" | "verify" | "error";
  timestamp: number;
  /** 工具/技能名 */
  name?: string;
  /** 输入 */
  input?: unknown;
  /** 输出 */
  output?: unknown;
  /** 是否成功 */
  success?: boolean;
}

/** 会话状态 */
export interface SessionState {
  sessionId: string;
  /** 用户原始请求 */
  userRequest: string;
  /** 架构规划 */
  architecturePlan?: unknown;
  /** 任务图 */
  taskGraph?: unknown;
  /** 事件历史 */
  events: MemoryEvent[];
  /** 已写入的文件（用于 rollback） */
  writtenFiles: string[];
  /** 当前任务进度 */
  currentTaskId?: string;
  /** 重试次数 */
  retryCount: number;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}
