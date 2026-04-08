import { isLayoutSection } from "../registry/layoutSections";
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
  const allLayoutCandidates =
    blueprint.site.layoutSections.length > 0
      ? blueprint.site.layoutSections
      : blueprint.site.pages.flatMap((page) => page.sections).filter((section) => isLayoutSection(section.type));

  const layoutSections = dedupeSectionsByFileName(
    allLayoutCandidates.filter((section) => isLayoutSection(section.type))
  );

  const misplacedSections = blueprint.site.layoutSections.filter(
    (section) => !isLayoutSection(section.type)
  );

  const pages = blueprint.site.pages.map((page, index) => {
    const pageSections = page.sections.filter((section) => !isLayoutSection(section.type));
    if (index === 0 && misplacedSections.length > 0) {
      const existingFileNames = new Set(pageSections.map((s) => s.fileName));
      const toAdd = misplacedSections.filter((s) => !existingFileNames.has(s.fileName));
      return { ...page, sections: [...toAdd, ...pageSections] };
    }
    return { ...page, sections: pageSections };
  });

  return {
    ...blueprint,
    site: {
      ...blueprint.site,
      layoutSections,
      pages,
    },
  };
}
