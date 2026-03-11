/**
 * 将 Skills 转为 OpenAI Function Calling 格式
 */

import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { loadAllSkills } from "../registry/skillRegistry";

/** 解析 inputSchema 中的 "type - description" 格式 */
function parseParamDesc(desc: string): { type: string; description: string } {
  const match = desc.match(/^(\w+)\s*[-–—]\s*(.+)$/);
  if (match) {
    return { type: mapType(match[1]), description: match[2].trim() };
  }
  return { type: "string", description: desc };
}

function mapType(t: string): string {
  const m: Record<string, string> = {
    string: "string",
    number: "number",
    integer: "integer",
    boolean: "boolean",
    array: "array",
    object: "object",
  };
  return m[t.toLowerCase()] ?? "string";
}

/**
 * 将 skills 转为 OpenAI tools 定义
 * @param skillNames 可选，仅包含指定 skills（用于 token 优化，只传 TopK）
 */
export function skillsToTools(skillNames?: string[]): ChatCompletionTool[] {
  const all = loadAllSkills();
  const skills = skillNames
    ? (skillNames.map((n) => all.get(n)).filter((s): s is NonNullable<typeof s> => s != null))
    : Array.from(all.values());

  return skills.map((skill) => {
    const properties: Record<
      string,
      { type: string; description: string; items?: { type: string } }
    > = {};
    const required: string[] = [];

    for (const [key, val] of Object.entries(skill.inputSchema)) {
      const { type, description } = parseParamDesc(val);
      properties[key] = { type, description };
      required.push(key);
    }

    return {
      type: "function" as const,
      function: {
        name: skill.name,
        description: `${skill.description}. Examples: ${skill.examples.slice(0, 3).join("; ")}`,
        parameters: {
          type: "object",
          properties,
          required,
        },
      },
    };
  });
}
