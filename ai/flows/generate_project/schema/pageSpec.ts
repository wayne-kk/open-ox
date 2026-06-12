import type { PlannedSectionSpec, SectionSpec } from "../types";

export interface PageSpecSectionLayout {
  columns?: number;
  mediaSide?: "left" | "right" | "none";
  density?: "compact" | "normal" | "spacious";
}

export interface PageSpecSection {
  id: string;
  type: string;
  fileName: string;
  intent: string;
  contentHints: string;
  layout?: PageSpecSectionLayout;
  copy?: Record<string, string>;
  visual?: Record<string, string>;
  constraints?: string[];
}

export interface PageSpecChromeRegion {
  style?: string;
  items?: string[];
  columns?: number;
}

export interface PageSpecChrome {
  header?: PageSpecChromeRegion;
  footer?: PageSpecChromeRegion;
}

export interface PageSpec {
  viewport?: { assumedWidth?: number };
  chrome?: PageSpecChrome;
  sections: PageSpecSection[];
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function normalizeFileName(raw: string, index: number): string {
  const base = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return base.length > 0 ? base : `section_${index + 1}`;
}

function normalizePageSpecSection(value: unknown, index: number): PageSpecSection {
  const c = isObjectRecord(value) ? value : {};
  const id = asString(c.id, `section-${index + 1}`);
  const type = asString(c.type, "content-block");
  const fileName = normalizeFileName(asString(c.fileName, id), index);
  const intent = asString(c.intent, "Reproduce this block from the reference screenshot.");
  const contentHints = asString(
    c.contentHints,
    "Match layout, typography hierarchy, and visible copy from the screenshot."
  );

  const layoutRaw = isObjectRecord(c.layout) ? c.layout : null;
  const layout: PageSpecSectionLayout | undefined = layoutRaw
    ? {
        columns: typeof layoutRaw.columns === "number" ? layoutRaw.columns : undefined,
        mediaSide:
          layoutRaw.mediaSide === "left" ||
          layoutRaw.mediaSide === "right" ||
          layoutRaw.mediaSide === "none"
            ? layoutRaw.mediaSide
            : undefined,
        density:
          layoutRaw.density === "compact" ||
          layoutRaw.density === "normal" ||
          layoutRaw.density === "spacious"
            ? layoutRaw.density
            : undefined,
      }
    : undefined;

  const copy = isObjectRecord(c.copy)
    ? Object.fromEntries(
        Object.entries(c.copy).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      )
    : undefined;

  const visual = isObjectRecord(c.visual)
    ? Object.fromEntries(
        Object.entries(c.visual).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      )
    : undefined;

  return {
    id,
    type,
    fileName,
    intent,
    contentHints,
    ...(layout && Object.values(layout).some((v) => v !== undefined) ? { layout } : {}),
    ...(copy && Object.keys(copy).length > 0 ? { copy } : {}),
    ...(visual && Object.keys(visual).length > 0 ? { visual } : {}),
    constraints: asStringArray(c.constraints),
  };
}

export function normalizePageSpec(value: unknown): PageSpec {
  const root = isObjectRecord(value) ? value : {};
  const sectionsRaw = Array.isArray(root.sections) ? root.sections : [];
  const sections = sectionsRaw.map((section, index) => normalizePageSpecSection(section, index));

  if (sections.length === 0) {
    throw new Error("analyze_screenshot_layout: PageSpec must include at least one section");
  }

  const seen = new Set<string>();
  for (const section of sections) {
    if (seen.has(section.fileName)) {
      throw new Error(
        `analyze_screenshot_layout: duplicate section fileName "${section.fileName}"`
      );
    }
    seen.add(section.fileName);
  }

  const chromeRaw = isObjectRecord(root.chrome) ? root.chrome : null;
  const chrome: PageSpecChrome | undefined = chromeRaw
    ? {
        header: isObjectRecord(chromeRaw.header)
          ? {
              style: asString(chromeRaw.header.style) || undefined,
              items: asStringArray(chromeRaw.header.items),
            }
          : undefined,
        footer: isObjectRecord(chromeRaw.footer)
          ? {
              columns:
                typeof chromeRaw.footer.columns === "number"
                  ? chromeRaw.footer.columns
                  : undefined,
              items: asStringArray(chromeRaw.footer.items),
            }
          : undefined,
      }
    : undefined;

  const viewportRaw = isObjectRecord(root.viewport) ? root.viewport : null;

  return {
    ...(viewportRaw && typeof viewportRaw.assumedWidth === "number"
      ? { viewport: { assumedWidth: viewportRaw.assumedWidth } }
      : {}),
    ...(chrome ? { chrome } : {}),
    sections,
  };
}

export function pageSpecSectionsToPlannedSections(
  sections: PageSpecSection[]
): PlannedSectionSpec[] {
  return sections.map((section) => sectionSpecFromPageSpecSection(section));
}

function sectionSpecFromPageSpecSection(section: PageSpecSection): SectionSpec {
  const extra = {
    ...(section.layout ? { layout: section.layout } : {}),
    ...(section.copy ? { copy: section.copy } : {}),
    ...(section.visual ? { visual: section.visual } : {}),
    ...(section.constraints?.length ? { constraints: section.constraints } : {}),
  };
  const hints =
    Object.keys(extra).length > 0
      ? `${section.contentHints}\n\nStructured hints:\n${JSON.stringify(extra, null, 2)}`
      : section.contentHints;

  return {
    type: section.type,
    intent: section.intent,
    contentHints: hints,
    fileName: section.fileName,
  };
}

export function pageSpecSectionToJson(section: PageSpecSection): string {
  return JSON.stringify(section, null, 2);
}

export function mergePageSpecSectionsIntoBlueprint<T extends { site: { pages: Array<{ sections: PlannedSectionSpec[] }> } }>(
  blueprint: T,
  sections: PlannedSectionSpec[]
): T {
  if (blueprint.site.pages.length === 0) return blueprint;
  return {
    ...blueprint,
    site: {
      ...blueprint.site,
      pages: blueprint.site.pages.map((page, index) =>
        index === 0 ? { ...page, sections } : page
      ),
    },
  };
}

export function tryLoadPageSpecFromSite(readSiteFile: (path: string) => string): PageSpec | null {
  try {
    const raw = readSiteFile("screenshot-page-spec.json");
    if (!raw || raw.includes("(missing")) return null;
    return normalizePageSpec(JSON.parse(raw));
  } catch {
    return null;
  }
}
