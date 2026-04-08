import type {
  CapabilitySpec,
  PageDesignPlan,
  PlannedPageBlueprint,
  PlannedProjectBlueprint,
  PlannedSectionSpec,
  ProjectBlueprint,
  SectionDesignPlan,
  SectionSpec,
  SectionTraits,
  ShellPlacement,
  TaskLoop,
  UserRole,
} from "../types";
import { inferProjectGuardrailDefaults, inferSectionGuardrailDefaults } from "./guardrailPolicy";

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

interface PlanningContext {
  roles: UserRole[];
  taskLoops: TaskLoop[];
  capabilities: CapabilitySpec[];
  designKeywords: string[];
}

function formatRoleNames(roleIds: string[], roles: UserRole[]): string {
  const names = roleIds
    .map((roleId) => roles.find((role) => role.roleId === roleId)?.roleName ?? roleId)
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : "general visitors";
}

function formatCapabilityNames(capabilityIds: string[], capabilities: CapabilitySpec[]): string {
  const names = capabilityIds
    .map((capabilityId) => capabilities.find((capability) => capability.capabilityId === capabilityId)?.name ?? capabilityId)
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : "the page's core capability set";
}

function formatTaskLoopNames(loopIds: string[], taskLoops: TaskLoop[]): string {
  const names = loopIds
    .map((loopId) => taskLoops.find((loop) => loop.loopId === loopId)?.name ?? loopId)
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : "the core user journey";
}

function inferCapabilityAssistIds(section: SectionSpec, context: PlanningContext): string[] {
  const haystack = `${section.intent} ${section.contentHints} ${context.designKeywords.join(" ")}`
    .toLowerCase();
  const assists: string[] = [];

  if (/(neon|cyber|festival|halloween|punk|bold|energetic|glow|glitch)/.test(haystack)) {
    assists.push("effect.motion.ambient", "effect.motion.energetic");
  } else if (/(editorial|minimal|luxury|calm|clean|portfolio)/.test(haystack)) {
    assists.push("effect.motion.subtle");
  } else if (section.type === "hero") {
    assists.push("effect.motion.ambient");
  } else if (/(faq|pricing|navigation|tabs|filter|accordion|menu|comparison)/.test(haystack)) {
    assists.push("effect.motion.subtle");
  }

  if (section.type === "hero") {
    if (/(center|event|campaign|poster|festival|immersive|full-bleed)/.test(haystack)) {
      assists.push("pattern.hero.centered");
    } else if (/(dashboard|product|platform|saas|terminal|metrics|analytics)/.test(haystack)) {
      assists.push("pattern.hero.dashboard");
    } else if (/(story|editorial|magazine|brand|manifesto|narrative)/.test(haystack)) {
      assists.push("pattern.hero.editorial");
    } else {
      assists.push("pattern.hero.split");
    }
  }

  if (section.type === "features") {
    assists.push("pattern.features.grid");
  }

  if (section.type === "pricing") {
    assists.push("pattern.pricing.three-tier");
  }

  if (section.type === "faq") {
    assists.push("pattern.faq.two-column");
  }

  return unique(assists);
}

function inferSectionTraits(section: SectionSpec, context: PlanningContext): SectionTraits {
  const assists = inferCapabilityAssistIds(section, context);
  const traits: SectionTraits = {};

  const motion =
    assists.includes("effect.motion.energetic")
      ? "energetic"
      : assists.includes("effect.motion.ambient")
        ? "ambient"
        : assists.includes("effect.motion.subtle")
          ? "subtle"
          : "none";
  traits.motion = { intensity: motion };

  if (assists.includes("pattern.hero.centered")) {
    traits.layout = { type: "centered" };
  } else if (assists.includes("pattern.hero.dashboard")) {
    traits.layout = { type: "split", ratio: "55/45", note: "product-led dashboard composition" };
  } else if (assists.includes("pattern.hero.editorial")) {
    traits.layout = { type: "editorial" };
  } else if (assists.includes("pattern.hero.split")) {
    traits.layout = { type: "split", ratio: "50/50" };
  } else if (assists.includes("pattern.features.grid")) {
    traits.layout = { type: "grid" };
  } else if (assists.includes("pattern.pricing.three-tier")) {
    traits.layout = { type: "grid", note: "three-tier comparison" };
  } else if (assists.includes("pattern.faq.two-column")) {
    traits.layout = { type: "two-column" };
  }

  if (section.type === "pricing" || section.type === "faq") {
    traits.visual = { density: "dense", contrast: "medium" };
  } else if (section.type === "hero" || section.type === "cta") {
    traits.visual = { density: "balanced", contrast: "high" };
  } else {
    traits.visual = { density: "balanced", contrast: "medium" };
  }

  if (section.type === "hero" || section.type === "cta") {
    traits.interaction = { mode: "cta-focused" };
  } else if (section.type === "pricing" || section.type === "faq" || section.type === "navigation") {
    traits.interaction = { mode: "explorative" };
  } else {
    traits.interaction = { mode: "passive" };
  }

  return traits;
}

