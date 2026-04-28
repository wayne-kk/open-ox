import { composePromptBlocks, loadGuardrail, loadStepPrompt, writeSiteFile } from "../shared/files";
import { callLLMWithMeta, extractJSON } from "../shared/llm";
import { stepTraceFromLlmCompletion } from "../shared/llmTrace";
import type {
  PageDesignPlan,
  PlannedProjectBlueprint,
  PlannedPageBlueprint,
  PlannedSectionSpec,
  ProjectBlueprint,
  StepTrace,
} from "../types";
import { getModelForStep } from "@/lib/config/models";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string");
}

function isPageDesignPlan(value: unknown): value is PageDesignPlan {
  if (!isObjectRecord(value)) return false;
  return (
    typeof value.pageGoal === "string" &&
    typeof value.narrativeArc === "string" &&
    typeof value.layoutStrategy === "string" &&
    Array.isArray(value.hierarchy) &&
    value.hierarchy.every((item) => typeof item === "string") &&
    Array.isArray(value.constraints) &&
    value.constraints.every((item) => typeof item === "string")
  );
}

function mapToPlannedSections(raw: unknown): PlannedSectionSpec[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((section): section is Record<string, unknown> => isObjectRecord(section))
    .map((s, index) => ({
      type: typeof s.type === "string" ? s.type : "Feature",
      intent: typeof s.intent === "string" ? s.intent : "",
      contentHints: asString(s.contentHints) ?? "",
      fileName: typeof s.fileName === "string" ? s.fileName : `Section${index + 1}`,
    }));
}

// ── Main Step ────────────────────────────────────────────────────────────

export async function stepPlanProject(
  blueprint: ProjectBlueprint
): Promise<{ blueprint: PlannedProjectBlueprint; trace: StepTrace }> {
  const wholePage = blueprint.brief.productScope.layoutMode === "whole-page";

  const planPromptId = wholePage ? "planProject.wholePage" : "planProject";
  const systemPrompt = composePromptBlocks([loadStepPrompt(planPromptId), loadGuardrail("outputJson")]);

  const userMessage = `## 项目：${blueprint.brief.projectTitle}
${blueprint.brief.projectDescription}

## 最小产品范围
- 类型：${blueprint.brief.productScope.productType}
- MVP：${blueprint.brief.productScope.mvpDefinition}
- 核心结果：${blueprint.brief.productScope.coreOutcome}
- 设计关键词：${blueprint.experience.designIntent.keywords.join(", ")}

## 需要规划 section 的页面
${blueprint.site.pages
      .map(
        (page) =>
          `### ${page.title} (/${page.slug}) — ${page.journeyStage}
- 描述：${page.description}`
      )
      .join("\n\n")}
`;

  const model = getModelForStep("plan_project");

  const meta = await callLLMWithMeta(systemPrompt, userMessage, 0.4, undefined, model);
  const raw = meta.content;
  const trace = stepTraceFromLlmCompletion(systemPrompt, userMessage, meta);
  const parsed = JSON.parse(extractJSON(raw)) as unknown;

  await writeSiteFile("project-plan.json", JSON.stringify(parsed, null, 2));

  const parsedPages =
    isObjectRecord(parsed) && Array.isArray(parsed.pages)
      ? parsed.pages
      : isObjectRecord(parsed) && isObjectRecord(parsed.site) && Array.isArray(parsed.site.pages)
        ? parsed.site.pages
        : [];

  if (!isObjectRecord(parsed) || parsedPages.length === 0) {
    throw new Error("plan_project: invalid JSON — missing pages or empty pages array");
  }

  const parsedLayoutSections =
    isObjectRecord(parsed) && isObjectRecord(parsed.site) && Array.isArray(parsed.site.layoutSections)
      ? parsed.site.layoutSections
      : undefined;

  const pages: PlannedPageBlueprint[] = parsedPages
    .filter((candidate): candidate is Record<string, unknown> => isObjectRecord(candidate))
    .map((page, pageIndex) => {
      const rawSections = Array.isArray(page.sections) ? page.sections : [];
      const sections: PlannedSectionSpec[] = mapToPlannedSections(rawSections);

      const description = asString(page.description) ?? "";
      const journeyStage = asString(page.journeyStage) ?? "";

      if (!isPageDesignPlan(page.pageDesignPlan)) {
        throw new Error(
          `plan_project: page at index ${pageIndex} (${asString(page.slug) ?? "?"}) has missing or invalid pageDesignPlan`
        );
      }

      return {
        title: asString(page.title) ?? "",
        slug: asString(page.slug) ?? "",
        description,
        journeyStage,
        primaryRoleIds: asStringArray(page.primaryRoleIds),
        supportingCapabilityIds: asStringArray(page.supportingCapabilityIds),
        sections,
        pageDesignPlan: page.pageDesignPlan,
      };
    });

  const mergedBlueprint: PlannedProjectBlueprint = {
    brief: blueprint.brief,
    experience: blueprint.experience,
    site: {
      informationArchitecture: blueprint.site.informationArchitecture,
      layoutSections: wholePage
        ? []
        : parsedLayoutSections !== undefined
          ? mapToPlannedSections(parsedLayoutSections)
          : blueprint.site.layoutSections,
      pages,
    },
  };

  return {
    blueprint: mergedBlueprint,
    trace,
  };
}
