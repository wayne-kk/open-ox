/**
 * AI Engine - 主入口
 *
 * 默认: Tool-calling Agent（LLM 通过 function calling 选择并调用 skills）
 * 可选: 路由单 skill / 预定义 flow
 */

import { runAgent } from "./agent/agentExecutor";
import { runCodeAgent } from "./agent/codeAgentExecutor";
import { routeIntent } from "./router";
import { runSkill } from "./executor/runSkill";
import { runWorkflow } from "./executor/workflowEngine";
import { runBuildLandingPage } from "./flows";
import type { AgentOptions } from "./agent/agentExecutor";

export interface ProcessInputOptions extends AgentOptions {
  /** 模式: "agent" | "code_agent" | "skill" | "flow" | "build_site"。不传时由 flow/skill 推断 */
  mode?: "agent" | "code_agent" | "skill" | "flow" | "build_site";
  /** 强制指定 skill（skill 模式） */
  skill?: string;
  /** 使用预定义 flow 名称（flow 模式） */
  flow?: string;
  /** build_site 模式：每个步骤完成时的回调（用于 SSE 流式推送） */
  onStep?: (step: import("./flows/build_landing_page").BuildStep) => void;
}

export interface ProcessResult {
  content: string;
  /** Agent/CodeAgent 模式: 调用的 tools */
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result: string }>;
  /** Agent 模式: 迭代轮数 */
  iterations?: number;
  /** skill/flow 模式: 使用的 skill 名 */
  skill?: string;
  /** flow 模式: 各步结果 */
  steps?: Array<{ skill: string; output: string }>;
  /** CodeAgent 模式: 会话 ID */
  sessionId?: string;
  /** CodeAgent 模式: 架构规划 */
  architecturePlan?: unknown;
  /** CodeAgent 模式: 校验结果 */
  verified?: boolean;
  /** build_site 模式: 生成的文件列表 */
  generatedFiles?: string[];
  /** build_site 模式: 各步执行状态 */
  buildSteps?: import("./flows/build_landing_page").BuildStep[];
  buildTotalDuration?: number;
}

/**
 * 处理用户输入
 * 默认 agent 模式: LLM 自主选择并调用 tools，可多次调用直到完成
 */
export async function processInput(
  userInput: string,
  options: ProcessInputOptions = {}
): Promise<ProcessResult> {
  const mode =
    options.mode ??
    (options.flow ? "flow" : options.skill ? "skill" : "agent");

  if (mode === "build_site") {
    const result = await runBuildLandingPage(userInput, options.onStep);
    return {
      content: result.success
        ? `建站完成。生成了 ${result.generatedFiles.length} 个文件：\n${result.generatedFiles.join("\n")}`
        : `建站失败：${result.error}`,
      generatedFiles: result.generatedFiles,
      buildSteps: result.steps,
      buildTotalDuration: result.totalDuration,
    };
  }

  if (mode === "code_agent") {
    const result = await runCodeAgent(userInput, {
      planArchitecture: true,
      verifyAfter: true,
      maxRetries: 2,
      rollbackOnFail: true,
    });
    return {
      content: result.content,
      toolCalls: result.toolCalls,
      iterations: result.retries,
      sessionId: result.sessionId,
      architecturePlan: result.architecturePlan,
      verified: result.verified,
    };
  }

  if (mode === "agent") {
    const result = await runAgent(userInput, {
      useRouter: options.useRouter,
      topK: options.topK,
      maxIterations: options.maxIterations,
      systemPrompt: options.systemPrompt,
      memory: options.memory,
    });
    return {
      content: result.content,
      toolCalls: result.toolCalls,
      iterations: result.iterations,
    };
  }

  if (mode === "flow") {
    throw new Error("Flow mode: no flows registered. Use build_site mode for landing page generation.");
  }

  // mode === "skill" 或显式指定 skill
  const skill =
    options.skill ?? (mode === "skill" ? (await routeIntent(userInput)).skill : undefined);
  if (!skill) throw new Error("Skill mode requires 'skill' option or router result");

  const output = await runSkill({
    skillName: skill,
    input: userInput,
    memory: options.memory,
  });

  return { content: output, skill };
}

// Re-exports
export { runAgent } from "./agent/agentExecutor";
export { runCodeAgent } from "./agent/codeAgentExecutor";
export { routeIntent } from "./router";
export { runSkill } from "./executor/runSkill";
export { runWorkflow } from "./executor/workflowEngine";
export { composePrompt } from "./composer/promptComposer";
export { getSkill, loadAllSkills } from "./registry/skillRegistry";
export { planArchitecture, buildTaskGraphFromArchitecture } from "./planner";
export { systemTools, executeSystemTool } from "./tools";
export { verify, formatErrorsForLLM } from "./verifier";
export { createSession, getSession, getContextSummary } from "./memory";
export { backupBeforeWrite, rollbackAll, withRetry } from "./recovery";
export type { Skill, SkillMetadata, ComposeContext, RouterResult } from "./types";
