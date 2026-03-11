/**
 * LLM Router - 在 TopK candidates 中由 LLM 选出最终 skill
 */

import OpenAI from "openai";
import { getModelId } from "../../lib/config/models";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_URL,
});

export interface RouterResult {
  skill: string;
  confidence?: number;
}

/**
 * 给定候选 skills，让 LLM 选择最匹配的一个
 */
export async function selectSkillWithLLM(
  userInput: string,
  candidates: { name: string; score?: number }[]
): Promise<RouterResult> {
  const model = getModelId();
  const list = candidates
    .map((c, i) => `${i + 1}. ${c.name}${c.score != null ? ` (score: ${c.score.toFixed(2)})` : ""}`)
    .join("\n");

  const res = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are a skill router. Given the user's request and candidate skills, respond with ONLY a JSON object: {"skill": "<skill_name>"}. Choose the most appropriate skill.`,
      },
      {
        role: "user",
        content: `User request: ${userInput}\n\nCandidate skills:\n${list}\n\nRespond with JSON only.`,
      },
    ],
    temperature: 0,
  });

  const text = res.choices[0]?.message?.content?.trim() ?? "{}";
  const json = parseJson(text);
  const skill = json?.skill ?? candidates[0]?.name ?? "";

  return {
    skill: String(skill),
    confidence: candidates.find((c) => c.name === skill)?.score,
  };
}

function parseJson(str: string): { skill?: string } | null {
  const match = str.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as { skill?: string };
  } catch {
    return null;
  }
}
