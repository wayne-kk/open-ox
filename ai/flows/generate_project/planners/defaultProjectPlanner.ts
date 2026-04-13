import type {
  AppScreenPlan,
  PageDesignPlan,
  PlannedPageBlueprint,
  PlannedProjectBlueprint,
  ProjectBlueprint,
  SectionSpec,
} from "../types";
import { inferProjectGuardrailDefaults } from "./guardrailPolicy";
import { getPromptProfile } from "@/ai/prompts/core/profile";

function buildDefaultPageDesignPlan(
  page: {
    description: string;
    journeyStage: string;
    sections: SectionSpec[];
  },
): PageDesignPlan {
  const appProfile = getPromptProfile() === "app";
  const sectionTypes = page.sections.map((section) => section.type);
  const narrativeArc =
    appProfile
      ? sectionTypes.length <= 3
        ? "Lead with the core in-app loop, then deepen engagement through interactive content."
        : "Guide users from immediate orientation into continuous feed/task interaction with clear action affordances."
      : sectionTypes.length <= 3
        ? "Keep the page tightly focused: establish value, support it, then convert."
        : "Move from orientation to persuasion, then social proof, and finish with a decisive conversion close.";

  return {
    pageGoal: page.description,
    narrativeArc,
    layoutStrategy: appProfile
      ? `Use mobile-first density, card rhythm, and interaction cues to support the ${page.journeyStage} stage without turning the page into a marketing narrative.`
      : `Use section rhythm, spacing, and contrast to support the ${page.journeyStage} stage of the user journey rather than making every block equally loud.`,
    hierarchy: appProfile
      ? [
          "The first viewport should expose immediate utility, not long-form positioning copy.",
          "Mid-page sections should maintain feed/task continuity and enable quick scanning.",
          "Lower-page sections should reinforce return loops and lightweight actions.",
        ]
      : [
          "The first viewport should establish context and value quickly.",
          "Mid-page sections should deepen trust or explain the offer.",
          "Lower-page sections should reduce friction and reinforce action.",
        ],
    constraints: [
      "Preserve the given section order unless a wrapper or grouping is required for coherence.",
      "Avoid repetitive section pacing; vary density and emphasis across the page.",
      ...(appProfile
        ? ["Avoid landing-page patterns such as stacked persuasion blocks, pricing matrices, or FAQ-heavy layouts."]
        : []),
    ],
  };
}

function buildDefaultAppScreenPlan(
  page: {
    description: string;
    sections: SectionSpec[];
  }
): AppScreenPlan {
  const feedLike = page.sections.some((section) => ["content", "feed"].includes(section.type));
  return {
    screenType: feedLike ? "feed-discovery" : "task-dashboard",
    shellStyle: "mobile-app-shell-with-bottom-tab-navigation",
    narrative: feedLike
      ? "Keep the screen anchored on a continuous discovery stream with quick interactions."
      : "Keep the screen focused on immediate task entry, status visibility, and short feedback loops.",
    regions: page.sections.map((section, index) => ({
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
}

export function buildDefaultProjectPlan(
  blueprint: ProjectBlueprint
): PlannedProjectBlueprint {
  const appProfile = getPromptProfile() === "app";
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
    if (appProfile) {
      return [
        {
          type: "content",
          intent: "Deliver the primary in-app feed/workspace immediately.",
          contentHints: "Card-based content stream with scan-first information hierarchy.",
          fileName: "ContentSection",
          ...base,
        },
        {
          type: "interactive",
          intent: "Provide direct actions that keep users in the core loop.",
          contentHints: "Action chips, quick filters, composer/entry affordances, and feedback states.",
          fileName: "InteractiveSection",
          ...base,
        },
        {
          type: "stats",
          intent: "Reinforce activity and confidence using compact social/progress signals.",
          contentHints: "Small stats row with concise labels, counts, and contextual relevance.",
          fileName: "StatsSection",
          ...base,
        },
      ];
    }

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

  const pages: PlannedPageBlueprint[] = blueprint.site.pages.map((page) => {
    const sections = page.sections.length > 0 ? page.sections : buildMinimalPageSections(page);
    return {
      ...page,
      pageDesignPlan: buildDefaultPageDesignPlan({ ...page, sections }),
      sections,
      appScreenPlan: appProfile ? buildDefaultAppScreenPlan({ ...page, sections }) : undefined,
    };
  });

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
