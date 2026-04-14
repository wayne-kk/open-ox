import {
  composePromptBlocks,
  formatSiteFile,
  hasSkillPrompt,
  loadGuardrail,
  loadSkillPrompt,
  loadStepPrompt,
  loadSystem,
  writeSiteFile,
} from "../shared/files";
import { callLLM, extractContent } from "../shared/llm";
import { getModelForStep } from "@/lib/config/models";
import type { AppScreenPlan, PlannedPageBlueprint, ProductScope } from "../types";

type ScreenProjectContext = {
  projectTitle: string;
  projectDescription: string;
  language: string;
  productScope: ProductScope;
  designKeywords: string[];
  pages: Array<{
    slug: string;
    title: string;
    description: string;
    journeyStage: string;
  }>;
};

export interface GenerateScreenParams {
  page: PlannedPageBlueprint;
  designSystem: string;
  projectContext: ScreenProjectContext;
  outputFileRelative: string;
}

function chooseScreenSkillIds(plan: AppScreenPlan | undefined, keywords: string[]): string[] {
  const ids: string[] = [];
  for (const id of plan?.preferredSkillIds ?? []) {
    if (hasSkillPrompt(id)) {
      ids.push(id);
    }
  }

  const joined = keywords.join(" ").toLowerCase();
  const colorAuditIntent =
    /(color|colour|palette|theme|branding|brand color|配色|色彩|颜色|主题色|色板|视觉规范|design token)/.test(
      joined
    );
  if (colorAuditIntent && hasSkillPrompt("screen.color.system.audit")) {
    ids.push("screen.color.system.audit");
  }

  if (ids.length === 0) {
    if (/(feed|discovery|social|community|xiaohongshu|小红书|瀑布流|卡片)/.test(joined)) {
      ids.push("screen.feed.discovery");
    } else if (/(task|utility|dashboard|tool|workflow|record)/.test(joined)) {
      ids.push("screen.dashboard.utility");
    } else {
      ids.push("screen.community.profile");
    }
  }

  return Array.from(new Set(ids.filter((id) => hasSkillPrompt(id))));
}

function buildScreenPrompt(plan: AppScreenPlan | undefined): string {
  if (!plan) {
    return "- No explicit screen plan was provided. Build a coherent single-screen app experience.";
  }
  return `- Screen Type: ${plan.screenType}
- Shell Style: ${plan.shellStyle}
- Narrative: ${plan.narrative}
- Regions:
${plan.regions
  .map(
    (region) =>
      `  - ${region.id} [${region.priority}]: ${region.intent} | ${region.contentHints}`
  )
  .join("\n")}
- Interaction Model:
  - navigationStyle: ${plan.interactionModel.navigationStyle}
  - primaryActionModel: ${plan.interactionModel.primaryActionModel}
  - feedbackPattern: ${plan.interactionModel.feedbackPattern}`;
}

function buildKnownRoutesBlock(pages: ScreenProjectContext["pages"]): string {
  return pages
    .map((p) => `- ${p.title} (${p.slug}): ${p.slug === "home" ? "/" : `/${p.slug}`}`)
    .join("\n");
}

export async function stepGenerateScreen({
  page,
  designSystem,
  projectContext,
  outputFileRelative,
}: GenerateScreenParams): Promise<{ filePath: string; skillIds: string[] }> {
  const skillIds = chooseScreenSkillIds(page.appScreenPlan, [
    ...projectContext.designKeywords,
    projectContext.productScope.productType,
  ]);
  const skillBlock = skillIds.map((id) => loadSkillPrompt(id)).join("\n\n");
  const systemPrompt = composePromptBlocks([
    loadSystem("frontend"),
    loadStepPrompt("generateScreen"),
    skillBlock,
    loadGuardrail("project.consistency"),
    loadGuardrail("project.accessibility"),
    loadGuardrail("screen.layout"),
    loadGuardrail("screen.styles"),
    loadGuardrail("screen.typography"),
    loadGuardrail("outputTsx"),
  ]);
  const userMessage = `## Project Context
- Project: ${projectContext.projectTitle}
- Description: ${projectContext.projectDescription}
- Language: ${projectContext.language}
- Product Type: ${projectContext.productScope.productType}
- Core Outcome: ${projectContext.productScope.coreOutcome}
- Business Goal: ${projectContext.productScope.businessGoal}

## Known Routes
${buildKnownRoutesBlock(projectContext.pages)}

## Page Context
- Title: ${page.title}
- Route: ${page.slug === "home" ? "/" : `/${page.slug}`}
- Description: ${page.description}
- Journey Stage: ${page.journeyStage}
- Page Goal: ${page.pageDesignPlan.pageGoal}

## Screen Plan
${buildScreenPrompt(page.appScreenPlan)}

## Design System
${designSystem}

## Design System -> Tailwind Mapping (mandatory)
- Colors: use token-based utilities such as \`bg-background\`, \`bg-card\`, \`text-foreground\`, \`text-muted-foreground\`, \`border-border\`, \`bg-accent\`.
- Typography: use font token utilities like \`font-header\`, \`font-body\`, \`font-label\` where appropriate.
- Effects: use existing tokenized utilities (\`shadow-*\`, \`animate-*\`, \`ds-*\`) instead of raw custom CSS.
- Do not emit mostly unstyled HTML. Key containers, cards, controls, and text hierarchy must all have explicit Tailwind classes.

Generate a single self-contained screen component named AppScreen.
The component should represent the whole page surface in one coherent structure, not stacked marketing sections.`;
  const model = getModelForStep("generate_screen");
  const raw = await callLLM(systemPrompt, userMessage, 0.4, undefined, model);
  const tsx = extractContent(raw, "tsx");

  await writeSiteFile(outputFileRelative, tsx);
  await formatSiteFile(outputFileRelative);

  if (!/export\s+default\s+function\s+AppScreen|export\s+function\s+AppScreen/.test(tsx)) {
    throw new Error("generate_screen: AppScreen export is missing");
  }

  return { filePath: outputFileRelative, skillIds };
}
