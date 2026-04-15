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

function buildFallbackBrief(section: PlannedSectionSpec, index: number): string {
  // Alternate light/dark as a simple fallback
  return index % 2 === 0
    ? `背景色：使用设计系统中的浅色背景。明亮开阔。`
    : `背景色：使用设计系统中的深一档背景。沉稳收敛。`;
}

// ── Markdown parsing ────────────────────────────────────────────────────

function parseSectionBriefs(
  raw: string,
  sections: PlannedSectionSpec[]
): { pageStructure: string; briefs: Map<string, string> } {
  const briefs = new Map<string, string>();
  let pageStructure = "";

  const blocks = raw.split(/^#{2,3}\s+/m).filter(Boolean);

  for (const block of blocks) {
    const firstNewline = block.indexOf("\n");
    if (firstNewline === -1) continue;

    const heading = block.slice(0, firstNewline).trim();
    const body = block.slice(firstNewline + 1).trim();
    if (!body) continue;

    if (/页面整体|整体结构|page\s*structure/i.test(heading)) {
      pageStructure = body;
      continue;
    }

    const matched = sections.find(
      (s) => heading.includes(s.fileName) || heading.toLowerCase().includes(s.fileName.toLowerCase())
    );
    if (matched && !briefs.has(matched.fileName)) {
      briefs.set(matched.fileName, body);
    }
  }

  return { pageStructure, briefs };
}

// ── Main ────────────────────────────────────────────────────────────────

export async function stepDescribePageSections(
  params: DescribePageSectionsParams
): Promise<DescribePageSectionsResult> {
  const { language, page, sections, designSystem } = params;

  const systemPrompt = loadStepPrompt("describePageSections");

  const sectionList = sections
    .map((s, i) => `${i + 1}. ${s.fileName}`)
    .join("\n");

  const userMessage = `# 语言偏好
${language}
# task 
根据 designSystem 确定背景色策略
# 页面: ${page.title} (/${page.slug})
# designSystem: 
${designSystem}
# Section 列表（按页面顺序）
${sectionList}`;

  try {
    const raw = await callLLM(
      systemPrompt,
      userMessage,
      0.3,
      undefined,
      getModelForStep("describe_page_sections")
    );

    const { pageStructure: parsed, briefs } = parseSectionBriefs(raw, sections);

    const sectionDesigns: PageSectionDesignBrief[] = sections.map((section, i) => ({
      fileName: section.fileName,
      sectionType: section.type,
      sectionDesignBrief: briefs.get(section.fileName) || buildFallbackBrief(section, i),
    }));

    const pageStructure = parsed.trim() || `交替背景色，形成明暗节奏。`;

    await writeSiteFile(`page-design-${page.slug}.md`, raw);

    return { pageStructure, sectionDesigns };
  } catch {
    return {
      pageStructure: `交替背景色，形成明暗节奏。`,
      sectionDesigns: sections.map((section, i) => ({
        fileName: section.fileName,
        sectionType: section.type,
        sectionDesignBrief: buildFallbackBrief(section, i),
      })),
    };
  }
}
