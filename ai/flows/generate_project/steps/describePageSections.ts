import { getModelForStep } from "@/lib/config/models";
import { callLLM, extractJSON } from "../shared/llm";
import type { PlannedPageBlueprint, PlannedSectionSpec } from "../types";

export interface PageSectionDesignBrief {
  fileName: string;
  sectionType: string;
  sectionDesignBrief: string;
}

export interface DescribePageSectionsResult {
  pageStructure: string;
  sectionDesigns: PageSectionDesignBrief[];
}

export interface DescribePageSectionsParams {
  designSystem: string;
  language: string;
  page: PlannedPageBlueprint;
  sections: PlannedSectionSpec[];
}

function buildFallbackSectionBrief(section: PlannedSectionSpec): string {
  return `【Section设计】
布局：围绕“${section.intent}”组织单一主视觉路径，标题区先行，核心内容紧随其后。
背景：使用低饱和背景与内容区形成区分，避免高噪声和过度装饰。
层次：标题第一层，主交互或核心信息第二层，辅助说明第三层。`;
}

function normalizeSectionDesign(raw: string, fallback: string): string {
  const lines = raw
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const hasHeader = lines[0] === "【Section设计】";
  const hasLayout = lines.some((line) => line.startsWith("布局："));
  const hasBackground = lines.some((line) => line.startsWith("背景："));
  const hasHierarchy = lines.some((line) => line.startsWith("层次："));
  if (hasHeader && hasLayout && hasBackground && hasHierarchy) {
    return lines.join("\n");
  }
  return fallback;
}

export async function stepDescribePageSections(
  params: DescribePageSectionsParams
): Promise<DescribePageSectionsResult> {
  const {
    designSystem,
    language,
    page,
    sections,
  } = params;

  const systemPrompt = `你是顶级 UI 设计师。请先做页面整体结构设计，再拆分到每个 Section。

输出必须是 JSON，结构如下：
{
  "pageStructure": "页面整体结构描述（桌面端）",
  "sectionDesigns": [
    {
      "fileName": "Section组件名",
      "sectionType": "section type",
      "sectionDesignBrief": "【Section设计】\\n布局：...\\n背景：...\\n层次：..."
    }
  ]
}

规则：
1) 只考虑 web 桌面端。
2) 不考虑 basiclayout 的 header/footer。
3) 只输出页面整体结构和每个 Section 的静态结构描述，不写交互、跳转、动效实现。
4) sectionDesignBrief 必须严格是四行文本（含标题行）。
5) 输出语言使用用户指定语言。`;

  const userMessage = `你是一个 UI 设计师，请根据需求，设计页面整体结构和效果，要求专业性、美观度、丰富性、高级感的最好水平。

# Design System（必须遵守）
${designSystem}

# 页面信息
- 标题: ${page.title}
- 路由: ${page.slug}
- 描述: ${page.description}
- Journey Stage: ${page.journeyStage}

# 待拆分 Section 列表（必须逐一输出）
${sections
  .map(
    (section, index) =>
      `${index + 1}. fileName=${section.fileName}, type=${section.type}, intent=${section.intent}, contentHints=${section.contentHints}`
  )
  .join("\n")}

# 输出要求：
1. 只需要考虑web桌面端的设计。
2. 不需要考虑basiclayout中的header和footer，只考虑页面内容相关部分。
3. 只输出页面整体结构与分段结构，不输出交互设计、跳转页面、风格实现代码。
4. 以精确简洁方式输出 JSON。
5. 输出语言要求：${language}`;

  try {
    const raw = await callLLM(
      systemPrompt,
      userMessage,
      0.3,
      2200,
      getModelForStep("generate_section")
    );
    const parsed = JSON.parse(extractJSON(raw)) as Partial<DescribePageSectionsResult>;

    const normalizedDesigns: PageSectionDesignBrief[] = sections.map((section) => {
      const incoming = Array.isArray(parsed.sectionDesigns)
        ? parsed.sectionDesigns.find((item) => item.fileName === section.fileName)
        : undefined;
      const fallback = buildFallbackSectionBrief(section);
      return {
        fileName: section.fileName,
        sectionType: section.type,
        sectionDesignBrief: normalizeSectionDesign(
          incoming?.sectionDesignBrief ?? "",
          fallback
        ),
      };
    });

    const pageStructure =
      typeof parsed.pageStructure === "string" && parsed.pageStructure.trim().length > 0
        ? parsed.pageStructure.trim()
        : `${page.title} 页面采用清晰的信息分层与分段编排，按内容目标组织各 Section。`;

    return {
      pageStructure,
      sectionDesigns: normalizedDesigns,
    };
  } catch {
    return {
      pageStructure: `${page.title} 页面采用清晰的信息分层与分段编排，按内容目标组织各 Section。`,
      sectionDesigns: sections.map((section) => ({
        fileName: section.fileName,
        sectionType: section.type,
        sectionDesignBrief: buildFallbackSectionBrief(section),
      })),
    };
  }
}