function inferSectionRole(section: SectionSpec): string {
  switch (section.type) {
    case "hero":
      return "Page opener and value proposition anchor";
    case "features":
      return "Capability explanation and proof framing";
    case "pricing":
      return "Offer structure and conversion driver";
    case "faq":
      return "Objection handling and trust reinforcement";
    case "cta":
      return "Conversion close";
    case "navigation":
      return "Global wayfinding shell";
    case "footer":
      return "Global utility and trust shell";
    default:
      return "Page narrative block";
  }
}

function inferLayoutIntent(section: SectionSpec): string {
  const haystack = `${section.intent} ${section.contentHints}`.toLowerCase();

  if (section.type === "hero") {
    if (/(center|event|campaign|poster|festival|immersive|full-bleed)/.test(haystack)) {
      return "Use a centered, high-impact hero with a dominant focal point and minimal side distractions.";
    }
    if (/(dashboard|product|platform|saas|terminal|metrics|analytics)/.test(haystack)) {
      return "Use a product-led hero with strong visual evidence, preview panels, or metrics-led support content.";
    }
    if (/(story|editorial|magazine|brand|manifesto|narrative)/.test(haystack)) {
      return "Use an editorial hero with storytelling emphasis, layered copy blocks, and expressive composition.";
    }
    return "Use a split hero with strong text hierarchy on one side and supporting proof or media on the other.";
  }

  if (section.type === "features") {
    return "Use a scannable modular grid with strong grouping and quick comparative reading.";
  }

  if (section.type === "pricing") {
    return "Use a comparison-oriented multi-tier layout with one clearly dominant offer.";
  }

  if (section.type === "faq") {
    return "Use a readable two-zone FAQ layout with supporting context and compact accordion density.";
  }

  if (section.type === "navigation") {
    return "Keep the shell concise, highly legible, and conversion-aware across breakpoints.";
  }

  if (section.type === "footer") {
    return "Use a dense but clearly chunked global footer with utility, trust, and compliance information.";
  }

  return "Choose a layout that supports fast comprehension, clear hierarchy, and content-appropriate grouping.";
}

function inferVisualIntent(section: SectionSpec, designKeywords: string[]): string {
  const keywords = unique([section.type, ...designKeywords]).join(", ");
  return `Express the section through the project's visual language while keeping ${section.type} immediately legible. Keywords: ${keywords}.`;
}

function inferInteractionIntent(section: SectionSpec): string {
  if (section.type === "pricing" || section.type === "faq" || section.type === "navigation") {
    return "Use lightweight interactive affordances that improve clarity without dominating the section.";
  }

  if (section.type === "hero" || section.type === "cta") {
    return "Make the primary call to action visually decisive and friction-light.";
  }

  return "Keep interactions supportive, purposeful, and secondary to the content narrative.";
}

function inferShellPlacement(section: SectionSpec): ShellPlacement | undefined {
  if (section.type === "navigation") {
    return "beforePageContent";
  }

  if (section.type === "footer") {
    return "afterPageContent";
  }

  return undefined;
}

function inferRoleFit(section: SectionSpec, context: PlanningContext): string {
  return `Optimize this section primarily for ${formatRoleNames(section.primaryRoleIds, context.roles)}.`;
}

function inferTaskLoopFocus(section: SectionSpec, context: PlanningContext): string {
  return `Support ${formatTaskLoopNames(section.sourceTaskLoopIds, context.taskLoops)} without adding unrelated UX complexity.`;
}

function inferCapabilityFocus(section: SectionSpec, context: PlanningContext): string {
  return `Make ${formatCapabilityNames(section.supportingCapabilityIds, context.capabilities)} obvious through content, proof, and interaction cues.`;
}

