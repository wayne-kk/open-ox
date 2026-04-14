import { getModelForStep } from "@/lib/config/models";
import { callLLM } from "../shared/llm";
import { loadStepPrompt, writeSiteFile } from "../shared/files";
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

  const systemPrompt = loadStepPrompt("describePageSections");

  const sectionList = sections
    .map(
      (section, index) =>
        `${index + 1}. ${section.fileName} (type=${section.type})\n   intent: ${section.intent}\n   contentHints: ${section.contentHints}`
    )
    .join("\n");

  const userMessage = `# 语言偏好
${language}

# 设计系统（必须遵守配色和风格）
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
      getModelForStep("describe_page_sections")
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
