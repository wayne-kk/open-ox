import { buildDefaultProjectPlan, buildDefaultAppScreenPlan } from "../planners/defaultProjectPlanner";
import { inferProjectGuardrailDefaults } from "../planners/guardrailPolicy";
import { composePromptBlocks, loadGuardrail, loadStepPrompt, writeSiteFile } from "../shared/files";
import { callLLMWithMeta, extractJSON } from "../shared/llm";
import { stepTraceFromLlmCompletion } from "../shared/llmTrace";
import type {
  AppScreenPlan,
  PageDesignPlan,
  PlannedProjectBlueprint,
  PlannedPageBlueprint,
  PlannedSectionSpec,
  ProjectBlueprint,
  StepTrace,
} from "../types";
import { getPromptProfile } from "@/ai/prompts/core/profile";
import { getModelForStep } from "@/lib/config/models";

const MAX_PAGE_SECTIONS = 4;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
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

function isAppScreenPlan(value: unknown): value is AppScreenPlan {
  if (!isObjectRecord(value)) return false;
  if (typeof value.screenType !== "string" || typeof value.shellStyle !== "string" || typeof value.narrative !== "string") {
    return false;
  }
  if (!Array.isArray(value.regions) || !isObjectRecord(value.interactionModel)) return false;
  return (
    typeof value.interactionModel.navigationStyle === "string" &&
    typeof value.interactionModel.primaryActionModel === "string" &&
    typeof value.interactionModel.feedbackPattern === "string"
  );
}

function clampPageSections<T extends { site: { pages: Array<{ sections: PlannedSectionSpec[] }> } }>(
  blueprint: T
): T {
  return {
    ...blueprint,
    site: {
      ...blueprint.site,
      pages: blueprint.site.pages.map((page) => ({
        ...page,
        sections: page.sections.slice(0, MAX_PAGE_SECTIONS),
      })),
    },
  };
}

// ── Main Step ────────────────────────────────────────────────────────────

export async function stepPlanProject(
  blueprint: ProjectBlueprint,
): Promise<{ blueprint: PlannedProjectBlueprint; trace: StepTrace }> {
  const appProfile = getPromptProfile() === "app";
  const defaultPlan = buildDefaultProjectPlan(blueprint);

  // ── Build LLM prompt ───────────────────────────────────────────────────

  const systemPrompt = composePromptBlocks([loadStepPrompt("planProject"), loadGuardrail("outputJson")]);

  const appScreenInstruction = appProfile
    ? `\n## App Screen Plan (required for app profile)
- For each page include \`appScreenPlan\` with:
  - screenType
  - shellStyle
  - narrative
  - regions[] (id, title, intent, contentHints, priority)
  - interactionModel (navigationStyle, primaryActionModel, feedbackPattern)
- Keep \`sections\` as compatibility fallback, but prioritize coherent screen-first regions over section stacks.`
    : "";

  const userMessage = `## Project: ${blueprint.brief.projectTitle}
${blueprint.brief.projectDescription}

## Minimal Product Scope
- Type: ${blueprint.brief.productScope.productType}
- MVP: ${blueprint.brief.productScope.mvpDefinition}
- Core Outcome: ${blueprint.brief.productScope.coreOutcome}
- Design Keywords: ${blueprint.experience.designIntent.keywords.join(", ")}

## Pages to plan sections for
${blueprint.site.pages
      .map(
        (page) =>
          `### ${page.title} (/${page.slug}) — ${page.journeyStage}
- Description: ${page.description}
- Existing sections: ${page.sections.length > 0 ? page.sections.map((s) => s.type).join(", ") : "NONE — derive from page description"}`,
      )
    .join("\n\n")}

## Layout Sections (shared shells)
${blueprint.site.layoutSections.map((s) => `- ${s.type}: ${s.intent}`).join("\n")}

## Keep it simple
- Prefer the smallest section set that satisfies page goals.
- Avoid repeated sections with overlapping intent.
- Sections only need type, intent, contentHints, fileName.
- Do not include designPlan on sections — guardrails and skills are resolved at generation time.${appScreenInstruction}`;

  // ── Call LLM ───────────────────────────────────────────────────────────

  const model = getModelForStep("plan_project");

  try {
    const meta = await callLLMWithMeta(systemPrompt, userMessage, 0.2, undefined, model);
    const raw = meta.content;
    const trace = stepTraceFromLlmCompletion(systemPrompt, userMessage, meta);
    const parsed = JSON.parse(extractJSON(raw)) as unknown;

    // Persist the raw LLM output into the generated project.
    await writeSiteFile("project-plan.json", JSON.stringify(parsed, null, 2));

    const parsedSite = isObjectRecord(parsed) && isObjectRecord(parsed.site) ? parsed.site : undefined;
    const parsedPages = Array.isArray(parsedSite?.pages) ? parsedSite.pages : [];
    const parsedLayoutSections = Array.isArray(parsedSite?.layoutSections) ? parsedSite.layoutSections : undefined;

    // Trust the LLM output structure where valid. Fill only missing/invalid fields.
    const pages: PlannedPageBlueprint[] = parsedPages
      .filter((candidate): candidate is Record<string, unknown> => isObjectRecord(candidate))
      .map((page) => {
        const pageSlug = typeof page.slug === "string" ? page.slug : defaultPlan.site.pages[0]?.slug;
        const fallbackPage = defaultPlan.site.pages.find((p) => p.slug === pageSlug) ?? defaultPlan.site.pages[0];
        const rawSections = Array.isArray(page.sections) ? page.sections : [];
        const sections: PlannedSectionSpec[] = rawSections
          .filter((section): section is Record<string, unknown> => isObjectRecord(section))
          .slice(0, MAX_PAGE_SECTIONS)
          .map((s, index) => {
            const fallbackSection = fallbackPage.sections[index] ?? fallbackPage.sections[0];
            return {
              type: typeof s.type === "string" ? s.type : fallbackSection?.type ?? "Feature",
              intent: typeof s.intent === "string" ? s.intent : fallbackSection?.intent ?? "Support primary page narrative.",
              contentHints: asString(s.contentHints) ?? fallbackSection?.contentHints ?? "",
              fileName: typeof s.fileName === "string" ? s.fileName : fallbackSection?.fileName ?? `Section${index + 1}`,
            };
          });

        return {
          title: asString(page.title) ?? fallbackPage.title,
          slug: asString(page.slug) ?? fallbackPage.slug,
          description: asString(page.description) ?? fallbackPage.description,
          journeyStage: asString(page.journeyStage) ?? fallbackPage.journeyStage,
          primaryRoleIds: fallbackPage.primaryRoleIds,
          supportingCapabilityIds: fallbackPage.supportingCapabilityIds,
          sections,
          pageDesignPlan: isPageDesignPlan(page.pageDesignPlan) ? page.pageDesignPlan : fallbackPage.pageDesignPlan,
          appScreenPlan: appProfile
            ? isAppScreenPlan(page.appScreenPlan)
              ? page.appScreenPlan
              : fallbackPage.appScreenPlan ??
                buildDefaultAppScreenPlan({ description: String(page.description ?? ""), sections: fallbackPage.sections })
            : undefined,
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
      // Guardrails are deterministic — always use defaults, don't ask the LLM.
      projectGuardrailIds: inferProjectGuardrailDefaults(),
      site: {
        ...defaultPlan.site,
        layoutSections: parsedLayoutSections ?? defaultPlan.site.layoutSections,
        pages: normalizedPages,
      },
    };

    return {
      blueprint: clampPageSections(mergedBlueprint),
      trace,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      blueprint: clampPageSections(defaultPlan),
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
