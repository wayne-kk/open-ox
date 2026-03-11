/**
 * Skill Executor - 执行单个 skill
 */

import { readFileSync } from "fs";
import { join } from "path";
import OpenAI from "openai";
import { getModelId } from "../../lib/config/models";
import { getSkill } from "../registry/skillRegistry";
import { composePrompt } from "../composer/promptComposer";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_URL,
});

const DSL_DIR = join(process.cwd(), "ai", "prompts", "dsl");

export interface RunSkillInput {
  skillName: string;
  input: string | Record<string, unknown>;
  memory?: string;
  tools?: string;
}

/**
 * 运行单个 skill，返回 LLM 输出
 */
export async function runSkill(options: RunSkillInput): Promise<string> {
  const { skillName, input, memory, tools } = options;

  const skill = getSkill(skillName);
  if (!skill) {
    throw new Error(`Skill not found: ${skillName}`);
  }

  const inputStr =
    typeof input === "string" ? input : JSON.stringify(input, null, 2);

  const system = readFileSync(join(DSL_DIR, "system.md"), "utf-8");
  const outputFormat = readFileSync(join(DSL_DIR, "output_json.md"), "utf-8");

  const systemPrompt = composePrompt({
    system,
    skillPrompt: skill.promptContent ?? "",
    memory,
    tools,
    outputFormat,
  });

  const model = getModelId();
  const res = await openai.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: inputStr },
    ],
    temperature: 0.7,
  });

  return res.choices[0]?.message?.content?.trim() ?? "";
}
