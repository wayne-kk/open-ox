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

> 本步骤**必须由你自行判断**站点 chrome 形态（\`chromeForm\`），并在有 list/detail 等多页共享实体时输出 \`sharedContracts\`。下游 Chrome Scaffold **一定会**按你的选择落壳（Nav / Sidebar / Footer / tabs），Page 只填内容、禁止写壳。
>
> 可选形态：\`top-nav+footer\` | \`top-nav\` | \`sidebar\` | \`bottom-tabs\` | \`none\`（极简壳，仍由 Chrome 拥有）。**不要**使用已删除的 \`page-local\`。
> **不要**套用死板产品类型配方；**不要**在 keywords 为空时脑补 SaaS 气质词（clean / professional / modern 等）。
> 页面清单已经锁定。输出中不要重复页面 slug、标题或描述。\`pageDesignPlans\` 必须严格按下方页面清单顺序排列；规范路由由编排器持有并合并。

请输出 JSON，结构如下：
\`\`\`json
{
  "chromeForm": "top-nav+footer | top-nav | sidebar | bottom-tabs | none",
  "sharedContracts": [
    {
      "entityName": "Item",
      "fields": ["title", "href", "description"],
      "sharedComponentPath": "components/shared/ItemCard.tsx",
      "listSlug": "items",
      "detailRoutePattern": "/items/[id]"
    }
  ],
  "pageDesignPlans": [ /* one pageDesignPlan per canonical page, in input order */ ]
}
\`\`\`

\`chromeForm\` 是你的规划结果标签（供下游所有权编排），不是产品分类表。无 list/detail 共享实体时 \`sharedContracts\` 可为 \`[]\`。

${pageListHeading}
${blueprint.site.pages
    .map(
      (page) =>
        `### ${page.title} (${page.slug === "home" ? "/" : `/${page.slug}`}) — ${page.journeyStage}
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

  const parsedPlans =
    isObjectRecord(parsed) && Array.isArray(parsed.pageDesignPlans)
      ? parsed.pageDesignPlans
      : [];

  if (!isObjectRecord(parsed) || parsedPlans.length === 0) {
    throw new Error(
      "plan_project: invalid JSON — missing pageDesignPlans or empty pageDesignPlans array"
    );
  }

  if (parsedPlans.length !== blueprint.site.pages.length) {
    throw new Error(
      `plan_project: design plan count changed from ${blueprint.site.pages.length} to ${parsedPlans.length}`
    );
  }

  const pageDesignPlans = parsedPlans.map((candidate, pageIndex) => {
    if (!isPageDesignPlan(candidate)) {
      throw new Error(
        `plan_project: pageDesignPlan at index ${pageIndex} is invalid`
      );
    }
    return candidate;
  });

  const pages: PlannedPageBlueprint[] = blueprint.site.pages.map((page, pageIndex) => {
    const pageDesignPlan = pageDesignPlans[pageIndex];
    return {
      ...page,
      sections: [],
      pageDesignPlan,
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

  await writeSiteFile(
    "project-plan.json",
    JSON.stringify({ chromeForm, sharedContracts, pages }, null, 2)
  );

  return {
    blueprint: mergedBlueprint,
    trace,
  };
}