export function buildDefaultSectionDesignPlan(
  section: SectionSpec,
  context: PlanningContext
): SectionDesignPlan {
  return {
    role: inferSectionRole(section),
    goal: section.intent,
    roleFit: inferRoleFit(section, context),
    taskLoopFocus: inferTaskLoopFocus(section, context),
    capabilityFocus: inferCapabilityFocus(section, context),
    informationArchitecture: `Translate these content hints into a clear section structure: ${section.contentHints}`,
    layoutIntent: inferLayoutIntent(section),
    visualIntent: inferVisualIntent(section, context.designKeywords),
    interactionIntent: inferInteractionIntent(section),
    contentStrategy: `Prioritize the most important content first, then support it with realistic UI elements described in: ${section.contentHints}`,
    hierarchy: [
      "Lead with the single most important message or action.",
      "Group supporting information into visually distinct clusters.",
      "Make scan order obvious on mobile and desktop.",
    ],
    guardrailIds: inferSectionGuardrailDefaults(section),
    traits: inferSectionTraits(section, context),
    constraints: unique([
      "Preserve the project design system vocabulary.",
      "Generate production-ready code with realistic content.",
      "Prefer reusable composition over one-off ornamentation.",
    ]),
    shellPlacement: inferShellPlacement(section),
    rationale: `Default planner translated ${section.type} into a design brief grounded in roles, task loops, and capability needs.`,
  };
}

function planSection(
  section: SectionSpec,
  context: PlanningContext
): PlannedSectionSpec {
  return {
    ...section,
    designPlan: buildDefaultSectionDesignPlan(section, context),
  };
}

function buildDefaultPageDesignPlan(
  page: {
    title: string;
    description: string;
    journeyStage: string;
    primaryRoleIds: string[];
    supportingCapabilityIds: string[];
    sections: SectionSpec[];
  },
  context: PlanningContext
): PageDesignPlan {
  const sectionTypes = page.sections.map((section) => section.type);
  const narrativeArc =
    sectionTypes.length <= 3
      ? "Keep the page tightly focused: establish value, support it, then convert."
      : "Move from orientation to persuasion, then social proof, and finish with a decisive conversion close.";
  const roleNames = formatRoleNames(page.primaryRoleIds, context.roles);
  const capabilityNames = formatCapabilityNames(page.supportingCapabilityIds, context.capabilities);
  const taskLoops = page.sections.flatMap((section) => section.sourceTaskLoopIds);

  return {
    pageGoal: page.description,
    audienceFocus: `Design for ${roleNames}.`,
    roleFit: `This page primarily serves ${roleNames}.`,
    capabilityFocus: `This page should make ${capabilityNames} understandable and actionable.`,
    taskLoopCoverage: `Help users progress through ${formatTaskLoopNames(taskLoops, context.taskLoops)}.`,
    narrativeArc,
    layoutStrategy: `Use section rhythm, spacing, and contrast to support the ${page.journeyStage} stage of the user journey rather than making every block equally loud.`,
    hierarchy: [
      "The first viewport should establish context and value quickly.",
      "Mid-page sections should deepen trust or explain the offer.",
      "Lower-page sections should reduce friction and reinforce action.",
    ],
    transitionStrategy: "Make transitions feel intentional through spacing, contrast shifts, and restrained motion rather than decorative separators.",
    sharedShellNotes: [
      "Assume global layout sections frame the page experience.",
      "Keep page-specific sections visually coherent with the shared shell.",
    ],
    constraints: [
      "Preserve the given section order unless a wrapper or grouping is required for coherence.",
      "Avoid repetitive section pacing; vary density and emphasis across the page.",
    ],
    rationale: `Default page planner framed ${page.title} around role needs and the MVP journey rather than isolated sections.`,
  };
}

export function buildDefaultProjectPlan(
  blueprint: ProjectBlueprint
): PlannedProjectBlueprint {
  const context: PlanningContext = {
    roles: blueprint.brief.roles,
    taskLoops: blueprint.brief.taskLoops,
    capabilities: blueprint.brief.capabilities,
    designKeywords: blueprint.experience.designIntent.keywords,
  };

  const layoutSections: PlannedSectionSpec[] = blueprint.site.layoutSections.map((section) =>
    planSection(section, context)
  );

  const pages: PlannedPageBlueprint[] = blueprint.site.pages.map((page) => ({
    ...page,
    pageDesignPlan: buildDefaultPageDesignPlan(page, context),
    sections: page.sections.map((section) => planSection(section, context)),
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
