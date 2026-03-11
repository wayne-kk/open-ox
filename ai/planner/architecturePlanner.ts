/**
 * Architecture Planner - 高层架构规划
 * 根据用户意图规划页面/组件/模块结构
 */

import OpenAI from "openai";
import { getModelId } from "../../lib/config/models";
import type { ArchitecturePlan, ArchitectureNode } from "./types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_URL,
});

const SYSTEM_PROMPT = `You are an architecture planner for a code generation agent.
Given a user request, output a JSON architecture plan with:
- nodes: array of { id, type, name, description?, dependsOn?, meta? }
- type: "page" | "component" | "layout" | "module" | "file"
- dependsOn: array of node ids this node depends on
- stack: inferred framework (e.g. "next.js", "react")
- rootPath: base path (e.g. "app", "components")

Output ONLY valid JSON, no markdown.`;

/**
 * 根据用户请求生成架构规划
 */
export async function planArchitecture(
  userRequest: string,
  context?: { existingFiles?: string[]; stack?: string }
): Promise<ArchitecturePlan> {
  const model = getModelId();
  const userMsg = context
    ? `Request: ${userRequest}\n\nContext: ${JSON.stringify(context)}`
    : userRequest;

  const res = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ],
    temperature: 0.3,
  });

  const text = res.choices[0]?.message?.content?.trim() ?? "{}";
  const parsed = parseJson(text);

  if (!parsed?.nodes || !Array.isArray(parsed.nodes)) {
    return {
      nodes: [],
      stack: context?.stack,
      rootPath: "app",
    };
  }

  return {
    nodes: parsed.nodes as ArchitectureNode[],
    stack: parsed.stack ?? context?.stack,
    rootPath: parsed.rootPath ?? "app",
  };
}

function parseJson(str: string): { nodes?: ArchitectureNode[]; stack?: string; rootPath?: string } | null {
  const match = str.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
