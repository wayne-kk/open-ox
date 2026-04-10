import type {
  PageDesignPlan,
  PlannedPageBlueprint,
  PlannedProjectBlueprint,
  ProjectBlueprint,
  SectionSpec,
} from "../types";
import { inferProjectGuardrailDefaults } from "./guardrailPolicy";

function buildDefaultPageDesignPlan(
  page: {
    description: string;
    journeyStage: string;
    sections: SectionSpec[];
  },
): PageDesignPlan {
  const sectionTypes = page.sections.map((section) => section.type);
  const narrativeArc =
    sectionTypes.length <= 3
      ? "Keep the page tightly focused: establish value, support it, then convert."
      : "Move from orientation to persuasion, then social proof, and finish with a decisive conversion close.";

  return {
    pageGoal: page.description,
    narrativeArc,
    layoutStrategy: `Use section rhythm, spacing, and contrast to support the ${page.journeyStage} stage of the user journey rather than making every block equally loud.`,
    hierarchy: [
      "The first viewport should establish context and value quickly.",
      "Mid-page sections should deepen trust or explain the offer.",
      "Lower-page sections should reduce friction and reinforce action.",
    ],
    constraints: [
      "Preserve the given section order unless a wrapper or grouping is required for coherence.",
      "Avoid repetitive section pacing; vary density and emphasis across the page.",
    ],
  };
}

export function buildDefaultProjectPlan(
  blueprint: ProjectBlueprint
): PlannedProjectBlueprint {
  const layoutSections = blueprint.site.layoutSections;

  const buildMinimalPageSections = (page: {
    primaryRoleIds: string[];
    supportingCapabilityIds: string[];
  }): SectionSpec[] => {
    const base = {
      primaryRoleIds: page.primaryRoleIds,
      supportingCapabilityIds: page.supportingCapabilityIds,
      sourceTaskLoopIds: [] as string[],
    };
    return [
      {
        type: "hero",
        intent: "Establish the offer and primary value immediately.",
        contentHints: "Headline, subheadline, primary CTA, supporting visual.",
        fileName: "HeroSection",
        ...base,
      },
      {
        type: "features",
        intent: "Explain core capabilities and practical benefits.",
        contentHints: "Feature cards with concise benefit-oriented copy.",
        fileName: "FeaturesSection",
        ...base,
      },
      {
        type: "faq",
        intent: "Reduce objections and answer common decision blockers.",
        contentHints: "5-8 concise Q&A items with clear wording.",
        fileName: "FaqSection",
        ...base,
      },
      {
        type: "cta",
        intent: "Drive a decisive conversion action.",
        contentHints: "Strong CTA copy, supporting trust cue, single clear action.",
        fileName: "CtaSection",
        ...base,
      },
    ];
  };

  const pages: PlannedPageBlueprint[] = blueprint.site.pages.map((page) => ({
    ...page,
    pageDesignPlan: buildDefaultPageDesignPlan(page),
    sections: page.sections.length > 0 ? page.sections : buildMinimalPageSections(page),
  }));

  return {
    brief: blueprint.brief,
    experience: blueprint.experience,
    projectGuardrailIds: inferProjectGuardrailDefaults(),
    site: {
      informationArchitecture: blueprint.site.informationArchitecture,
      layoutSections,
      pages,
    },
  };
}
