import { buildDefaultProjectPlan } from "../planners/defaultProjectPlanner";
import {
  getAllowedProjectGuardrailIds,
  mergeProjectGuardrailIds,
} from "../planners/guardrailPolicy";
import { composePromptBlocks, loadGuardrail, loadStepPrompt } from "../shared/files";
import { callLLM, extractJSON } from "../shared/llm";
import { isStringArray } from "../shared/typeGuards";
import type {
  AppScreenPlan,
  PageDesignPlan,
  PlannedProjectBlueprint,
  PlannedSectionSpec,
  ProjectBlueprint,
} from "../types";
import { isLayoutSection } from "../registry/layoutSections";
import { getPromptProfile } from "@/ai/prompts/core/profile";

function isPageDesignPlan(value: unknown): value is PageDesignPlan {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PageDesignPlan>;
  return (
    typeof candidate.pageGoal === "string" &&
    typeof candidate.narrativeArc === "string" &&
    typeof candidate.layoutStrategy === "string" &&
    isStringArray(candidate.hierarchy) &&
    isStringArray(candidate.constraints)
  );
}

function isAppScreenPlan(value: unknown): value is AppScreenPlan {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<AppScreenPlan>;
  return (
    typeof candidate.screenType === "string" &&
    typeof candidate.shellStyle === "string" &&
    typeof candidate.narrative === "string" &&
    Array.isArray(candidate.regions) &&
    candidate.regions.every((region) => {
      if (!region || typeof region !== "object") return false;
      const r = region as unknown as Record<string, unknown>;
      return (
        typeof r.id === "string" &&
        typeof r.title === "string" &&
        typeof r.intent === "string" &&
        typeof r.contentHints === "string"
      );
    }) &&
    !!candidate.interactionModel &&
    typeof candidate.interactionModel === "object"
  );
}

