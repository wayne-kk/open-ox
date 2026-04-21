import type {
  CapabilitySpec,
  InformationArchitecture,
  LayoutMode,
  PageBlueprint,
  PageMapEntry,
  ProductScope,
  ProjectBlueprint,
  ProjectBrief,
  ProjectExperience,
  ProjectSiteBlueprint,
  SectionSpec,
  TaskLoop,
  UserRole,
} from "../types";
import { isStringArray } from "../shared/typeGuards";
import { getPromptProfile } from "@/ai/prompts/core/profile";

function isAppProfile(): boolean {
  return getPromptProfile() === "app";
}

function isSectionSpecArray(value: unknown): value is SectionSpec[] {
  return Array.isArray(value);
}

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function normalizeStringArray(value: unknown, fallback: string[] = []): string[] {
  return isStringArray(value) ? value : fallback;
}

function normalizeProductScope(value: unknown, projectDescription: string): ProductScope {
  const appProfile = isAppProfile();
  if (!value || typeof value !== "object") {
    return {
      productType: appProfile ? "mobile app" : "marketing website",
      layoutMode: "split-sections" as LayoutMode,
      mvpDefinition: projectDescription,
      coreOutcome: projectDescription,
      businessGoal: appProfile
        ? "Ship the smallest coherent app experience that proves the core user loop."
        : "Launch the smallest coherent website that proves the core value proposition.",
      audienceSummary: projectDescription,
      inScope: appProfile
        ? ["Deliver the primary in-app workflow", "Support repeat usage with clear task flow"]
        : ["Clarify the offer", "Support the primary user journey"],
      outOfScope: appProfile
        ? ["Secondary growth mechanics that are not required for the initial MVP"]
        : ["Secondary workflows that are not required for the initial MVP"],
    };
  }

  const candidate = value as Partial<ProductScope>;
  const layoutMode: LayoutMode =
    candidate.layoutMode === "whole-page" || candidate.layoutMode === "split-sections"
      ? candidate.layoutMode
      : appProfile
        ? "split-sections"
        : "split-sections";
  return {
    productType:
      typeof candidate.productType === "string"
        ? candidate.productType
        : appProfile
          ? "mobile app"
          : "website",
    layoutMode,
    mvpDefinition:
      typeof candidate.mvpDefinition === "string" ? candidate.mvpDefinition : projectDescription,
    coreOutcome:
      typeof candidate.coreOutcome === "string" ? candidate.coreOutcome : projectDescription,
    businessGoal:
      typeof candidate.businessGoal === "string"
        ? candidate.businessGoal
        : appProfile
          ? "Ship the smallest coherent app experience that proves the core user loop."
          : "Launch the smallest coherent website that proves the core value proposition.",
    audienceSummary:
      typeof candidate.audienceSummary === "string" ? candidate.audienceSummary : projectDescription,
    inScope: normalizeStringArray(
      candidate.inScope,
      appProfile
        ? ["Deliver the core in-app workflow with clear interaction feedback"]
        : ["Clarify the core value proposition"]
    ),
    outOfScope: normalizeStringArray(candidate.outOfScope, []),
  };
}

function normalizeRoles(value: unknown): UserRole[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [
      {
        roleId: "visitor",
        roleName: "Visitor",
        summary: "Primary public-facing user of the initial MVP.",
        goals: ["Understand the offer", "Complete the primary conversion path"],
        coreActions: ["Scan the main message", "Evaluate trust signals", "Take the primary CTA"],
        permissions: ["Public access only"],
        priority: "primary",
      },
    ];
  }

  return value.map((item, index) => {
    const candidate = item as Partial<UserRole>;
    const roleName =
      typeof candidate.roleName === "string" ? candidate.roleName : `Role ${index + 1}`;
    return {
      roleId:
        typeof candidate.roleId === "string"
          ? candidate.roleId
          : roleName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      roleName,
      summary: typeof candidate.summary === "string" ? candidate.summary : roleName,
      goals: normalizeStringArray(candidate.goals, ["Support the role's core goal"]),
      coreActions: normalizeStringArray(candidate.coreActions, ["Complete the primary workflow"]),
      permissions: normalizeStringArray(candidate.permissions, ["Public access"]),
      priority:
        candidate.priority === "secondary" || candidate.priority === "supporting"
          ? candidate.priority
          : "primary",
    };
  });
}

