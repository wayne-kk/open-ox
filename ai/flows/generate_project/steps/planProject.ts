import { buildDefaultProjectPlan, buildDefaultAppScreenPlan } from "../planners/defaultProjectPlanner";
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

const MAX_PAGE_SECTIONS_SPLIT = 4;
const MAX_PAGE_SECTIONS_WHOLE = 1;

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
  blueprint: T,
  maxSections: number
): T {
  return {
    ...blueprint,
    site: {
      ...blueprint.site,
      pages: blueprint.site.pages.map((page) => ({
        ...page,
        sections: page.sections.slice(0, maxSections),
      })),
    },
  };
}

// ── Main Step ────────────────────────────────────────────────────────────

export async function stepPlanProject(
  blueprint: ProjectBlueprint,
): Promise<{ blueprint: PlannedProjectBlueprint; trace: StepTrace }> {
  const appProfile = getPromptProfile() === "app";
  const wholePage = !appProfile && blueprint.brief.productScope.layoutMode === "whole-page";
  const maxSections = wholePage ? MAX_PAGE_SECTIONS_WHOLE : MAX_PAGE_SECTIONS_SPLIT;
  const defaultPlan = buildDefaultProjectPlan(blueprint);

  // ── Build LLM prompt ───────────────────────────────────────────────────

  const planPromptId = wholePage ? "planProject.wholePage" : "planProject";
  const systemPrompt = composePromptBlocks([loadStepPrompt(planPromptId), loadGuardrail("outputJson")]);

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

  const layoutModeInstruction = wholePage
    ? `\n## Layout Mode: WHOLE-PAGE / LINE B — single-surface product (critical)
The user product ("${blueprint.brief.productScope.productType}") is implemented as **one** full route surface — *whatever* UI that implies (app shell, full-stage tool, game, etc.).
- Output EXACTLY 1 section in pages[0].sections.
- Do NOT output Hero / Feature / Testimonial / CTA **marketing** stacks (that is Line A).
- The single section carries the **entire** product UI as designed — in-page chrome, main interactive area, and panels **only if** the product needs them — not \`layoutSections\` nav/footer.
- Set \`site.layoutSections\` to \`[]\` (no global Navigation/Footer components).
- Derive \`type\` and \`fileName\` from the **user’s domain words** in the title/description/MVP; do not pick from a small catalog of app names.`
    : `\n## Layout Mode: SPLIT SECTIONS
Output 3–4 sections using appropriate archetypes from the palette in the system prompt.`;

  const layoutSectionsForPrompt = wholePage
    ? "None — whole-page uses an empty `layoutSections` array; the shell is inside the single page section."
    : blueprint.site.layoutSections.map((s) => `- ${s.type}: ${s.intent}`).join("\n");

  const userMessage = `## Project: ${blueprint.brief.projectTitle}
${blueprint.brief.projectDescription}

## Minimal Product Scope
- Type: ${blueprint.brief.productScope.productType}
- MVP: ${blueprint.brief.productScope.mvpDefinition}
- Core Outcome: ${blueprint.brief.productScope.coreOutcome}
- Design Keywords: ${blueprint.experience.designIntent.keywords.join(", ")}
${layoutModeInstruction}

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
${layoutSectionsForPrompt}

## Keep it simple
- Sections only need type, intent, contentHints, fileName.
- Do not include designPlan on sections — guardrails and skills are resolved at generation time.${appScreenInstruction}`;

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

    // Trust the LLM output structure where valid. Fill only missing/invalid fields.
    const pages: PlannedPageBlueprint[] = parsedPages
      .filter((candidate): candidate is Record<string, unknown> => isObjectRecord(candidate))
      .map((page) => {
        const pageSlug = typeof page.slug === "string" ? page.slug : defaultPlan.site.pages[0]?.slug;
        const fallbackPage = defaultPlan.site.pages.find((p) => p.slug === pageSlug) ?? defaultPlan.site.pages[0];
        const rawSections = Array.isArray(page.sections) ? page.sections : [];
        const sections: PlannedSectionSpec[] = rawSections
          .filter((section): section is Record<string, unknown> => isObjectRecord(section))
          .slice(0, maxSections)
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
      site: {
        ...defaultPlan.site,
        layoutSections: wholePage ? [] : (parsedLayoutSections ?? defaultPlan.site.layoutSections),
        pages: normalizedPages,
      },
    };

    return {
      blueprint: clampPageSections(mergedBlueprint, maxSections),
      trace,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      blueprint: clampPageSections(defaultPlan, maxSections),
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
