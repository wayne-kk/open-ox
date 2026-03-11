/**
 * Tool-calling Agent - LLM 通过 function calling 选择并调用 tools
 * 循环: 决策 → 执行 tool → 结果回传 → 再决策，直到返回最终答案
 */

import OpenAI from "openai";
import { getModelId } from "../../lib/config/models";
import { getSkill } from "../registry/skillRegistry";
import { runSkill } from "../executor/runSkill";
import { skillsToTools } from "./toolAdapter";
import { routeByEmbedding } from "../router/embeddingRouter";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_URL,
});

export interface AgentOptions {
  /** 是否用 Embedding 预选 TopK skills，减少 context（默认 true） */
  useRouter?: boolean;
  /** Router 预选的 skill 数量 */
  topK?: number;
  /** 最大 tool 调用轮数，防止死循环 */
  maxIterations?: number;
  /** 系统提示词补充 */
  systemPrompt?: string;
  /** 记忆上下文 */
  memory?: string;
}

export interface AgentResult {
  content: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown>; result: string }>;
  iterations: number;
}

const DEFAULT_SYSTEM = `You are an AI assistant with access to tools (skills).
Use tools when needed to complete the user's request.
You can call multiple tools in sequence.
When you have enough information, respond with your final answer to the user.
Do not make up tool results - only use actual tool outputs.`;

/**
 * Agent 主循环
 */
export async function runAgent(
  userInput: string,
  options: AgentOptions = {}
): Promise<AgentResult> {
  const {
    useRouter = true,
    topK = 5,
    maxIterations = 10,
    systemPrompt = DEFAULT_SYSTEM,
    memory,
  } = options;

  const model = getModelId();
  const toolCalls: AgentResult["toolCalls"] = [];
  let iterations = 0;

  // 决定传给 LLM 的 tools
  const skillNames = useRouter
    ? (await routeByEmbedding(userInput, { topK })).map((c) => c.name)
    : undefined;
  const tools = skillsToTools(skillNames);

  if (tools.length === 0) {
    throw new Error("No tools available");
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: memory
        ? `${systemPrompt}\n\n## Relevant Memory\n${memory}`
        : systemPrompt,
    },
    { role: "user", content: userInput },
  ];

  while (iterations < maxIterations) {
    iterations++;

    const res = await openai.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.7,
    });

    const msg = res.choices[0]?.message;
    if (!msg) {
      throw new Error("Empty response from model");
    }

    messages.push({
      role: "assistant",
      content: msg.content ?? null,
      tool_calls: msg.tool_calls,
    });

    // 无 tool_calls → 最终回答
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return {
        content: (msg.content ?? "").trim(),
        toolCalls,
        iterations,
      };
    }

    // 执行每个 tool call
    for (const tc of msg.tool_calls) {
      const name = tc.function.name;
      const args = JSON.parse(tc.function.arguments || "{}") as Record<
        string,
        unknown
      >;

      const skill = getSkill(name);
      if (!skill) {
        const err = `Skill not found: ${name}`;
        toolCalls.push({ name, args, result: err });
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: err,
        });
        continue;
      }

      const result = await runSkill({
        skillName: name,
        input: Object.keys(args).length > 0 ? args : { content: userInput },
        memory,
      });

      toolCalls.push({ name, args, result });
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  // 达到最大轮数，取最后一条 assistant 的 content 或拼接 tool 结果
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant") as
    | { content: string | null }
    | undefined;
  return {
    content:
      lastAssistant?.content?.trim() ??
      `[Max iterations reached. Tool results: ${toolCalls.map((t) => t.result).join("; ")}]`,
    toolCalls,
    iterations,
  };
}
