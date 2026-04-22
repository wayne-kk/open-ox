import { getModelForStep } from "@/lib/config/models";
import { callLLMWithMeta } from "../shared/llm";
import { stepTraceFromLlmCompletion } from "../shared/llmTrace";
import { loadStepPrompt, writeSiteFile } from "../shared/files";
import type { LayoutMode, PlannedPageBlueprint, PlannedSectionSpec, StepTrace } from "../types";

export interface PageSectionDesignBrief {
  fileName: string;
  sectionType: string;
  sectionDesignBrief: string;
}

export interface DescribePageSectionsResult {
  pageStructure: string;
  sectionDesigns: PageSectionDesignBrief[];
  trace?: StepTrace;
}

export interface DescribePageSectionsParams {
  designSystem: string;
  language: string;
  layoutMode: LayoutMode;
  page: PlannedPageBlueprint;
  sections: PlannedSectionSpec[];
}

// ── Fallback ────────────────────────────────────────────────────────────

function pickFallbackBackground(index: number, total: number): string {
  // Avoid only `background` vs `muted/20` — surfaces must read as different "blocks" at a glance.
  if (total >= 4 && index === Math.floor((total - 1) / 2)) {
    return "bg-foreground";
  }
  const palette = ["bg-background", "bg-secondary/30", "bg-muted/35", "bg-primary/15"] as const;
  return palette[index % palette.length];
}

function buildFallbackBrief(_section: PlannedSectionSpec, index: number, total: number): string {
  const background = pickFallbackBackground(index, total);
  const density = index % 3 === 0 ? "spacious" : "standard";
  const focus =
    background === "bg-foreground"
      ? "高对比主标题与主行动区"
      : "标题层级与核心信息卡片";
  const structure =
    index >= 2 ? "引用署名或指标条 + 一个辅助信息块" : "主标题区 + 结构化信息块（卡片或指标）";
  return [
    `背景色：${background}`,
    "构图方式：稳定的中心或双栏布局，避免无意义偏移",
    `视觉焦点：${focus}`,
    `节奏密度：${density}`,
    `结构要点：${structure}`,
  ].join("\n");
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
  const { language, layoutMode, page, sections, designSystem } = params;

  const promptId = layoutMode === "whole-page"
    ? "describePageSections.wholePage"
    : "describePageSections";
  const systemPrompt = loadStepPrompt(promptId);

  const sectionList = sections
    .map(
      (s, i) =>
        `${i + 1}. ${s.fileName}\n   type: ${s.type}\n   intent: ${s.intent}\n   contentHints: ${s.contentHints}`
    )
    .join("\n");

  const userMessage = `# 语言偏好
${language}
# task
根据 section 数量、类型、intent、contentHints 和 designSystem，为每个 section 产出布局 brief
# 页面: ${page.title} (/${page.slug})
# Section 数量: ${sections.length}（${sections.length === 1 ? "整页组件模式——唯一 section 承载完整页面 UI" : "分段页面模式——多个 section 依次堆叠"}）
# designSystem:
${designSystem}
# Section 列表（按页面顺序）
${sectionList}`;

  const describeModel = getModelForStep("describe_page_sections");

  try {
    const meta = await callLLMWithMeta(systemPrompt, userMessage, 0.7, undefined, describeModel);
    const raw = meta.content;
    const trace = stepTraceFromLlmCompletion(systemPrompt, userMessage, meta);

    const { pageStructure: parsed, briefs } = parseSectionBriefs(raw, sections);

    const sectionDesigns: PageSectionDesignBrief[] = sections.map((section, i) => ({
      fileName: section.fileName,
      sectionType: section.type,
      sectionDesignBrief: briefs.get(section.fileName) || buildFallbackBrief(section, i, sections.length),
    }));

    const pageStructure =
      parsed.trim() ||
      "整体节奏：表面阶梯至少包含 background、secondary 或 muted 的可见分层，以及一段 bg-foreground 反转带（或同等级强反差，见 brief 规则）；禁止全页仅奶油色明度微调。首屏 spacious，中段 standard/compact 交替；logo/press 条需可读对比（禁止整行 opacity-60 + text-foreground/40 叠加）。纹理最多页面级一次。标题最多两行，hover 默认 subtle。";

    await writeSiteFile(`page-design-${page.slug}.md`, raw);

    return { pageStructure, sectionDesigns, trace };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      pageStructure:
        "整体节奏：表面阶梯含 background / secondary|muted ；禁止仅 muted/20↔background 机械交替。logo/press 对比充足；纹理最多页面级一次。首屏 spacious，中段 standard/compact；标题最多两行，hover 默认 subtle。",
      sectionDesigns: sections.map((section, i) => ({
        fileName: section.fileName,
        sectionType: section.type,
        sectionDesignBrief: buildFallbackBrief(section, i, sections.length),
      })),
      trace: {
        llmCall: {
          model: describeModel,
          systemPrompt,
          userMessage,
          rawResponse: `[describe_page_sections failed — using fallbacks]\n${message}`,
        },
      },
    };
  }
}
