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
        type: "opening-shot",
        intent: "Full-viewport brand impression — the visitor's first emotional reaction.",
        contentHints: "Bold headline, hero visual, one clear invitation to explore.",
        fileName: "HeroSection",
        ...base,
      },
      {
        type: "brand-story",
        intent: "Reveal who this brand is and why it exists — visual narrative with imagery.",
        contentHints: "Brand story told through images and short copy, not a wall of text.",
        fileName: "StorySection",
        ...base,
      },
      {
        type: "product-spotlight",
        intent: "Showcase the core offering with visual richness and detail.",
        contentHints: "Product/service visuals in a curated layout, let the images speak.",
        fileName: "SpotlightSection",
        ...base,
      },
      {
        type: "social-proof",
        intent: "Build trust through real voices and credibility signals.",
        contentHints: "Customer quotes, metrics, or partner logos — presented with visual weight.",
        fileName: "ProofSection",
        ...base,
      },
      {
        type: "closing-invitation",
        intent: "Create a sense of closure and a warm invitation to take the next step.",
        contentHints: "A compelling visual moment with a single clear action.",
        fileName: "ClosingSection",
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
