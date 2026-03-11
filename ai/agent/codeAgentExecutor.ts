/**
 * Code Agent - 生产级完整流程
 *
 * User Request → Intent Planner → Architecture Planner → Task Graph
 *   → Skill Router → Prompt Composer → LLM → Code Writer
 *   → Tool Executor → Verifier → Memory
 *   → Recovery / Retry (on failure)
 */

import OpenAI from "openai";
import { getModelId } from "../../lib/config/models";
import { planArchitecture } from "../planner";
import { buildTaskGraphFromArchitecture } from "../planner/taskGraph";
import type { ArchitecturePlan } from "../planner/types";
import { routeByEmbedding } from "../router/embeddingRouter";
import { getSkill } from "../registry/skillRegistry";
import { runSkill } from "../executor/runSkill";
import { skillsToTools } from "./toolAdapter";
import { systemTools, executeSystemTool } from "../tools";
import { verify, formatErrorsForLLM, allPassed } from "../verifier";
import {
  createSession,
  getSession,
  appendEvent,
  recordWrittenFile,
  getContextSummary,
  updatePlan,
} from "../memory";
import { backupBeforeWrite, rollbackAll } from "../recovery";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_URL,
});

export interface CodeAgentOptions {
  /** 是否执行架构规划（默认 true） */
  planArchitecture?: boolean;
  /** 是否在完成后校验（默认 true） */
  verifyAfter?: boolean;
  /** 校验失败时最大重试次数 */
  maxRetries?: number;
  /** 是否在失败时回滚 */
  rollbackOnFail?: boolean;
}

export interface CodeAgentResult {
  sessionId: string;
  content: string;
  /** 架构规划 */
  architecturePlan?: unknown;
  /** 任务图 */
  taskGraph?: unknown;
  /** 调用的 tools */
  toolCalls: Array<{ name: string; args: Record<string, unknown>; result: string }>;
  /** 校验结果 */
  verifyResults?: Array<{ type: string; success: boolean; output: string }>;
  /** 是否通过校验 */
  verified?: boolean;
  /** 重试次数 */
  retries: number;
}

const SYSTEM_PROMPT = `You are a Code Agent. You can:
1. Use skills (summarize, translate, rewrite, etc.) for content tasks
2. Use system tools: write_file, read_file, exec_shell, list_dir

For code generation:
- write_file: write generated code to files
- read_file: read existing code before modifying
- exec_shell: run commands (e.g. pnpm add <pkg> for missing deps)
- list_dir: explore project structure

When the user asks for code, generate it and use write_file to save.
If dependencies are missing, use exec_shell to run "pnpm add <package>".
Complete the task, then respond with a summary.`;

/**
 * Code Agent 主流程
 */
export async function runCodeAgent(
  userInput: string,
  options: CodeAgentOptions = {}
): Promise<CodeAgentResult> {
  const {
    planArchitecture: doPlan = true,
    verifyAfter = true,
    maxRetries = 2,
    rollbackOnFail = true,
  } = options;

  const session = createSession(userInput);

  const toolCalls: CodeAgentResult["toolCalls"] = [];
  let iterations = 0;
  const maxIterations = 15;

  // 1. Architecture Planner
  let architecturePlan: unknown = null;
  let taskGraph: unknown = null;
  if (doPlan) {
    architecturePlan = await planArchitecture(userInput);
    taskGraph = buildTaskGraphFromArchitecture(
      architecturePlan as ArchitecturePlan
    );
    updatePlan(session.sessionId, architecturePlan, taskGraph);
    appendEvent(session.sessionId, {
      type: "plan",
      name: "architecture",
      success: true,
      output: architecturePlan,
    });
  }

  // 2. Skills + System Tools
  const skillNames = (await routeByEmbedding(userInput, { topK: 5 })).map(
    (c) => c.name
  );
  const skillTools = skillsToTools(skillNames);
  const combinedTools = [...skillTools, ...systemTools];

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\n## Context\n${getContextSummary(session.sessionId)}`,
    },
    { role: "user", content: userInput },
  ];

  const model = getModelId();

  while (iterations < maxIterations) {
    iterations++;

    const res = await openai.chat.completions.create({
      model,
      messages,
      tools: combinedTools,
      tool_choice: "auto",
      temperature: 0.7,
    });

    const msg = res.choices[0]?.message;
    if (!msg) throw new Error("Empty response");

    messages.push({
      role: "assistant",
      content: msg.content ?? null,
      tool_calls: msg.tool_calls,
    });

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      break;
    }

    for (const tc of msg.tool_calls) {
      const name = tc.function.name;
      const args = JSON.parse(tc.function.arguments || "{}") as Record<
        string,
        unknown
      >;

      const isSystemTool = systemTools.some(
        (t) => t.type === "function" && t.function.name === name
      );

      let result: string;
      if (isSystemTool) {
        if (name === "write_file") {
          const path = args.path as string;
          backupBeforeWrite(path);
        }
        const out = await executeSystemTool(name, args);
        result =
          typeof out === "string"
            ? out
            : JSON.stringify(out.success ? out.output : out.error);
        if (name === "write_file" && typeof out === "object" && out.success) {
          recordWrittenFile(session.sessionId, args.path as string);
        }
        appendEvent(session.sessionId, {
          type: "tool",
          name,
          input: args,
          output: result,
          success: typeof out === "object" ? out.success : true,
        });
      } else {
        const skill = getSkill(name);
        if (!skill) {
          result = `Skill not found: ${name}`;
        } else {
          result = await runSkill({
            skillName: name,
            input: Object.keys(args).length > 0 ? args : { content: userInput },
          });
        }
        appendEvent(session.sessionId, {
          type: "skill",
          name,
          input: args,
          output: result,
          success: true,
        });
      }

      toolCalls.push({ name, args, result });
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  // 3. Verifier
  let verifyResults: CodeAgentResult["verifyResults"];
  let verified = true;
  if (verifyAfter && session.writtenFiles.length > 0) {
    const vResults = await verify({ types: ["lint"] });
    verifyResults = vResults.map((r) => ({
      type: r.type,
      success: r.success,
      output: r.output,
    }));
    verified = allPassed(vResults);

    if (!verified && session.retryCount < maxRetries) {
      session.retryCount++;
      const errSummary = formatErrorsForLLM(vResults);
      messages.push({
        role: "user",
        content: `[Verification failed. Please fix the following errors:\n\n${errSummary}\n\nRetry count: ${session.retryCount}`,
      });
      // 简化：不重试整个 agent，仅返回结果让上层决定
      // 生产环境可在此处递归调用 runCodeAgent 或重试
    }

    if (!verified && rollbackOnFail) {
      const { rolled } = rollbackAll(session.writtenFiles);
      appendEvent(session.sessionId, {
        type: "error",
        name: "rollback",
        output: `Rolled back: ${rolled.join(", ")}`,
        success: false,
      });
    }
  }

  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant") as
    | { content: string | null }
    | undefined;

  return {
    sessionId: session.sessionId,
    content: lastAssistant?.content?.trim() ?? "",
    architecturePlan,
    taskGraph,
    toolCalls,
    verifyResults,
    verified,
    retries: session.retryCount,
  };
}
