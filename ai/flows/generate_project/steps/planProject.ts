import { composePromptBlocks, loadGuardrail, loadStepPrompt, writeSiteFile } from "../shared/files";
import { callLLMWithMeta, extractJSON } from "../shared/llm";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import { stepTraceFromLlmCompletion } from "../shared/llmTrace";
import type {
  PageDesignPlan,
  PlannedProjectBlueprint,
  PlannedPageBlueprint,
  ProjectBlueprint,
  StepTrace,
} from "../types";
import { getModelForStep } from "@/lib/config/models";
import {
  normalizeSharedContracts,
  resolveChromeForm,
  type SharedContract,
} from "../shared/chromeForm";

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

export async function stepPlanProject(blueprint: ProjectBlueprint): Promise<{
  blueprint: PlannedProjectBlueprint;
  trace: StepTrace;
}> {
  const systemPrompt = composePromptBlocks([
    loadStepPrompt("planProject.agent"),
    loadGuardrail("outputJson"),
  ]);

  const pageListHeading =
    "## 需要制定页面级纲要的页面（本步骤不列举 section 文件）";

  const userMessage = `## 项目：${blueprint.brief.projectTitle}
${blueprint.brief.projectDescription}

## 最小产品范围
- 类型：${blueprint.brief.productScope.productType}
- MVP：${blueprint.brief.productScope.mvpDefinition}
- 核心结果：${blueprint.brief.productScope.coreOutcome}
- 设计关键词：${
    blueprint.experience.designIntent.keywords.length > 0
      ? blueprint.experience.designIntent.keywords.join(", ")
      : "（无 — 只信 brief 的「视觉与参考」，禁止脑补 clean / modern / professional）"
  }

> 本步骤**必须由你自行判断**站点 chrome 形态（\`chromeForm\`），并在有 list/detail 等多页共享实体时输出 \`sharedContracts\`。下游 Chrome Scaffold 会按你的选择落壳，再并行写页。
>
> **不要**套用固定产品类型配方（例如「官网必有顶栏」「后台必有 sidebar」）。根据 brief、页面纲要与真实交互需求自由决定壳形态；没有跨页共享壳时选 \`page-local\` 或 \`none\`。
> **不要**在 keywords 为空时脑补 SaaS 气质词（clean / professional / modern 等）。

请输出 JSON，结构如下：
\`\`\`json
{
  "chromeForm": "top-nav+footer | top-nav | sidebar | bottom-tabs | page-local | none",
  "sharedContracts": [
    {
      "entityName": "Item",
      "fields": ["title", "href", "description"],
      "sharedComponentPath": "components/shared/ItemCard.tsx",
      "listSlug": "items",
      "detailRoutePattern": "/items/[id]"
    }
  ],
  "pages": [ /* pageDesignPlan per page — unchanged */ ]
}
\`\`\`

\`chromeForm\` 是你的规划结果标签（供下游所有权编排），不是产品分类表。无 list/detail 共享实体时 \`sharedContracts\` 可为 \`[]\`。

${pageListHeading}
${blueprint.site.pages
    .map(
      (page) =>
        `### ${page.title} (/${page.slug}) — ${page.journeyStage}
- 描述：${page.description}`
    )
    .join("\n\n")}
`;

  const model = getModelForStep("plan_project");

  const meta = await callLLMWithMeta(systemPrompt, userMessage, 0.4, undefined, model, {
    langfuseName: lfPlain(LfPlain.planProject),
  });
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

  const pages: PlannedPageBlueprint[] = parsedPages
    .filter((candidate): candidate is Record<string, unknown> => isObjectRecord(candidate))
    .map((page, pageIndex) => {
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
        sections: [],
        pageDesignPlan: page.pageDesignPlan,
      };
    });

  const chromeForm = resolveChromeForm({
    chromeForm:
      (isObjectRecord(parsed) && parsed.chromeForm) ??
      (isObjectRecord(parsed) &&
        isObjectRecord(parsed.site) &&
        isObjectRecord(parsed.site.informationArchitecture) &&
        parsed.site.informationArchitecture.chromeForm) ??
      blueprint.site.informationArchitecture.chromeForm,
  });

  const sharedContracts: SharedContract[] = normalizeSharedContracts(
    (isObjectRecord(parsed) && parsed.sharedContracts) ??
      (isObjectRecord(parsed) &&
        isObjectRecord(parsed.site) &&
        isObjectRecord(parsed.site.informationArchitecture) &&
        parsed.site.informationArchitecture.sharedContracts) ??
      blueprint.site.informationArchitecture.sharedContracts
  );

  const mergedBlueprint: PlannedProjectBlueprint = {
    brief: blueprint.brief,
    experience: blueprint.experience,
    site: {
      informationArchitecture: {
        ...blueprint.site.informationArchitecture,
        chromeForm,
        sharedContracts,
      },
      pages,
    },
    ...(blueprint.userProvidedContent ? { userProvidedContent: blueprint.userProvidedContent } : {}),
  };

  return {
    blueprint: mergedBlueprint,
    trace,
  };
}
