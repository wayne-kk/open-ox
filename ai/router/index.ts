/**
 * Intent Router - Embedding + LLM 两阶段路由
 */

import { routeByEmbedding } from "./embeddingRouter";
import { selectSkillWithLLM, type RouterResult } from "./llmRouter";

export interface RouterOptions {
  topK?: number;
}

/**
 * User Input → Embedding TopK → LLM 选一
 */
export async function routeIntent(
  userInput: string,
  options: RouterOptions = {}
): Promise<RouterResult> {
  const candidates = await routeByEmbedding(userInput, { topK: options.topK ?? 5 });
  return selectSkillWithLLM(userInput, candidates);
}

export { routeByEmbedding } from "./embeddingRouter";
export { selectSkillWithLLM } from "./llmRouter";
