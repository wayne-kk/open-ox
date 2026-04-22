import type {
  AppScreenPlan,
  PageDesignPlan,
  PlannedPageBlueprint,
  PlannedProjectBlueprint,
  ProjectBlueprint,
  SectionSpec,
} from "../types";
import { getPromptProfile } from "@/ai/prompts/core/profile";


function buildDefaultPageDesignPlan(
  page: {
    description: string;
    journeyStage: string;
    sections: SectionSpec[];
  },
  wholePage = false,
): PageDesignPlan {
  const appProfile = getPromptProfile() === "app";
  const sectionTypes = page.sections.map((section) => section.type);

  const narrativeArc = appProfile || wholePage
    ? "Expose the primary workflow immediately. The interface should feel like a product, not a marketing page."
    : sectionTypes.length <= 3
      ? "Keep the page tightly focused: establish value, support it, then convert."
      : "Move from orientation to persuasion, then social proof, and finish with a decisive conversion close.";

  const layoutStrategy = appProfile || wholePage
    ? "Full-viewport persistent shell. Layout regions (sidebar, main content, panels) defined by product function, not marketing narrative."
    : `Use section rhythm, spacing, and contrast to support the ${page.journeyStage} stage of the user journey.`;

  const hierarchy = appProfile || wholePage
    ? [
        "The interface must be immediately usable — expose the core workflow in the first viewport.",
        "Navigation and structural regions should be persistent and predictable.",
        "Content density should match the product type: feeds are dense, workspaces are focused.",
      ]
    : [
        "The first viewport should establish context and value quickly.",
        "Mid-page sections should deepen trust or explain the offer.",
        "Lower-page sections should reduce friction and reinforce action.",
      ];

  return {
    pageGoal: page.description,
    narrativeArc,
    layoutStrategy,
    hierarchy,
    constraints: [
      "Preserve the given section order unless a wrapper or grouping is required for coherence.",
      "Avoid repetitive section pacing; vary density and emphasis across the page.",
      ...((appProfile || wholePage)
        ? ["Avoid landing-page patterns: no hero manifestos, testimonial bands, or FAQ-heavy layouts."]
        : []),
    ],
  };
}

export function buildDefaultAppScreenPlan(
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
  const wholePage = !appProfile && blueprint.brief.productScope.layoutMode === "whole-page";

  const buildMinimalPageSections = (): SectionSpec[] => {
    if (appProfile) {
      return [
        {
          type: "content",
          intent: "Deliver the primary in-app feed/workspace immediately.",
          contentHints: "Card-based content stream with scan-first information hierarchy.",
          fileName: "ContentSection",
        },
        {
          type: "interactive",
          intent: "Provide direct actions that keep users in the core loop.",
          contentHints: "Action chips, quick filters, composer/entry affordances, and feedback states.",
          fileName: "InteractiveSection",
        },
        {
          type: "stats",
          intent: "Reinforce activity and confidence using compact social/progress signals.",
          contentHints: "Small stats row with concise labels, counts, and contextual relevance.",
          fileName: "StatsSection",
        },
      ];
    }

    // Whole-page web app: single section carries the entire application UI
    if (wholePage) {
      return [
        {
          type: "MainContent",
          intent: `Primary application interface for: ${blueprint.brief.projectDescription}`,
          contentHints:
            "Full-viewport persistent shell. Derive layout regions (sidebar, main area, panels) " +
            "from the product type and description. Include realistic mock content.",
          fileName: "MainContentSection",
        },
      ];
    }

    return [
      {
        type: "hero",
        intent: "Full-viewport brand impression — the visitor's first emotional reaction.",
        contentHints: "Bold headline, hero visual, one clear invitation to explore.",
        fileName: "HeroSection",
      },
      {
        type: "storyblock",
        intent: "Reveal who this brand is and why it exists — visual narrative with imagery.",
        contentHints: "Brand story told through images and short copy, not a wall of text.",
        fileName: "StorySection",
      },
      {
        type: "showcase",
        intent: "Showcase the core offering with visual richness and detail.",
        contentHints: "Product/service visuals in a curated layout, let the images speak.",
        fileName: "SpotlightSection",
      },
      {
        type: "testimonial",
        intent: "Build trust through real voices and credibility signals.",
        contentHints: "Customer quotes, metrics, or partner logos — presented with visual weight.",
        fileName: "ProofSection",
      },
      {
        type: "cta",
        intent: "Create a sense of closure and a warm invitation to take the next step.",
        contentHints: "A compelling visual moment with a single clear action.",
        fileName: "ClosingSection",
      },
    ];
  };

  const pages: PlannedPageBlueprint[] = blueprint.site.pages.map((page) => {
    const sections = page.sections.length > 0 ? page.sections : buildMinimalPageSections();
    return {
      ...page,
      pageDesignPlan: buildDefaultPageDesignPlan({ ...page, sections }, wholePage),
      sections,
      appScreenPlan: appProfile ? buildDefaultAppScreenPlan({ ...page, sections }) : undefined,
    };
  });

  return {
    brief: blueprint.brief,
    experience: blueprint.experience,
    site: {
      informationArchitecture: blueprint.site.informationArchitecture,
      layoutSections,
      pages,
    },
  };
}
