import { buildDefaultPageDesignPlan, buildDefaultProjectPlan } from "../planners/defaultProjectPlanner";
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

// ── Main Step ────────────────────────────────────────────────────────────

export async function stepPlanProject(
  blueprint: ProjectBlueprint
): Promise<{ blueprint: PlannedProjectBlueprint; trace: StepTrace }> {
  const wholePage = blueprint.brief.productScope.layoutMode === "whole-page";
  const defaultPlan = buildDefaultProjectPlan(blueprint);

  // ── Build LLM prompt ───────────────────────────────────────────────────

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

  // ── Call LLM ───────────────────────────────────────────────────────────

  const model = getModelForStep("plan_project");

  try {
    const meta = await callLLMWithMeta(systemPrompt, userMessage, 0.4, undefined, model);
    const raw = meta.content;
    const trace = stepTraceFromLlmCompletion(systemPrompt, userMessage, meta);
    const parsed = JSON.parse(extractJSON(raw)) as unknown;

    // Persist the raw LLM output into the generated project.
    await writeSiteFile("project-plan.json", JSON.stringify(parsed, null, 2));

    const parsedSite = isObjectRecord(parsed) && isObjectRecord(parsed.site) ? parsed.site : undefined;
    const parsedPages = Array.isArray(parsedSite?.pages) ? parsedSite.pages : [];
    const parsedLayoutSections = Array.isArray(parsedSite?.layoutSections) ? parsedSite.layoutSections : undefined;

    const pages: PlannedPageBlueprint[] = parsedPages
      .filter((candidate): candidate is Record<string, unknown> => isObjectRecord(candidate))
      .map((page) => {
        const rawSections = Array.isArray(page.sections) ? page.sections : [];
        const sections: PlannedSectionSpec[] = rawSections
          .filter((section): section is Record<string, unknown> => isObjectRecord(section))
          .map((s, index) => ({
            type: typeof s.type === "string" ? s.type : "Feature",
            intent: typeof s.intent === "string" ? s.intent : "",
            contentHints: asString(s.contentHints) ?? "",
            fileName: typeof s.fileName === "string" ? s.fileName : `Section${index + 1}`,
          }));

        const description = asString(page.description) ?? "";
        const journeyStage = asString(page.journeyStage) ?? "";

        return {
          title: asString(page.title) ?? "",
          slug: asString(page.slug) ?? "",
          description,
          journeyStage,
          primaryRoleIds: asStringArray(page.primaryRoleIds),
          supportingCapabilityIds: asStringArray(page.supportingCapabilityIds),
          sections,
          pageDesignPlan: isPageDesignPlan(page.pageDesignPlan)
            ? page.pageDesignPlan
            : buildDefaultPageDesignPlan({ description, journeyStage, sections }, wholePage),
        };
      });

    const normalizedPages = pages.length > 0 ? pages : defaultPlan.site.pages;

    if (!parsedSite || parsedPages.length === 0) {
      trace.output = {
        ...trace.output,
        warning: "Invalid plan_project JSON shape: missing site/pages, used default pages fallback.",
      };
    }

    const mergedBlueprint: PlannedProjectBlueprint = {
      ...defaultPlan,
      site: {
        ...defaultPlan.site,
        layoutSections: wholePage ? [] : parsedLayoutSections ?? defaultPlan.site.layoutSections,
        pages: normalizedPages,
      },
    };

    return {
      blueprint: mergedBlueprint,
      trace,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      blueprint: defaultPlan,
      trace: {
        llmCall: {
          model,
          systemPrompt,
          userMessage,
          rawResponse: `[plan_project failed — using default plan]\n${message}`,
        },
        output: { fallbackToDefaultPlan: true },
      },
    };
  }
}
