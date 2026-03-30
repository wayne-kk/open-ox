import { loadGuardrail, loadStepPrompt } from "../shared/files";
import { callLLM, extractJSON } from "../shared/llm";
import type {
  CapabilitySpec,
  InformationArchitecture,
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

function isSectionSpecArray(value: unknown): value is SectionSpec[] {
  return Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
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
  if (!value || typeof value !== "object") {
    return {
      productType: "marketing website",
      mvpDefinition: projectDescription,
      coreOutcome: projectDescription,
      businessGoal: "Launch the smallest coherent website that proves the core value proposition.",
      audienceSummary: projectDescription,
      inScope: ["Clarify the offer", "Support the primary user journey"],
      outOfScope: ["Secondary workflows that are not required for the initial MVP"],
    };
  }

  const candidate = value as Partial<ProductScope>;
  return {
    productType: typeof candidate.productType === "string" ? candidate.productType : "website",
    mvpDefinition:
      typeof candidate.mvpDefinition === "string" ? candidate.mvpDefinition : projectDescription,
    coreOutcome:
      typeof candidate.coreOutcome === "string" ? candidate.coreOutcome : projectDescription,
    businessGoal:
      typeof candidate.businessGoal === "string"
        ? candidate.businessGoal
        : "Launch the smallest coherent website that proves the core value proposition.",
    audienceSummary:
      typeof candidate.audienceSummary === "string" ? candidate.audienceSummary : projectDescription,
    inScope: normalizeStringArray(candidate.inScope, ["Clarify the core value proposition"]),
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
  if (!value || typeof value !== "object") {
    return {
      navigationModel: "Simple top-level navigation aligned to the core MVP journey.",
      pageMap: pages.map((page) => ({
        slug: page.slug,
        title: page.title,
        purpose: page.description,
        primaryRoleIds: page.primaryRoleIds,
        supportingCapabilityIds: page.supportingCapabilityIds,
        journeyStage: page.journeyStage,
      })),
      sharedShells: ["Global navigation", "Global footer"],
      notes: [],
    };
  }

  const candidate = value as Partial<InformationArchitecture>;
  return {
    navigationModel:
      typeof candidate.navigationModel === "string"
        ? candidate.navigationModel
        : "Simple top-level navigation aligned to the core MVP journey.",
    pageMap: normalizePageMap(candidate.pageMap),
    sharedShells: normalizeStringArray(candidate.sharedShells, ["Global navigation", "Global footer"]),
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
  if (!value || typeof value !== "object") {
    throw new Error("analyze_project_requirement: experience is missing");
  }

  const candidate = value as Partial<ProjectExperience>;
  if (!candidate.designIntent) {
    throw new Error("analyze_project_requirement: experience.designIntent is missing");
  }

  return {
    designIntent: candidate.designIntent,
  };
}

function normalizeSite(value: unknown): ProjectSiteBlueprint {
  if (!value || typeof value !== "object") {
    throw new Error("analyze_project_requirement: site is missing");
  }

  const candidate = value as Partial<ProjectSiteBlueprint>;
  if (!Array.isArray(candidate.pages) || !isSectionSpecArray(candidate.layoutSections)) {
    throw new Error("analyze_project_requirement: site must include layoutSections and pages");
  }

  const pages = candidate.pages.map((page, index) => normalizePageBlueprint(page, index));
  return {
    informationArchitecture: normalizeInformationArchitecture(candidate.informationArchitecture, pages),
    layoutSections: candidate.layoutSections.map((section, index) =>
      normalizeSectionSpec(section, index)
    ),
    pages,
  };
}

function asProjectBlueprint(value: unknown): ProjectBlueprint {
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
    pages?: unknown;
  };
  if (
    typeof flatCandidate.projectTitle === "string" &&
    typeof flatCandidate.projectDescription === "string" &&
    flatCandidate.designIntent &&
    isSectionSpecArray(flatCandidate.layoutSections) &&
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
    const layoutSections = singlePage.sections.filter(
      (section) => section.type === "navigation" || section.type === "footer"
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
        layoutSections: layoutSections.map((section, index) => normalizeSectionSpec(section, index)),
        pages: normalizedPages,
      },
    };
  }

  throw new Error("analyze_project_requirement: output does not match ProjectBlueprint");
}

export async function stepAnalyzeProjectRequirement(
  userInput: string
): Promise<ProjectBlueprint> {
  const systemPrompt = [
    loadStepPrompt("analyzeProjectRequirement"),
    "\n\n",
    loadGuardrail("outputJson"),
  ].join("");

  const raw = await callLLM(systemPrompt, userInput, 0.5);
  const jsonStr = extractJSON(raw);

  try {
    return asProjectBlueprint(JSON.parse(jsonStr));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("analyze_project_requirement:")) {
      throw new Error(`${error.message}\nRaw output:\n${raw}`);
    }

    throw new Error(
      `analyze_project_requirement: failed to parse ProjectBlueprint JSON.\nRaw output:\n${raw}`
    );
  }
}
