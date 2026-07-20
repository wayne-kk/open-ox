import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { isDirectionLockV1Enabled } from "@/lib/studio/siteOutline";

/** Inlined in intent-agent system prompt — not a separate tool (avoids an extra LLM round). */
export const PIPELINE_CONSTRAINTS_TEXT = `## open-ox 生成流水线（硬约束）

- 产出为 Next.js **web** profile；MVP 约束为**单首页**：站点只有 **一个顶层页面**，slug 必须为 \`home\`（路由 \`/\`）。
- 布局形态（是否有顶 nav、是否有 sidebar、是否有 footer、是否使用 nested layout 等）由下游实现 Agent 根据产品形态决定，**不在需求分析阶段表态**。
- 忠实用户已述需求：不擅自添加未提及的产品机制。
- **方向锁定（DIRECTION_LOCK）开启时**：\`confirm_brief\` 之后必须调用 \`single_page_ia_proposal\`，再 \`yield_to_user(kind=confirm_direction)\`（带 site_outline）；**禁止**跳过该门直接 \`commit_generate\`。视觉气质与模块结构由 Studio 同屏确认。
- **DIRECTION_LOCK 关闭时**：视觉气质可由早期 clarify 选择；不要用快捷选项反复问外观。`;

export function buildIntentAgentControlTools(): ChatCompletionTool[] {
  const directionLock = isDirectionLockV1Enabled();
  return [
    {
      type: "function",
      function: {
        name: "yield_to_user",
        description:
          "挂起（yield）当前任务，把控制权还给用户：展示说明、反问澄清、提供选项、确认需求摘要、或打开气质+结构同屏确认门。调用后本回合必须结束，不要再发起其他 tool。",
        parameters: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: directionLock
                ? ["capability", "clarify", "options", "confirm_brief", "confirm_direction"]
                : ["capability", "clarify", "options", "confirm_brief"],
              description: directionLock
                ? "capability=说明能力；clarify/options=澄清受众/产品；confirm_brief=确认散文 brief；confirm_direction=同屏确认气质+模块结构（须带 site_outline）"
                : "capability=说明你能做什么；clarify/options=澄清；confirm_brief=确认需求草稿",
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
                "kind=confirm_brief 时：整理后的需求草稿（保守、不臆造功能）。",
            },
            site_outline: {
              type: "object",
              description:
                "kind=confirm_direction 时必填：SiteOutline JSON（pageSlug=home、pageGoal、modules[]）。通常直接使用 single_page_ia_proposal 的输出。",
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
        description: directionLock
          ? "仅在用户已在 Studio「确认气质与结构并生成」之后使用。通常由客户端携带 confirmedSiteOutline 入队；Agent 路径若启用方向锁定且尚未 confirm_direction，不要调用本工具。"
          : "用户意图已足够明确且（如需要）已确认，将合并后的完整建站说明交给后续「需求分析→代码生成」流水线。调用后本回合必须结束。",
        parameters: {
          type: "object",
          properties: {
            merged_brief: {
              type: "string",
              description:
                "合并后的**完整**建站说明（品牌/目标/内容/风格等），供 analyze 使用；勿臆造未确认功能。**禁止**仅填「就这样」「开始生成吧」等口语确认；宁可重复 `confirm_brief` 中的 `brief_draft_markdown` 全文。",
            },
            site_outline: {
              type: "object",
              description: "可选：用户确认的 SiteOutline（方向锁定路径由客户端提交为准）。",
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
