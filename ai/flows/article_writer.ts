/**
 * Flow: 博客写作流程
 * summarize → rewrite (现有 skills 示例)
 * 可扩展: research → summarize → write_article
 */

import type { FlowStep } from "../types";

export const articleWriterFlow: FlowStep[] = [
  { skill: "summarize", input: {} },
  { skill: "rewrite", input: { style: "formal" } },
];

export default articleWriterFlow;
