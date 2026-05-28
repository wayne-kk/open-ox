import { composePromptBlocks, loadGuardrail, loadStepPrompt, writeSiteFile } from "../shared/files";
import { callLLMWithMeta, extractJSON } from "../shared/llm";
import { lfPlain, LfPlain } from "@/lib/observability/langfuseGenerationCatalog";
import { stepTraceFromLlmCompletion } from "../shared/llmTrace";
import type {
  PageDesignPlan,
  PlannedProjectBlueprint,
  PlannedPageBlueprint,
  ProjectBlueprint,
  PageMapEntry,
  ScreenshotIntentMode,
  StepTrace,
} from "../types";
import { MULTI_ROUTE_NAVIGATION_MODEL_HINT } from "../schema/normalizeBlueprint";
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

export async function stepPlanProject(
  blueprint: ProjectBlueprint,
  options?: { screenshotIntentMode?: ScreenshotIntentMode }
): Promise<{
  blueprint: PlannedProjectBlueprint;
  trace: StepTrace;
}> {
  const systemPrompt = composePromptBlocks([
    loadStepPrompt("planProject.agent"),
    loadGuardrail("outputJson"),
  ]);

  const pageListHeading =
    "## 需要制定页面级纲要的页面（本步骤不列举 section 文件）";

  const screenshotReplicateBlock =
    options?.screenshotIntentMode === "replicate_layout"
      ? `

## 参考截图·版式复刻（必读）

上游需求分析已判定为 **按截图高保真布局**。你只收到文本蓝图，但必须假定存在一张 **参考截图** 由下游实现 Agent 直视：

- \`pageDesignPlan.hierarchy\`、\`narrativeArc\`、\`layoutStrategy\` 必须与 **用户在 analyze 阶段写明的截图分区** 一致；**禁止**套用泛用落地页链条（如「hero→社会证明→CTA」）去覆盖截图里实际没有的分区。
- \`constraints\` 中**必须**包含一条：「实现时禁止新增截图未见的主内容区块；global chrome 仅以截图可见壳层为准」。
- **不要**在纲要里写上截图中未见的功能模块名称（价格表矩阵、FAQ、客户 logo 墙等），除非它们在 brief/productScope 中可追溯到用户文字或图中可见。

`
      : "";

  const multiRouteNote =
    blueprint.site.pages.length > 1
      ? `

## 多路由站点（必读）

上游 **analyze** 已给出 **${blueprint.site.pages.length}** 条顶层路由。你的 JSON 里 \`pages[]\` **必须**与同序、同 slug 一一对应；每个 \`pageDesignPlan\` 要写出**该路由独有**的目标与信息流，禁止把多条路由揉成「一个大滚动页」来写。
`
      : "";

  const userMessage = `## 项目：${blueprint.brief.projectTitle}
${blueprint.brief.projectDescription}

## 最小产品范围
- 类型：${blueprint.brief.productScope.productType}
- MVP：${blueprint.brief.productScope.mvpDefinition}
- 核心结果：${blueprint.brief.productScope.coreOutcome}
- 设计关键词：${blueprint.experience.designIntent.keywords.join(", ")}
${screenshotReplicateBlock}
${multiRouteNote}
> 布局形态（顶 nav / sidebar / footer / 工具栏 / 无 chrome 等）由下游实现 Agent 根据产品形态决定。本步骤**不要**预先指定 chrome。

${pageListHeading}
${blueprint.site.pages
    .map((page) => {
      const route = page.slug === "home" ? "/" : `/${page.slug}`;
      return `### ${page.title} (${route}) — ${page.journeyStage}
- slug: \`${page.slug}\`
- 描述：${page.description}`;
    })
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

  if (pages.length !== blueprint.site.pages.length) {
    throw new Error(
      `plan_project: page count must match analyze blueprint (${blueprint.site.pages.length}), got ${pages.length}`
    );
  }

  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const orderedPages: PlannedPageBlueprint[] = [];
  for (const b of blueprint.site.pages) {
    const plannedPage = bySlug.get(b.slug);
    if (!plannedPage) {
      throw new Error(
        `plan_project: planned output missing slug "${b.slug}" from analyze blueprint ([${blueprint.site.pages.map((x) => x.slug).join(", ")}])`
      );
    }
    orderedPages.push(plannedPage);
  }
  if (bySlug.size !== orderedPages.length) {
    throw new Error(
      `plan_project: planned output has unknown slugs; expected exactly [${blueprint.site.pages.map((x) => x.slug).join(", ")}]`
    );
  }

  const pageMap: PageMapEntry[] = orderedPages.map((p) => ({
    slug: p.slug,
    title: p.title,
    purpose: p.description,
    primaryRoleIds: p.primaryRoleIds,
    supportingCapabilityIds: p.supportingCapabilityIds,
    journeyStage: p.journeyStage,
  }));

  const isMultiRoute = orderedPages.length > 1;
  const upstreamNav = blueprint.site.informationArchitecture.navigationModel?.trim() ?? "";

  const mergedBlueprint: PlannedProjectBlueprint = {
    brief: blueprint.brief,
    experience: blueprint.experience,
    site: {
      informationArchitecture: {
        ...blueprint.site.informationArchitecture,
        pageMap,
        navigationModel: isMultiRoute
          ? upstreamNav
            ? `${MULTI_ROUTE_NAVIGATION_MODEL_HINT}\n\nUpstream note: ${upstreamNav}`
            : MULTI_ROUTE_NAVIGATION_MODEL_HINT
          : blueprint.site.informationArchitecture.navigationModel,
      },
      pages: orderedPages,
    },
  };

  return {
    blueprint: mergedBlueprint,
    trace,
  };
}
