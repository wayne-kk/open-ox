import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { referenceSiteDigestTool } from "@/ai/tools/system/referenceSiteDigestTool";
import { brandKitFromUrlTool } from "@/ai/tools/system/brandKitFromUrlTool";
import { singlePageIaProposalTool } from "@/ai/tools/system/singlePageIaProposalTool";
import { accessibilitySeoBriefTool } from "@/ai/tools/system/accessibilitySeoBriefTool";
import { competitiveLandscapeSnapshotTool } from "@/ai/tools/system/competitiveLandscapeSnapshotTool";

export const PIPELINE_CONSTRAINTS_TEXT = `## open-ox 生成流水线（硬约束）

- 产出为 Next.js **App Router** web profile。**顶层路由条数由需求分析阶段根据用户意图决定**：可以是 **只有首页**（单条 \`slug: home\`，路径 \`/\`，常见落地/滚动叙事），也可以是 **多条独立路由**（例如 \`/\`、\`/pricing\`、\`/about\`……），每条对应一个页面实现。**不要向用户捏造**流水线未实现的功能；也**不要为了「显得完整」强行多页**，或把明显需要多屏（控制台、文档站、多端流程）的需求压成单页叙事——除非用户明确要求单页落地。
- 多路由蓝图约定：**必须有且仅有一条** \`slug: "home"\` 指向 \`/\`；全局导航必须用真实站内路径（由下游在对照蓝图落地）。单页蓝图则通常仅含 \`home\`。
- 是否有顶栏/侧栏/footer、是否用 nested layout：**由下游 Architect 按产品形态决定**；意向对话阶段不必让用户敲定壳层细节。
- 忠实用户已述需求：不擅自添加未提及的产品机制。`;

export function buildIntentAgentTools(): ChatCompletionTool[] {
  return [
    {
      type: "function",
      function: {
        name: "get_pipeline_constraints",
        description:
          "读取当前代码生成流水线的硬约束（可多顶层路由或可仅 `/`、全局壳层由下游决定等）。在回答能力问题或规划站点前应优先调用。",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },
    referenceSiteDigestTool,
    brandKitFromUrlTool,
    singlePageIaProposalTool,
    accessibilitySeoBriefTool,
    competitiveLandscapeSnapshotTool,
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