function normalizeTaskLoops(value: unknown, roles: UserRole[]): TaskLoop[] {
  if (!Array.isArray(value) || value.length === 0) {
    const primaryRole = roles[0];
    return [
      {
        loopId: `${primaryRole.roleId}-core-loop`,
        roleId: primaryRole.roleId,
        name: `${primaryRole.roleName} core journey`,
        summary: "Smallest end-to-end journey that proves the MVP.",
        entryTrigger: "User arrives with an intent to evaluate the product.",
        steps: ["Understand the offer", "Evaluate supporting information", "Take the primary action"],
        successState: "The user completes the primary MVP action.",
        relatedCapabilityIds: [],
      },
    ];
  }

  return value.map((item, index) => {
    const candidate = item as Partial<TaskLoop>;
    const roleId =
      typeof candidate.roleId === "string" ? candidate.roleId : roles[0]?.roleId ?? "visitor";
    return {
      loopId:
        typeof candidate.loopId === "string" ? candidate.loopId : `${roleId}-loop-${index + 1}`,
      roleId,
      name: typeof candidate.name === "string" ? candidate.name : `Task loop ${index + 1}`,
      summary: typeof candidate.summary === "string" ? candidate.summary : "Core user journey",
      entryTrigger:
        typeof candidate.entryTrigger === "string" ? candidate.entryTrigger : "User starts the journey",
      steps: normalizeStringArray(candidate.steps, ["Start", "Progress", "Complete"]),
      successState:
        typeof candidate.successState === "string"
          ? candidate.successState
          : "The role completes the intended task successfully.",
      relatedCapabilityIds: normalizeStringArray(candidate.relatedCapabilityIds, []),
    };
  });
}

function normalizeCapabilities(value: unknown): CapabilitySpec[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const candidate = item as Partial<CapabilitySpec>;
    return {
      capabilityId:
        typeof candidate.capabilityId === "string"
          ? candidate.capabilityId
          : `capability-${index + 1}`,
      name: typeof candidate.name === "string" ? candidate.name : `Capability ${index + 1}`,
      summary: typeof candidate.summary === "string" ? candidate.summary : "Core product capability",
      primaryRoleIds: normalizeStringArray(candidate.primaryRoleIds, []),
      supportingTaskLoopIds: normalizeStringArray(candidate.supportingTaskLoopIds, []),
      priority:
        candidate.priority === "should-have" || candidate.priority === "nice-to-have"
          ? candidate.priority
          : "must-have",
    };
  });
}

function normalizePageMap(value: unknown): PageMapEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const candidate = item as Partial<PageMapEntry>;
    const title = typeof candidate.title === "string" ? candidate.title : `Page ${index + 1}`;
    return {
      slug: typeof candidate.slug === "string" ? candidate.slug : `page-${index + 1}`,
      title,
      purpose: typeof candidate.purpose === "string" ? candidate.purpose : title,
      primaryRoleIds: normalizeStringArray(candidate.primaryRoleIds, []),
      supportingCapabilityIds: normalizeStringArray(candidate.supportingCapabilityIds, []),
      journeyStage:
        typeof candidate.journeyStage === "string" ? candidate.journeyStage : "core journey",
    };
  });
}

