import type { ChatCompletionTool } from "openai/resources/chat/completions";

/** Inlined in intent-agent system prompt — not a separate tool (avoids an extra LLM round). */
export const PIPELINE_CONSTRAINTS_TEXT = `## open-ox 生成流水线（硬约束）

- 产出为 Next.js **web** profile；默认生成单首页 \`home\`（路由 \`/\`）。用户明确要求多页、独立路由或给出页面清单时，必须把这些路由保留进完整建站说明，不得压回首页区块；单次生成最多 8 个静态路由，更多页面应先请用户缩小首批范围。
- 布局形态（是否有顶 nav、是否有 sidebar、是否有 footer、是否使用 nested layout 等）由下游实现 Agent 根据产品形态决定，**不在需求分析阶段表态**。
- 忠实用户已述需求：不擅自添加未提及的产品机制。
- **视觉气质**由 Studio 在早期 \`options\`/\`clarify\` 轮展示气质选择器一次选定；**不要**在 \`confirm_brief\` 后再问风格，也不要用快捷选项问外观。`;

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
                "capability=说明你能做什么；clarify=需要用户补充（Studio 会挂气质选择器）；options=用 suggested_replies 给出有限的受众/产品方向（禁止视觉风格分叉）；confirm_brief=展示润色后的需求请用户确认（此时不再选气质）",
            },
            message: { type: "string", description: "面向用户的主文案（可含换行）。短；不要在正文复述快捷按钮。" },
            suggested_replies: {
              type: "array",
              items: { type: "string" },
              description:
                "0–3 条极短建议回复（理想 2–3），UI 做成快捷按钮；只做受众/产品/内容分叉或确认模板，禁止「极简/科技风/像某竞品外观」等视觉选项",
            },
            brief_draft_markdown: {
              type: "string",
              description:
                "kind=confirm_brief 时：整理后的需求草稿（保守、不臆造功能）。视觉以用户已选气质或原话为准，勿再让用户选风格。",
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

/** Intent Agent control surface only (`yield_to_user` / `commit_generate`). */
export function buildIntentAgentTools(): ChatCompletionTool[] {
  return buildIntentAgentControlTools();
}

/** @deprecated Alias of {@link buildIntentAgentTools} — silent research tools are disabled. */
export function buildIntentAgentToolsForTurn(_params?: {
  needsHeavyTools?: boolean;
}): ChatCompletionTool[] {
  return buildIntentAgentControlTools();
}
