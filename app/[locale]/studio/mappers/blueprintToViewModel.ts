import type { PlannedProjectBlueprint } from "../types/build-studio";
import type { BlueprintViewModel } from "../types/blueprint-view";

export function blueprintToViewModel(blueprint: PlannedProjectBlueprint): BlueprintViewModel {
  const brief = blueprint.brief as unknown as Record<string, unknown>;

  const productScope = (brief.productScope as Record<string, unknown> | undefined) ?? {};
  const roles = (brief.roles as unknown[] | undefined) ?? [];
  const taskLoops = (brief.taskLoops as unknown[] | undefined) ?? [];
  const capabilities = (brief.capabilities as unknown[] | undefined) ?? [];
  const pages = (blueprint.site?.pages as unknown[] | undefined) ?? [];

  return {
    brief: {
      projectTitle: blueprint.brief.projectTitle,
      projectDescription: blueprint.brief.projectDescription,
      productScope: {
        inScope: Array.isArray(productScope.inScope) ? (productScope.inScope as string[]) : [],
        outOfScope: Array.isArray(productScope.outOfScope) ? (productScope.outOfScope as string[]) : [],
      },
      capabilities: capabilities.map((cap, index) => {
        const c = (cap as Record<string, unknown>) ?? {};
        return {
          capabilityId: String(c.capabilityId ?? `capability-${index + 1}`),
          name: String(c.name ?? `Capability ${index + 1}`),
          priority: String(c.priority ?? "must-have"),
          summary: typeof c.summary === "string" ? c.summary : undefined,
        };
      }),
      roles: roles.map((role, index) => {
        const r = (role as Record<string, unknown>) ?? {};
        return {
          roleId: String(r.roleId ?? `role-${index + 1}`),
          roleName: String(r.roleName ?? `Role ${index + 1}`),
          priority: typeof r.priority === "string" ? r.priority : undefined,
          summary: typeof r.summary === "string" ? r.summary : undefined,
          goals: Array.isArray(r.goals) ? (r.goals as string[]) : [],
        };
      }),
      taskLoops: taskLoops.map((loop, index) => {
        const l = (loop as Record<string, unknown>) ?? {};
        return {
          loopId: String(l.loopId ?? `loop-${index + 1}`),
          name: String(l.name ?? `Task loop ${index + 1}`),
          summary: typeof l.summary === "string" ? l.summary : undefined,
          steps: Array.isArray(l.steps) ? (l.steps as string[]) : [],
          successState: typeof l.successState === "string" ? l.successState : undefined,
        };
      }),
    },
    experience: {
      designIntent: {
        style: blueprint.experience.designIntent.style,
        colorDirection: blueprint.experience.designIntent.colorDirection,
        mood: blueprint.experience.designIntent.mood ?? [],
        keywords: blueprint.experience.designIntent.keywords ?? [],
      },
    },
    site: {
      pages: pages.map((page, pageIndex) => {
        const p = (page as Record<string, unknown>) ?? {};
        const sections = (p.sections as unknown[] | undefined) ?? [];
        return {
          slug: String(p.slug ?? `page-${pageIndex + 1}`),
          title: String(p.title ?? `Page ${pageIndex + 1}`),
          description: typeof p.description === "string" ? p.description : undefined,
          sections: sections.map((section, sectionIndex) => {
            const s = (section as Record<string, unknown>) ?? {};
            const designPlan = (s.designPlan as Record<string, unknown> | undefined) ?? {};
            return {
              fileName: String(s.fileName ?? `Section${sectionIndex + 1}`),
              type: String(s.type ?? "section"),
              intent: typeof s.intent === "string" ? s.intent : undefined,
              designPlan: typeof designPlan.rationale === "string" ? { rationale: designPlan.rationale } : undefined,
            };
          }),
        };
      }),
    },
  };
}