export async function stepPlanProject(
  blueprint: ProjectBlueprint
): Promise<PlannedProjectBlueprint> {
  const appProfile = getPromptProfile() === "app";
  const defaultPlan = buildDefaultProjectPlan(blueprint);
  const appDisallowedSectionTypes = new Set(["faq", "pricing", "testimonials"]);

  const sanitizeSectionsForProfile = (
    sections: PlannedSectionSpec[],
    fallbackSections: PlannedSectionSpec[]
  ): PlannedSectionSpec[] => {
    if (!appProfile) {
      return sections;
    }
    const sanitized = sections.filter(
      (section) => !appDisallowedSectionTypes.has(section.type) && !isLayoutSection(section.type)
    );
    return sanitized.length > 0 ? sanitized : fallbackSections;
  };

  const deriveAppScreenPlanFromSections = (
    sections: PlannedSectionSpec[],
    description: string
  ): AppScreenPlan => {
    const feedLike = sections.some((section) => ["content", "feed"].includes(section.type));
    return {
      screenType: feedLike ? "feed-discovery" : "task-dashboard",
      shellStyle: "mobile-app-shell-with-bottom-tab-navigation",
      narrative: description,
      regions: sections.map((section, index) => ({
        id: `${section.type}-${index + 1}`,
        title: section.fileName,
        intent: section.intent,
        contentHints: section.contentHints,
        priority: index === 0 ? "primary" : index === 1 ? "secondary" : "supporting",
      })),
      interactionModel: {
        navigationStyle: "bottom-tab-and-in-screen-jump-points",
        primaryActionModel: "always-visible-primary-action",
        feedbackPattern: "compact-status-cues-and-immediate-acknowledgement",
      },
      preferredSkillIds: feedLike ? ["screen.feed.discovery"] : ["screen.dashboard.utility"],
    };
  };

  const profileFallbackPlan: PlannedProjectBlueprint = appProfile
    ? {
        ...defaultPlan,
        site: {
          ...defaultPlan.site,
          layoutSections: defaultPlan.site.layoutSections.filter((section) => section.type === "navigation"),
          pages: defaultPlan.site.pages.map((page) => ({
            ...page,
            sections: sanitizeSectionsForProfile(page.sections, page.sections),
            appScreenPlan:
              page.appScreenPlan ??
              deriveAppScreenPlanFromSections(
                sanitizeSectionsForProfile(page.sections, page.sections),
                page.description
              ),
          })),
        },
      }
    : defaultPlan;
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
${blueprint.site.pages.map((page) =>
  `### ${page.title} (/${page.slug}) — ${page.journeyStage}
- Description: ${page.description}
- Roles: ${page.primaryRoleIds.join(", ") || "none"}
- Capabilities: ${page.supportingCapabilityIds.join(", ") || "none"}
- Existing sections: ${page.sections.length > 0 ? page.sections.map((s) => s.type).join(", ") : "NONE — derive from page description and capabilities"}`
).join("\n\n")}

## Layout Sections (shared shells)
${blueprint.site.layoutSections.map((s) => `- ${s.type}: ${s.intent}`).join("\n")}

## Allowed Project Guardrail IDs
${getAllowedProjectGuardrailIds().map((id) => `- ${id}`).join("\n")}

## Keep it simple
- Prefer the smallest section set that satisfies page goals.
- Avoid repeated sections with overlapping intent.
- Sections only need type, intent, contentHints, fileName, and role/capability/taskLoop IDs.
- Do not include designPlan on sections — guardrails and skills are resolved at generation time.${appScreenInstruction}`;

  try {
    const raw = await callLLM(systemPrompt, userMessage, 0.2);
    const parsed = JSON.parse(extractJSON(raw)) as Partial<PlannedProjectBlueprint>;

    if (!isStringArray(parsed.projectGuardrailIds)) {
      return profileFallbackPlan;
    }

    const normalizeStringArray = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

    const normalizePlannedSection = (
      value: unknown,
      fallback: PlannedSectionSpec,
      index: number
    ): PlannedSectionSpec => {
      const candidate = (value && typeof value === "object"
        ? value
        : {}) as Partial<PlannedSectionSpec>;
      const fallbackType = fallback.type || `section-${index + 1}`;
      return {
        type: typeof candidate.type === "string" && candidate.type.trim() ? candidate.type : fallbackType,
        intent:
          typeof candidate.intent === "string" && candidate.intent.trim()
            ? candidate.intent
            : fallback.intent,
        contentHints:
          typeof candidate.contentHints === "string" && candidate.contentHints.trim()
            ? candidate.contentHints
            : fallback.contentHints,
        fileName:
          typeof candidate.fileName === "string" && candidate.fileName.trim()
            ? candidate.fileName
            : fallback.fileName,
        primaryRoleIds:
          normalizeStringArray(candidate.primaryRoleIds).length > 0
            ? normalizeStringArray(candidate.primaryRoleIds)
            : fallback.primaryRoleIds,
        supportingCapabilityIds:
          normalizeStringArray(candidate.supportingCapabilityIds).length > 0
            ? normalizeStringArray(candidate.supportingCapabilityIds)
            : fallback.supportingCapabilityIds,
        sourceTaskLoopIds:
          normalizeStringArray(candidate.sourceTaskLoopIds).length > 0
            ? normalizeStringArray(candidate.sourceTaskLoopIds)
            : fallback.sourceTaskLoopIds,
      };
    };

    const mergeSections = (
      fallbackSections: PlannedSectionSpec[],
      incomingSections: unknown
    ): PlannedSectionSpec[] => {
      if (!Array.isArray(incomingSections) || incomingSections.length === 0) {
        return sanitizeSectionsForProfile(fallbackSections, fallbackSections);
      }
      const merged = incomingSections
        .map((section, index) =>
          normalizePlannedSection(section, fallbackSections[index] ?? fallbackSections[0], index)
        )
        .filter((section) => !isLayoutSection(section.type));
      return sanitizeSectionsForProfile(merged, fallbackSections);
    };

    const mergeLayoutSections = (
      fallbackSections: PlannedSectionSpec[],
      incomingLayoutSections: unknown
    ): PlannedSectionSpec[] => {
      if (!Array.isArray(incomingLayoutSections) || incomingLayoutSections.length === 0) {
        return fallbackSections;
      }
      const merged = incomingLayoutSections
        .map((section, index) =>
          normalizePlannedSection(section, fallbackSections[index] ?? fallbackSections[0], index)
        )
        .filter((section) => isLayoutSection(section.type));
      return merged.length > 0 ? merged : fallbackSections;
    };

    const mergePageDesignPlan = (
      target: PageDesignPlan,
      incomingPage: unknown
    ): PageDesignPlan => {
      if (!incomingPage || typeof incomingPage !== "object") {
        return target;
      }

      const maybePlan = (incomingPage as { pageDesignPlan?: unknown }).pageDesignPlan;
      return isPageDesignPlan(maybePlan) ? maybePlan : target;
    };

    const mergeAppScreenPlan = (
      fallbackPlan: AppScreenPlan | undefined,
      incomingPage: unknown,
      fallbackSections: PlannedSectionSpec[],
      description: string
    ): AppScreenPlan | undefined => {
      if (!appProfile) {
        return undefined;
      }
      if (!incomingPage || typeof incomingPage !== "object") {
        return fallbackPlan ?? deriveAppScreenPlanFromSections(fallbackSections, description);
      }
      const maybePlan = (incomingPage as { appScreenPlan?: unknown }).appScreenPlan;
      if (isAppScreenPlan(maybePlan)) {
        return maybePlan;
      }
      return fallbackPlan ?? deriveAppScreenPlanFromSections(fallbackSections, description);
    };

    return {
      ...profileFallbackPlan,
      projectGuardrailIds: mergeProjectGuardrailIds(
        parsed.projectGuardrailIds,
        profileFallbackPlan.projectGuardrailIds
      ),
      site: {
        ...profileFallbackPlan.site,
        layoutSections: mergeLayoutSections(profileFallbackPlan.site.layoutSections, parsed.site?.layoutSections),
        pages: profileFallbackPlan.site.pages.map((page) => {
          const incomingPage = Array.isArray(parsed.site?.pages)
            ? parsed.site.pages.find(
              (candidate) =>
                candidate &&
                typeof candidate === "object" &&
                (candidate as { slug?: unknown }).slug === page.slug
            )
            : undefined;

          const mergedSections = mergeSections(
            page.sections,
            (incomingPage as { sections?: unknown } | undefined)?.sections
          );

          return {
            ...page,
            pageDesignPlan: mergePageDesignPlan(page.pageDesignPlan, incomingPage),
            sections: sanitizeSectionsForProfile(
              mergedSections.length > 0 ? mergedSections : page.sections,
              page.sections
            ),
            appScreenPlan: mergeAppScreenPlan(
              page.appScreenPlan,
              incomingPage,
              mergedSections.length > 0 ? mergedSections : page.sections,
              page.description
            ),
          };
        }),
      },
    };
  } catch {
    return profileFallbackPlan;
  }
}