function normalizeInformationArchitecture(
  value: unknown,
  pages: PageBlueprint[]
): InformationArchitecture {
  const appProfile = isAppProfile();
  if (!value || typeof value !== "object") {
    return {
      navigationModel: appProfile
        ? "Single-page app flow with bottom tab-bar style navigation aligned to the core MVP journey."
        : "Simple top-level navigation aligned to the core MVP journey.",
      pageMap: pages.map((page) => ({
        slug: page.slug,
        title: page.title,
        purpose: page.description,
        primaryRoleIds: page.primaryRoleIds,
        supportingCapabilityIds: page.supportingCapabilityIds,
        journeyStage: page.journeyStage,
      })),
      sharedShells: appProfile ? ["Global bottom tab navigation"] : ["Global navigation", "Global footer"],
      notes: [],
    };
  }

  const candidate = value as Partial<InformationArchitecture>;
  return {
    navigationModel:
      typeof candidate.navigationModel === "string"
        ? candidate.navigationModel
        : appProfile
          ? "Single-page app flow with bottom tab-bar style navigation aligned to the core MVP journey."
          : "Simple top-level navigation aligned to the core MVP journey.",
    pageMap: normalizePageMap(candidate.pageMap),
    sharedShells: normalizeStringArray(
      candidate.sharedShells,
      appProfile ? ["Global bottom tab navigation"] : ["Global navigation", "Global footer"]
    ),
    notes: normalizeStringArray(candidate.notes, []),
  };
}

function normalizeSectionSpec(value: unknown, index: number): SectionSpec {
  const candidate = (value && typeof value === "object" ? value : {}) as Partial<SectionSpec>;
  const type = typeof candidate.type === "string" ? candidate.type : `section-${index + 1}`;
  return {
    type,
    intent: typeof candidate.intent === "string" ? candidate.intent : "Support the page goal clearly.",
    contentHints:
      typeof candidate.contentHints === "string"
        ? candidate.contentHints
        : "Use realistic UI elements and concrete content.",
    fileName:
      typeof candidate.fileName === "string" ? candidate.fileName : `${toPascalCase(type)}Section`,
    primaryRoleIds: normalizeStringArray(candidate.primaryRoleIds, []),
    supportingCapabilityIds: normalizeStringArray(candidate.supportingCapabilityIds, []),
    sourceTaskLoopIds: normalizeStringArray(candidate.sourceTaskLoopIds, []),
  };
}

function normalizeShellSection(
  value: unknown,
  defaultType: "navigation" | "footer",
  defaultFileName: string
): SectionSpec {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<SectionSpec>;
  const normalized = normalizeSectionSpec(value, 0);
  return {
    ...normalized,
    type: defaultType,
    fileName: typeof raw.fileName === "string" && raw.fileName.trim() ? raw.fileName : defaultFileName,
  };
}

function enforceAppLayoutSections(layoutSections: SectionSpec[]): SectionSpec[] {
  const navigation = layoutSections.find((section) => section.type === "navigation");
  const base = navigation ?? {
    type: "navigation",
    intent: "Provide primary bottom-tab navigation for app sections.",
    contentHints: "Bottom tab bar, touch-friendly targets, compact labels, active state.",
    fileName: "NavigationSection",
    primaryRoleIds: [],
    supportingCapabilityIds: [],
    sourceTaskLoopIds: [],
  };

  return [
    {
      ...base,
      type: "navigation",
      fileName: "NavigationSection",
      intent:
        base.intent && base.intent.trim().length > 0
          ? base.intent
          : "Provide primary bottom-tab navigation for app sections.",
      contentHints:
        "Bottom tab bar for mobile app navigation. Fixed bottom dock, touch-friendly targets, concise labels, clear active state.",
    },
  ];
}

