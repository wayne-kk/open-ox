export function normalizeStaticRouteSlug(slug: string, fallback = "home"): string {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (normalized === "/" || normalized === "home" || normalized === "index") {
    return "home";
  }

  const withoutEdges = normalized.replace(/^\/+|\/+$/g, "");
  if (!withoutEdges || /[\[\]()@]/.test(withoutEdges)) {
    return fallback;
  }
  if (withoutEdges === "home" || withoutEdges === "index") {
    return "home";
  }

  const segments = withoutEdges.split("/").map((segment) =>
    segment
      .trim()
      .replace(/\s+/g, "-")
      .replace(/_/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
  );

  return segments.every(Boolean) ? segments.join("/") : fallback;
}

export function slugToPagePath(slug: string): string {
  const normalized = normalizeStaticRouteSlug(slug);
  if (normalized === "home") {
    return "app/page.tsx";
  }

  return `app/${normalized}/page.tsx`;
}

export function slugToPageComponentRoot(slug: string): string {
  const namespace = normalizeStaticRouteSlug(slug).replace(/\//g, "_");
  return `components/pages/${namespace}`;
}

export function buildSectionFileStem(scopeSlug: string, sectionFileName: string): string {
  const normalizedScope = normalizeStaticRouteSlug(scopeSlug).replace(/\//g, "_");
  return `${normalizedScope}_${sectionFileName}`;
}

export function buildSectionFilePath(scopeSlug: string, sectionFileName: string): string {
  return `components/sections/${buildSectionFileStem(scopeSlug, sectionFileName)}.tsx`;
}

export function buildSectionImportPath(scopeSlug: string, sectionFileName: string): string {
  return `@/components/sections/${buildSectionFileStem(scopeSlug, sectionFileName)}`;
}
