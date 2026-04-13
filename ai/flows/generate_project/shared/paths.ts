function normalizeSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (!normalized || normalized === "/" || normalized === "home" || normalized === "index") {
    return "home";
  }

  return normalized;
}

export function slugToPagePath(slug: string): string {
  const normalized = normalizeSlug(slug);
  if (normalized === "home") {
    return "app/page.tsx";
  }

  return `app/${normalized}/page.tsx`;
}

export function buildSectionFileStem(scopeSlug: string, sectionFileName: string): string {
  const normalizedScope = normalizeSlug(scopeSlug);
  return `${normalizedScope}_${sectionFileName}`;
}

export function buildSectionFilePath(scopeSlug: string, sectionFileName: string): string {
  return `components/sections/${buildSectionFileStem(scopeSlug, sectionFileName)}.tsx`;
}

export function buildSectionImportPath(scopeSlug: string, sectionFileName: string): string {
  return `@/components/sections/${buildSectionFileStem(scopeSlug, sectionFileName)}`;
}

export function buildScreenFileStem(scopeSlug: string): string {
  const normalizedScope = normalizeSlug(scopeSlug);
  return `${normalizedScope}_AppScreen`;
}

export function buildScreenFilePath(scopeSlug: string): string {
  return `components/screens/${buildScreenFileStem(scopeSlug)}.tsx`;
}

export function buildScreenImportPath(scopeSlug: string): string {
  return `@/components/screens/${buildScreenFileStem(scopeSlug)}`;
}
