import { buildDefaultProjectPlan, buildDefaultAppScreenPlan } from "../planners/defaultProjectPlanner";
import { inferProjectGuardrailDefaults } from "../planners/guardrailPolicy";
import { composePromptBlocks, loadGuardrail, loadStepPrompt, writeSiteFile } from "../shared/files";
import { callLLM, extractJSON } from "../shared/llm";
import type {
  PlannedProjectBlueprint,
  PlannedPageBlueprint,
  PlannedSectionSpec,
  ProjectBlueprint,
} from "../types";
import { getPromptProfile } from "@/ai/prompts/core/profile";
import { getModelForStep } from "@/lib/config/models";

// ── Main Step ────────────────────────────────────────────────────────────

export async function stepPlanProject(
  blueprint: ProjectBlueprint,
): Promise<PlannedProjectBlueprint> {
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

  try {
    const raw = await callLLM(systemPrompt, userMessage, 0.2, undefined, getModelForStep("plan_project"));
    const parsed = JSON.parse(extractJSON(raw)) as PlannedProjectBlueprint;

    // Persist the raw LLM output into the generated project.
    await writeSiteFile("project-plan.json", JSON.stringify(parsed, null, 2));

    // Trust the LLM output structure. Fill only the fields it doesn't produce.
    const pages: PlannedPageBlueprint[] = parsed.site.pages.map((page) => {
      const fallbackPage = defaultPlan.site.pages.find((p) => p.slug === page.slug) ?? defaultPlan.site.pages[0];
      const sections: PlannedSectionSpec[] = page.sections.map((s) => ({
        type: s.type,
        intent: s.intent,
        contentHints: s.contentHints,
        fileName: s.fileName,
      }));

      return {
        ...fallbackPage,
        ...page,
        sections,
        pageDesignPlan: page.pageDesignPlan ?? fallbackPage.pageDesignPlan,
        appScreenPlan: appProfile
          ? (page.appScreenPlan ?? fallbackPage.appScreenPlan ?? buildDefaultAppScreenPlan({ description: page.description, sections: fallbackPage.sections }))
          : undefined,
      };
    });

    return {
      ...defaultPlan,
      // Guardrails are deterministic — always use defaults, don't ask the LLM.
      projectGuardrailIds: inferProjectGuardrailDefaults(),
      site: {
        ...defaultPlan.site,
        layoutSections: parsed.site.layoutSections ?? defaultPlan.site.layoutSections,
        pages,
      },
    };
  } catch {
    return defaultPlan;
  }
}
