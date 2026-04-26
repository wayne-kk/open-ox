import {
  composePromptBlocks,
  loadGuardrail,
  loadSectionPrompt,
  loadSystem,
} from "../../shared/files";
import { selectSectionPromptId } from "../../selectors/sectionPromptSelector";
import type { LayoutMode, PlannedSectionSpec } from "../../types";
import type { GenerateSectionPageContext, GenerateSectionProjectContext } from "./types";



function buildSectionPromptBlocks(sectionType: string, layoutMode?: LayoutMode) {
  const sectionPromptId = selectSectionPromptId(sectionType);
  const basePromptId = layoutMode === "whole-page" ? "section.wholePage" : "section.default";
  return [loadSectionPrompt(basePromptId), sectionPromptId !== "section.default" ? loadSectionPrompt(sectionPromptId) : ""]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * `composePromptBlocks` with explicit `loadGuardrail` calls (no runtime guardrail id discovery).
 */
export function buildSystemPrompt(params: {
  section: PlannedSectionSpec;
  skillPrompts: string[];
  designSystem: string;
  layoutMode?: LayoutMode;
}): string {
  const { section, skillPrompts, designSystem, layoutMode } = params;
  const selectedSkillPromptBlock = skillPrompts.filter(Boolean).join("\n\n");

  return composePromptBlocks([
    loadSystem("frontend"),
    loadGuardrail("project.accessibility"),
    `## Design System\n${designSystem}`,
    loadGuardrail("tailwindMappingGuide"),
    buildSectionPromptBlocks(section.type, layoutMode),
    loadGuardrail("skillIntegrationContract"),
    selectedSkillPromptBlock,
    // loadGuardrail("framerMotionVariants"),
    // loadGuardrail("outputTsx"),
  ]);
}

function formatKnownRoutesBlock(pages: GenerateSectionProjectContext["pages"]) {
  return pages
    .map((p) => `- ${p.title}: ${p.slug === "home" ? "/" : `/${p.slug}`}`)
    .join("\n");
}

function buildPageContextBlock(pageContext?: GenerateSectionPageContext) {
  if (!pageContext) {
    return `## 页面上下文\n这是共享布局中的 section，需在整个项目内保持视觉与结构一致。`;
  }
  return `## 页面上下文
- **标题**：${pageContext.title}
- **路由**：${pageContext.slug === "home" ? "/" : `/${pageContext.slug}`}
- **描述**：${pageContext.description}`;
}

export function buildUserMessage(params: {
  projectContext: GenerateSectionProjectContext;
  pageContext?: GenerateSectionPageContext;
  section: PlannedSectionSpec;
  skillPrompts: string[];
  sectionDesignBrief: string;

}) {
  const {
    projectContext,
    pageContext,
    section,
    sectionDesignBrief,
    skillPrompts,
  } = params;
  const selectedSkillPromptBlock = skillPrompts.filter(Boolean).join("\n\n");



  return `## 项目上下文
- **项目**：${projectContext.projectTitle}
- **说明**：${projectContext.projectDescription}
- **语言**：${projectContext.language} — ⚠️ 重要：所有面向用户的文案（标题、按钮、正文、标签、alt 等）**必须**使用上述语言。不要混用其他语言。Skill 示例中的英文仅表示结构，请替换为真实的 ${projectContext.language} 内容。


## 有效路由
**以下为唯一合法路由；导航必须严格使用这些路径。**
${formatKnownRoutesBlock(projectContext.pages) || "- /（首页）"}

${buildPageContextBlock(pageContext)}

## 待生成 Section
- **类型**：${section.type}
- **组件文件名**：${section.fileName}
- **意图**：${section.intent}
- **内容提示**：${section.contentHints}

## Section 设计简介
${selectedSkillPromptBlock ? selectedSkillPromptBlock : sectionDesignBrief}


请生成完整的 \`${section.fileName}.tsx\` 组件。`;
}
