/**
 * Embedding Router（简化版）- 目前不依赖 embeddings API
 *
 * 由于当前环境不支持 embeddings 模型，这里先用一个「无向量、只裁剪数量」的 router：
 * - 从 skillRegistry 取出所有 skill
 * - 仅按声明顺序截取前 topK 个
 * - score 统一返回 1，用作占位
 *
 * 这样可以保证 Agent / CodeAgent 的整体流程先跑通；后续如果接入
 * embeddings，再把这里替换回真正的向量检索实现即可。
 */

import { getAllSkillMetadata } from "../registry/skillRegistry";

export interface EmbeddingRouterOptions {
  topK?: number;
}

/**
 * 根据 user input 返回 TopK 最相关的 skills
 */
export async function routeByEmbedding(
  userInput: string,
  options: EmbeddingRouterOptions = {}
): Promise<{ name: string; score: number }[]> {
  const { topK = 5 } = options;

  // 当前仅做「数量裁剪」，不做真实相似度计算
  const metadata = getAllSkillMetadata();
  return metadata.slice(0, topK).map((m) => ({
    name: m.name,
    score: 1,
  }));
}
