import { getModelForStep } from "@/lib/config/models";
import { callLLM } from "../shared/llm";
import type { PlannedSectionSpec } from "../types";

function buildFallbackBrief(section: PlannedSectionSpec): string {
  return `【Section设计】
布局：围绕“${section.intent}”组织单一主视觉路径，标题区先行，核心内容紧随其后。
背景：使用低饱和背景与内容区形成区分，避免高噪声和过度装饰。
层次：标题第一层，主交互或核心信息第二层，辅助说明第三层。`;
}

function sanitizeBrief(raw: string): string {
  const trimmed = raw.trim();
  const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
  const hasLayout = lines.some((line) => line.startsWith("布局："));
  const hasBackground = lines.some((line) => line.startsWith("背景："));
  const hasHierarchy = lines.some((line) => line.startsWith("层次："));
  const hasHeader = lines[0] === "【Section设计】";
  if (hasHeader && hasLayout && hasBackground && hasHierarchy) {
    return lines.join("\n");
  }
  return "";
}

export interface DescribeSectionDesignParams {
  section: PlannedSectionSpec;
  designSystem: string;
}

export async function stepDescribeSectionDesign({
  section,
  designSystem,
}: DescribeSectionDesignParams): Promise<string> {
  const systemPrompt = `你是资深页面设计师。请为单个 Section 输出极简设计描述。

硬性要求：
1) 只输出以下四行，不要任何额外解释：
【Section设计】
布局：...
背景：...
层次：...
2) 每行 1 句，简洁明确，避免空话。
3) 不输出参数名以外的字段，不要 markdown，不要列表。`;

  const userMessage = `Section 信息：
- Type: ${section.type}
- Intent: ${section.intent}
- Content Hints: ${section.contentHints}

Design System（必须遵守）:
${designSystem}

请基于以上信息产出该 Section 的设计描述。`;

  try {
    const raw = await callLLM(
      systemPrompt,
      userMessage,
      0.3,
      300,
      getModelForStep("generate_section")
    );
    const brief = sanitizeBrief(raw);
    return brief || buildFallbackBrief(section);
  } catch {
    return buildFallbackBrief(section);
  }
}
