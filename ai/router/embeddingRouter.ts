/**
 * Embedding Router - 用向量相似度选出 TopK skills
 * 流程: user input → embedding → vector search → top K skills
 */

import OpenAI from "openai";
import { getAllSkillMetadata } from "../registry/skillRegistry";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_URL,
});

/** 余弦相似度 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

let _skillEmbeddings: { name: string; embedding: number[] }[] | null = null;

async function getSkillEmbeddings(): Promise<{ name: string; embedding: number[] }[]> {
  if (_skillEmbeddings) return _skillEmbeddings;

  const metadata = getAllSkillMetadata();
  const texts = metadata.map(
    (m) => `${m.description}. Examples: ${m.examples.join("; ")}`
  );

  const embeddingModel =
    process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

  const res = await openai.embeddings.create({
    model: embeddingModel,
    input: texts,
  });

  _skillEmbeddings = metadata.map((m, i) => ({
    name: m.name,
    embedding: res.data[i]?.embedding ?? [],
  }));

  return _skillEmbeddings;
}

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

  const [skillEmbs, inputRes] = await Promise.all([
    getSkillEmbeddings(),
    openai.embeddings.create({
      model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      input: userInput,
    }),
  ]);

  const inputEmb = inputRes.data[0]?.embedding ?? [];

  const scored = skillEmbs.map((s) => ({
    name: s.name,
    score: cosineSimilarity(s.embedding, inputEmb),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}