function normalizePageBlueprint(value: unknown, index: number): PageBlueprint {
  const candidate = (value && typeof value === "object" ? value : {}) as Partial<PageBlueprint>;
  const title = typeof candidate.title === "string" ? candidate.title : `Page ${index + 1}`;
  return {
    title,
    slug:
      typeof candidate.slug === "string" ? candidate.slug : index === 0 ? "home" : `page-${index + 1}`,
    description:
      typeof candidate.description === "string"
        ? candidate.description
        : "Page supporting the core MVP journey.",
    journeyStage:
      typeof candidate.journeyStage === "string" ? candidate.journeyStage : "core journey",
    primaryRoleIds: normalizeStringArray(candidate.primaryRoleIds, []),
    supportingCapabilityIds: normalizeStringArray(candidate.supportingCapabilityIds, []),
    sections: Array.isArray(candidate.sections)
      ? candidate.sections.map((section, sectionIndex) => normalizeSectionSpec(section, sectionIndex))
      : [],
  };
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function enforceSingleHomePage(pages: PageBlueprint[]): PageBlueprint[] {
  const appProfile = isAppProfile();
  if (pages.length === 0) {
    return [
      {
        title: "Home",
        slug: "home",
        description: appProfile ? "Single-screen app workspace." : "Single-page marketing site.",
        journeyStage: appProfile ? "core flow" : "entry",
        primaryRoleIds: [appProfile ? "user" : "visitor"],
        supportingCapabilityIds: [],
        sections: [],
      },
    ];
  }

  if (pages.length === 1) {
    const only = pages[0];
    return [
      {
        ...only,
        slug: "home",
        title: only.title?.trim() ? only.title : "Home",
      },
    ];
  }

  const homeIdx = pages.findIndex((p) => p.slug === "home");
  const base = homeIdx >= 0 ? pages[homeIdx] : pages[0];
  const mergedDescription = uniqueStrings(pages.map((p) => p.description).filter(Boolean)).join(" ");
  const primaryRoleIds = uniqueStrings(pages.flatMap((p) => p.primaryRoleIds));
  const supportingCapabilityIds = uniqueStrings(pages.flatMap((p) => p.supportingCapabilityIds));

  return [
    {
      ...base,
      slug: "home",
      title: base.title?.trim() ? base.title : "Home",
      description:
        mergedDescription.length > 24
          ? mergedDescription.slice(0, 800)
          : base.description || mergedDescription || (appProfile ? "Single-screen app workspace." : "Single-page brand site."),
      journeyStage: base.journeyStage || (appProfile ? "core flow" : "entry"),
      primaryRoleIds: primaryRoleIds.length > 0 ? primaryRoleIds : base.primaryRoleIds,
      supportingCapabilityIds:
        supportingCapabilityIds.length > 0 ? supportingCapabilityIds : base.supportingCapabilityIds,
      sections: [],
    },
  ];
}

function normalizeBrief(value: unknown): ProjectBrief {
  if (!value || typeof value !== "object") {
    throw new Error("analyze_project_requirement: brief is missing");
  }

  const candidate = value as Partial<ProjectBrief>;
  if (
    typeof candidate.projectTitle !== "string" ||
    typeof candidate.projectDescription !== "string"
  ) {
    throw new Error(
      "analyze_project_requirement: brief must include projectTitle and projectDescription"
    );
  }

  const roles = normalizeRoles(candidate.roles);
  return {
    projectTitle: candidate.projectTitle,
    projectDescription: candidate.projectDescription,
    language: typeof candidate.language === "string" && candidate.language.trim()
      ? candidate.language.trim()
      : "en",
    productScope: normalizeProductScope(candidate.productScope, candidate.projectDescription),
    roles,
    taskLoops: normalizeTaskLoops(candidate.taskLoops, roles),
    capabilities: normalizeCapabilities(candidate.capabilities),
  };
}

function normalizeExperience(value: unknown): ProjectExperience {
  const appProfile = isAppProfile();
  if (!value || typeof value !== "object") {
    return {
      designIntent: {
        mood: appProfile
          ? ["focused", "immersive", "energetic"]
          : ["clean", "trustworthy", "focused"],
        colorDirection: appProfile
          ? "High-contrast functional accents over calm neutral surfaces."
          : "Neutral base with one clear accent direction.",
        style: appProfile
          ? "Mobile-first, interaction-driven, feed-and-task oriented."
          : "Modern, content-first, conversion-oriented.",
        keywords: appProfile
          ? ["mobile", "app", "feed", "interactive", "task-focused"]
          : ["clean", "professional", "focused", "confident", "modern"],
      },
    };
  }

  const candidate = value as Partial<ProjectExperience>;
  if (!candidate.designIntent || typeof candidate.designIntent !== "object") {
    return {
      designIntent: {
        mood: appProfile
          ? ["focused", "immersive", "energetic"]
          : ["clean", "trustworthy", "focused"],
        colorDirection: appProfile
          ? "High-contrast functional accents over calm neutral surfaces."
          : "Neutral base with one clear accent direction.",
        style: appProfile
          ? "Mobile-first, interaction-driven, feed-and-task oriented."
          : "Modern, content-first, conversion-oriented.",
        keywords: appProfile
          ? ["mobile", "app", "feed", "interactive", "task-focused"]
          : ["clean", "professional", "focused", "confident", "modern"],
      },
    };
  }

  return {
    designIntent: candidate.designIntent,
  };
}

function normalizeSite(value: unknown): ProjectSiteBlueprint {
  const appProfile = isAppProfile();
  if (!value || typeof value !== "object") {
    throw new Error("analyze_project_requirement: site is missing");
  }

  const candidate = value as Partial<ProjectSiteBlueprint> & {
    navigation?: unknown;
    footer?: unknown;
  };
  if (!Array.isArray(candidate.pages)) {
    throw new Error("analyze_project_requirement: site must include pages");
  }

  const pagesRaw = candidate.pages.map((page, index) => normalizePageBlueprint(page, index));
  const mergedFromMultiple = pagesRaw.length > 1;
  const pages = enforceSingleHomePage(pagesRaw);

  const baseIa = normalizeInformationArchitecture(candidate.informationArchitecture, pages);
  const pageMap: PageMapEntry[] = pages.map((page) => ({
    slug: page.slug,
    title: page.title,
    purpose: page.description,
    primaryRoleIds: page.primaryRoleIds,
    supportingCapabilityIds: page.supportingCapabilityIds,
    journeyStage: page.journeyStage,
  }));

  const layoutSections: SectionSpec[] = isSectionSpecArray(candidate.layoutSections)
    ? candidate.layoutSections.map((section, index) => normalizeSectionSpec(section, index))
    : [
      normalizeShellSection(candidate.navigation, "navigation", "NavigationSection"),
      normalizeShellSection(candidate.footer, "footer", "FooterSection"),
    ];

  const normalizedLayoutSections = appProfile
    ? enforceAppLayoutSections(layoutSections)
    : layoutSections;

  return {
    informationArchitecture: {
      ...baseIa,
      pageMap,
      navigationModel: mergedFromMultiple
        ? appProfile
          ? "Single-page app flow: all content on `/` (home). Primary navigation uses bottom tab-bar style entry points and in-page anchors."
          : "Single-page site: all content on `/` (home). Primary navigation MUST use in-page anchor links (#section-id), not separate routes."
        : baseIa.navigationModel,
    },
    layoutSections: normalizedLayoutSections,
    pages,
  };
}

export function asProjectBlueprint(value: unknown): ProjectBlueprint {
  if (!value || typeof value !== "object") {
    throw new Error("analyze_project_requirement: output is not an object");
  }

  const candidate = value as Partial<ProjectBlueprint>;
  if (candidate.brief && candidate.experience && candidate.site) {
    return {
      brief: normalizeBrief(candidate.brief),
      experience: normalizeExperience(candidate.experience),
      site: normalizeSite(candidate.site),
    };
  }

  if (candidate.brief && candidate.site) {
    return {
      brief: normalizeBrief(candidate.brief),
      experience: normalizeExperience(candidate.experience),
      site: normalizeSite(candidate.site),
    };
  }

  // Minimal nested shape compatibility:
  // { brief, designIntent, site }  ->  { brief, experience.designIntent, site }
  const minimalNested = value as {
    brief?: unknown;
    designIntent?: unknown;
    site?: unknown;
  };
  if (minimalNested.brief && minimalNested.designIntent && minimalNested.site) {
    return {
      brief: normalizeBrief(minimalNested.brief),
      experience: normalizeExperience({
        designIntent: minimalNested.designIntent,
      }),
      site: normalizeSite(minimalNested.site),
    };
  }

  const flatCandidate = value as {
    projectTitle?: unknown;
    projectDescription?: unknown;
    productScope?: unknown;
    roles?: unknown;
    taskLoops?: unknown;
    capabilities?: unknown;
    informationArchitecture?: unknown;
    designIntent?: unknown;
    layoutSections?: unknown;
    navigation?: unknown;
    footer?: unknown;
    pages?: unknown;
  };
  if (
    typeof flatCandidate.projectTitle === "string" &&
    typeof flatCandidate.projectDescription === "string" &&
    flatCandidate.designIntent &&
    (isSectionSpecArray(flatCandidate.layoutSections) ||
      flatCandidate.navigation !== undefined ||
      flatCandidate.footer !== undefined) &&
    Array.isArray(flatCandidate.pages)
  ) {
    return {
      brief: normalizeBrief({
        projectTitle: flatCandidate.projectTitle,
        projectDescription: flatCandidate.projectDescription,
        productScope: flatCandidate.productScope,
        roles: flatCandidate.roles,
        taskLoops: flatCandidate.taskLoops,
        capabilities: flatCandidate.capabilities,
      }),
      experience: normalizeExperience({
        designIntent: flatCandidate.designIntent,
      }),
      site: normalizeSite({
        informationArchitecture: flatCandidate.informationArchitecture,
        layoutSections: flatCandidate.layoutSections,
        navigation: flatCandidate.navigation,
        footer: flatCandidate.footer,
        pages: flatCandidate.pages,
      }),
    };
  }

  const singlePage = value as Partial<PageBlueprint & { designIntent: ProjectExperience["designIntent"] }>;
  if (
    typeof singlePage.title === "string" &&
    typeof singlePage.description === "string" &&
    singlePage.designIntent &&
    isSectionSpecArray(singlePage.sections)
  ) {
    const appProfile = isAppProfile();
    const layoutSections = singlePage.sections.filter((section) =>
      appProfile
        ? section.type === "navigation"
        : section.type === "navigation" || section.type === "footer"
    );
    const pageSections = singlePage.sections.filter(
      (section) => section.type !== "navigation" && section.type !== "footer"
    );

    const normalizedRoles = normalizeRoles(undefined);
    const normalizedPages = [
      normalizePageBlueprint(
        {
          title: singlePage.title,
          slug: singlePage.slug || "home",
          description: singlePage.description,
          sections: pageSections,
        },
        0
      ),
    ];

    return {
      brief: {
        projectTitle: singlePage.title,
        projectDescription: singlePage.description,
        language: "en",
        productScope: normalizeProductScope(undefined, singlePage.description),
        roles: normalizedRoles,
        taskLoops: normalizeTaskLoops(undefined, normalizedRoles),
        capabilities: [],
      },
      experience: {
        designIntent: singlePage.designIntent,
      },
      site: {
        informationArchitecture: normalizeInformationArchitecture(undefined, normalizedPages),
        layoutSections: appProfile
          ? enforceAppLayoutSections(layoutSections.map((section, index) => normalizeSectionSpec(section, index)))
          : layoutSections.map((section, index) => normalizeSectionSpec(section, index)),
        pages: normalizedPages,
      },
    };
  }

  throw new Error("analyze_project_requirement: output does not match ProjectBlueprint");
}
