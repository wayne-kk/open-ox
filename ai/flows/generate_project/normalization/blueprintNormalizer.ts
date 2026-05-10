import type { ProjectBlueprint, SectionSpec } from "../types";

function dedupeSectionsByFileName(sections: SectionSpec[]): SectionSpec[] {
  const seen = new Set<string>();
  return sections.filter((section) => {
    if (seen.has(section.fileName)) return false;
    seen.add(section.fileName);
    return true;
  });
}

export function normalizeBlueprint(blueprint: ProjectBlueprint): ProjectBlueprint {
  const pages = blueprint.site.pages.map((page) => ({
    ...page,
    sections: dedupeSectionsByFileName(page.sections),
  }));

  return {
    ...blueprint,
    site: {
      ...blueprint.site,
      pages,
    },
  };
}
