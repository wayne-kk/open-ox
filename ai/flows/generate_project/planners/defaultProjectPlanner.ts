import type {
  PageDesignPlan,
  PlannedPageBlueprint,
  PlannedProjectBlueprint,
  ProjectBlueprint,
  SectionSpec,
} from "../types";

export function buildDefaultPageDesignPlan(
  page: {
    description: string;
    journeyStage: string;
    sections: SectionSpec[];
  },
  wholePage = false
): PageDesignPlan {
  const sectionTypes = page.sections.map((section) => section.type);

  const narrativeArc = wholePage
    ? "Expose the primary workflow immediately. The interface should feel like a product, not a marketing page."
    : sectionTypes.length <= 3
      ? "Keep the page tightly focused: establish value, support it, then convert."
      : "Move from orientation to persuasion, then social proof, and finish with a decisive conversion close.";

  const layoutStrategy = wholePage
    ? "Full-viewport persistent shell. Layout regions (sidebar, main content, panels) defined by product function, not marketing narrative."
    : `Use section rhythm, spacing, and contrast to support the ${page.journeyStage} stage of the user journey.`;

  const hierarchy = wholePage
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
      ...(wholePage
        ? ["Avoid landing-page patterns: no hero manifestos, testimonial bands, or FAQ-heavy layouts."]
        : []),
    ],
  };
}

export function buildDefaultProjectPlan(blueprint: ProjectBlueprint): PlannedProjectBlueprint {
  const wholePage = blueprint.brief.productScope.layoutMode === "whole-page";
  // Whole-page: a single home section implements the full shell (nav/footer inside it).
  const layoutSections = wholePage ? [] : blueprint.site.layoutSections;

  const buildMinimalPageSections = (): SectionSpec[] => {
    if (wholePage) {
      return [
        {
          type: "ProductSurface",
          intent: `Deliver the full interactive surface described in the project: ${blueprint.brief.projectDescription}`,
          contentHints:
            "Single route implements the whole product. Derive structure (in-page chrome, full-bleed stage, table-first, " +
            "feed, or other) from the product description and scope — do not assume a default three-column admin shell. " +
            "Include rich, realistic mock data appropriate to that domain.",
          fileName: "ProductSurfaceSection",
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
