/**
 * Session Memory - 会话状态与上下文管理
 */

import type { SessionState, MemoryEvent } from "./types";

const sessions = new Map<string, SessionState>();

function genId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 创建新会话
 */
export function createSession(userRequest: string): SessionState {
  const session: SessionState = {
    sessionId: genId(),
    userRequest,
    events: [],
    writtenFiles: [],
    retryCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  sessions.set(session.sessionId, session);
  return session;
}

/**
 * 获取会话
 */
export function getSession(sessionId: string): SessionState | undefined {
  return sessions.get(sessionId);
}

/**
 * 追加事件
 */
export function appendEvent(
  sessionId: string,
  event: Omit<MemoryEvent, "id" | "timestamp">
): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  const full: MemoryEvent = {
    ...event,
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };
  session.events.push(full);
  session.updatedAt = Date.now();
}

/**
 * 记录写入的文件（用于 rollback）
 */
export function recordWrittenFile(sessionId: string, path: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.writtenFiles.push(path);
  session.updatedAt = Date.now();
}

/**
 * 获取上下文摘要（供 LLM 使用）
 */
export function getContextSummary(sessionId: string, maxEvents = 20): string {
  const session = sessions.get(sessionId);
  if (!session) return "";

  const recent = session.events.slice(-maxEvents);
  const lines = recent.map((e) => {
    const status = e.success === false ? " [FAILED]" : "";
    return `- ${e.type}: ${e.name ?? "?"}${status}`;
  });

  return [
    `Session: ${session.sessionId}`,
    `User request: ${session.userRequest}`,
    `Written files: ${session.writtenFiles.join(", ") || "none"}`,
    `Retries: ${session.retryCount}`,
    "Recent events:",
    ...lines,
  ].join("\n");
}

/**
 * 更新架构规划与任务图
 */
export function updatePlan(
  sessionId: string,
  plan: SessionState["architecturePlan"],
  graph?: SessionState["taskGraph"]
): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.architecturePlan = plan;
  if (graph) session.taskGraph = graph;
  session.updatedAt = Date.now();
}
