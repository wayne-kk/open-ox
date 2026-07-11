import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { referenceSiteDigestTool } from "@/ai/tools/system/referenceSiteDigestTool";
import { brandKitFromUrlTool } from "@/ai/tools/system/brandKitFromUrlTool";
import { singlePageIaProposalTool } from "@/ai/tools/system/singlePageIaProposalTool";
import { accessibilitySeoBriefTool } from "@/ai/tools/system/accessibilitySeoBriefTool";
import { competitiveLandscapeSnapshotTool } from "@/ai/tools/system/competitiveLandscapeSnapshotTool";

/** Inlined in intent-agent system prompt — not a separate tool (avoids an extra LLM round). */
export const PIPELINE_CONSTRAINTS_TEXT = `## open-ox 生成流水线（硬约束）

- 产出为 Next.js **web** profile；MVP 约束为**单首页**：站点只有 **一个顶层页面**，slug 必须为 \`home\`（路由 \`/\`）。
- 布局形态（是否有顶 nav、是否有 sidebar、是否有 footer、是否使用 nested layout 等）由下游实现 Agent 根据产品形态决定，**不在需求分析阶段表态**。
- 忠实用户已述需求：不擅自添加未提及的产品机制。`;

export function buildIntentAgentControlTools(): ChatCompletionTool[] {
  return [
    {
      type: "function",
      function: {
        name: "yield_to_user",
        description:
          "挂起（yield）当前任务，把控制权还给用户：展示说明、反问澄清、提供选项、或请用户确认润色后的需求摘要。调用后本回合必须结束，不要再发起其他 tool。",
        parameters: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: ["capability", "clarify", "options", "confirm_brief"],
              description:
                "capability=说明你能做什么；clarify=需要用户补充；options=给用户有限选项；confirm_brief=展示润色后的需求请用户确认",
            },
            message: { type: "string", description: "面向用户的主文案（可含换行）。" },
            suggested_replies: {
              type: "array",
              items: { type: "string" },
              description: "0–6 条极短建议回复，便于 UI 做快捷按钮",
            },
            options: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "snake_case id" },
                  label: { type: "string" },
                  hint: { type: "string", description: "可选" },
                },
                required: ["id", "label"],
                additionalProperties: false,
              },
              description: "kind=options 时使用，最多 6 项",
            },
            brief_draft_markdown: {
              type: "string",
              description: "kind=confirm_brief 时：整理后的需求草稿（保守、不臆造功能）。",
            },
          },
          required: ["kind", "message"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "commit_generate",
        description:
          "用户意图已足够明确且（如需要）已确认，将合并后的完整建站说明交给后续「需求分析→代码生成」流水线。调用后本回合必须结束。",
        parameters: {
          type: "object",
          properties: {
            merged_brief: {
              type: "string",
              description:
                "合并后的**完整**建站说明（品牌/目标/内容/风格等），供 analyze 使用；勿臆造未确认功能。**禁止**仅填「就这样」「开始生成吧」等口语确认；宁可重复 `confirm_brief` 中的 `brief_draft_markdown` 全文。",
            },
          },
          required: ["merged_brief"],
          additionalProperties: false,
        },
      },
    },
  ];
}

/** Full tool surface (control + silent research tools). Prefer {@link buildIntentAgentToolsForTurn}. */
export function buildIntentAgentTools(): ChatCompletionTool[] {
  return [
    referenceSiteDigestTool,
    brandKitFromUrlTool,
    singlePageIaProposalTool,
    accessibilitySeoBriefTool,
    competitiveLandscapeSnapshotTool,
    ...buildIntentAgentControlTools(),
  ];
}

/**
 * Slim tool schemas for clarify-only turns (no reference URL / screenshot).
 * Heavy silent tools stay available when the turn needs them.
 */
export function buildIntentAgentToolsForTurn(params: {
  needsHeavyTools: boolean;
}): ChatCompletionTool[] {
  return params.needsHeavyTools ? buildIntentAgentTools() : buildIntentAgentControlTools();
}

