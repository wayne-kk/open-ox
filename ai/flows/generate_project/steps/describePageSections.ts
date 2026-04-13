import { getModelForStep } from "@/lib/config/models";
import { callLLM } from "../shared/llm";
import { writeSiteFile } from "../shared/files";
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

// ── Fallback ────────────────────────────────────────────────────────────

function buildFallbackSectionBrief(section: PlannedSectionSpec): string {
  return `围绕"${section.intent}"组织视觉路径。使用纯色背景，与相邻 Section 形成对比。标题区先行，核心内容紧随其后，保持清晰的信息层级。`;
}

// ── Markdown parsing ────────────────────────────────────────────────────

function parseDesignMarkdown(
  raw: string,
  sections: PlannedSectionSpec[]
): { pageStructure: string; briefs: Map<string, string> } {
  const briefs = new Map<string, string>();
  let pageStructure = "";

  // Split by ## headings
  const blocks = raw.split(/^##\s+/m).filter(Boolean);

  for (const block of blocks) {
    const lines = block.split("\n");
    const heading = lines[0].trim();
    const body = lines.slice(1).join("\n").trim();

    if (!body) continue;

    // Check if this heading matches page structure
    if (/页面整体|整体结构|page\s*structure/i.test(heading)) {
      pageStructure = body;
      continue;
    }

    // Try to match heading to a section fileName
    const matchedSection = sections.find(
      (s) =>
        heading === s.fileName ||
        heading.startsWith(s.fileName) ||
        heading.includes(s.fileName)
    );

    if (matchedSection) {
      briefs.set(matchedSection.fileName, body);
    }
  }

  return { pageStructure, briefs };
}

// ── Main ────────────────────────────────────────────────────────────────

export async function stepDescribePageSections(
  params: DescribePageSectionsParams
): Promise<DescribePageSectionsResult> {
  const { designSystem, language, page, sections } = params;

  const systemPrompt = `你是一位顶级 UI 设计总监。你的任务是为一个网页做整体视觉结构设计，输出一份给前端工程师的设计 Brief。

你的输出将直接指导每个 Section 的代码实现，所以必须具体、有画面感、可执行。

## 你要做的事
1. 先描述页面整体的视觉节奏和分段策略
2. 再为每个 Section 写一段自由形式的设计描述

## 每个 Section 的设计描述应该包含（但不限于）
- 空间布局：元素如何排列，留白节奏，视觉重心在哪
- 背景处理：用什么颜色（必须引用 design system 的 token），与上下相邻 Section 如何形成对比
- 元素关系：图片与文字的比例、卡片的排列方式、信息的层级关系
- 情绪氛围：这个区域给用户什么感受，视觉上是紧凑还是舒展

## 硬性约束
- ⚠️ 输出语言必须是：${language}。所有文字必须使用该语言，禁止混用其他语言。
- 禁止输出具体的文案内容（标题、副标题、按钮文字等）。文案由下游步骤决定。
- 图片展示一律使用矩形或圆角矩形。
- 背景以纯色为主。禁止添加噪点、grain、纹理叠加。
- 相邻场景的背景必须有明显色调区分，避免视觉上连成一片。
- 只考虑 web 桌面端。不考虑 header/footer（由 layout 处理）。
- 不要输出代码、字体大小、具体 CSS 值。

## 输出格式

\`\`\`markdown
## 页面整体结构
（整体视觉节奏、背景交替策略、信息密度变化）

## HeroSection
（自由描述这个 Section 的设计意图、空间布局、背景、氛围...）

## FeaturesSection
（自由描述...）
\`\`\``;

  const sectionList = sections
    .map(
      (section, index) =>
        `${index + 1}. ${section.fileName} (type=${section.type})\n   intent: ${section.intent}\n   contentHints: ${section.contentHints}`
    )
    .join("\n");

  const userMessage = `# 设计系统（必须遵守配色和风格）
${designSystem}

# 页面信息
- 标题: ${page.title}
- 描述: ${page.description}
- 路由: /${page.slug}

# 待设计 Section 列表（按页面顺序）
${sectionList}`;

  try {
    const raw = await callLLM(
      systemPrompt,
      userMessage,
      0.3,
      undefined,
      getModelForStep("generate_section")
    );

    const { pageStructure: parsedStructure, briefs } = parseDesignMarkdown(raw, sections);

    const sectionDesigns: PageSectionDesignBrief[] = sections.map((section) => ({
      fileName: section.fileName,
      sectionType: section.type,
      sectionDesignBrief: briefs.get(section.fileName) || buildFallbackSectionBrief(section),
    }));

    const pageStructure =
      parsedStructure.trim().length > 0
        ? parsedStructure.trim()
        : `${page.title} 页面采用清晰的信息分层与分段编排，按内容目标组织各 Section。`;

    // Save to project directory for debugging
    const outputDoc = [
      `# Page Design: ${page.title} (/${page.slug})`,
      "",
      "## 页面整体结构",
      pageStructure,
      "",
      ...sectionDesigns.map((d) => [
        `## ${d.fileName} (${d.sectionType})`,
        d.sectionDesignBrief,
        "",
      ]).flat(),
    ].join("\n");
    await writeSiteFile(`page-design-${page.slug}.md`, outputDoc);

    return { pageStructure, sectionDesigns };
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
