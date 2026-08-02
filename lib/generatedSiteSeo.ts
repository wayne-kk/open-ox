import fs from "node:fs/promises";
import path from "node:path";
import { defaultTreeAdapter, html, parse, serialize } from "parse5";

import type { ProjectMetadata } from "@/lib/projectManager";

export type GeneratedSiteSeoPage = {
  path: string;
  title: string;
  description: string;
};

export type GeneratedSiteSeoProfile = {
  origin: string;
  indexable: boolean;
  title: string;
  description: string;
  language: string;
  pages: GeneratedSiteSeoPage[];
};

type SeoBlueprint = {
  brief?: {
    projectTitle?: unknown;
    projectDescription?: unknown;
    language?: unknown;
  };
  site?: {
    pages?: Array<{
      slug?: unknown;
      title?: unknown;
      description?: unknown;
      pageDesignPlan?: { pageGoal?: unknown };
    }>;
  };
};

type HtmlAttribute = { name: string; value: string; namespace?: string; prefix?: string };
type HtmlNode = {
  nodeName: string;
  tagName?: string;
  attrs?: HtmlAttribute[];
  childNodes?: HtmlNode[];
  parentNode?: HtmlNode;
};

function element(tagName: string, attrs: Record<string, string> = {}): HtmlNode {
  return defaultTreeAdapter.createElement(
    tagName,
    html.NS.HTML,
    Object.entries(attrs).map(([name, value]) => ({ name, value }))
  ) as unknown as HtmlNode;
}

function append(parent: HtmlNode, child: HtmlNode): void {
  defaultTreeAdapter.appendChild(parent as never, child as never);
}

function textNode(value: string): HtmlNode {
  return defaultTreeAdapter.createTextNode(value) as unknown as HtmlNode;
}

function findElement(root: HtmlNode, tagName: string): HtmlNode | null {
  if (root.tagName === tagName) return root;
  for (const child of root.childNodes ?? []) {
    const found = findElement(child, tagName);
    if (found) return found;
  }
  return null;
}

function attribute(node: HtmlNode, name: string): string | null {
  return node.attrs?.find((attr) => attr.name === name)?.value ?? null;
}

function removeHeadNodes(head: HtmlNode, predicate: (node: HtmlNode) => boolean): void {
  for (const child of [...(head.childNodes ?? [])]) {
    if (predicate(child)) defaultTreeAdapter.detachNode(child as never);
  }
}

function normalizeRoute(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function publicUrl(origin: string, route: string): string {
  const base = origin.trim().replace(/\/+$/, "");
  return route === "/" ? `${base}/` : `${base}${route}`;
}

function routeFromHtmlPath(relativePath: string): string {
  const normalized = relativePath.split(path.sep).join("/");
  if (normalized === "index.html") return "/";
  if (normalized.endsWith("/index.html")) {
    return normalizeRoute(normalized.slice(0, -"/index.html".length));
  }
  return normalizeRoute(normalized.replace(/\.html$/, ""));
}

function isErrorDocument(relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join("/").toLowerCase();
  return normalized === "404.html" || normalized.endsWith("/404.html");
}

async function htmlFiles(root: string, current = root): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) return htmlFiles(root, full);
    return entry.isFile() && entry.name.endsWith(".html") ? [full] : [];
  }));
  return nested.flat();
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cleanDescription(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function routeFromSlug(value: unknown): string {
  const slug = nonEmptyString(value);
  return !slug || slug === "home" || slug === "index" ? "/" : normalizeRoute(slug);
}

export function buildGeneratedSiteSeoProfile(
  project: Pick<ProjectMetadata, "name" | "userPrompt" | "blueprint">,
  options: { origin: string; indexable: boolean }
): GeneratedSiteSeoProfile {
  const blueprint = (project.blueprint ?? {}) as SeoBlueprint;
  const title =
    nonEmptyString(blueprint.brief?.projectTitle) ??
    nonEmptyString(project.name) ??
    "Untitled site";
  const description = cleanDescription(
    nonEmptyString(blueprint.brief?.projectDescription) ??
      nonEmptyString(project.userPrompt) ??
      title
  );
  const language = nonEmptyString(blueprint.brief?.language) ?? "en";
  const blueprintPages = Array.isArray(blueprint.site?.pages) ? blueprint.site.pages : [];
  const pages = blueprintPages.map((page) => ({
    path: routeFromSlug(page.slug),
    title: nonEmptyString(page.title) ?? title,
    description: cleanDescription(
      nonEmptyString(page.description) ??
        nonEmptyString(page.pageDesignPlan?.pageGoal) ??
        description
    ),
  }));

  if (!pages.some((page) => page.path === "/")) {
    pages.unshift({ path: "/", title, description });
  }

  return {
    ...options,
    origin: options.origin.trim().replace(/\/+$/, ""),
    title,
    description,
    language,
    pages,
  };
}

function applyDocumentSeo(
  source: string,
  page: GeneratedSiteSeoPage,
  profile: GeneratedSiteSeoProfile,
  indexable = profile.indexable
): string {
  const document = parse(source) as unknown as HtmlNode;
  const html = findElement(document, "html");
  const head = findElement(document, "head");
  if (!html || !head) throw new Error("Generated HTML is missing <html> or <head>");

  html.attrs = [...(html.attrs ?? []).filter((attr) => attr.name !== "lang"), {
    name: "lang",
    value: profile.language || "en",
  }];

  removeHeadNodes(head, (node) => {
    if (node.tagName === "title") return true;
    if (node.tagName === "link" && attribute(node, "rel") === "canonical") return true;
    if (node.tagName === "script" && attribute(node, "data-open-ox-seo") === "json-ld") return true;
    if (node.tagName !== "meta") return false;
    const name = attribute(node, "name");
    const property = attribute(node, "property");
    return ["description", "robots", "twitter:card", "twitter:title", "twitter:description"].includes(name ?? "") ||
      ["og:type", "og:url", "og:title", "og:description", "og:site_name"].includes(property ?? "");
  });

  const description = cleanDescription(page.description || profile.description);
  const route = normalizeRoute(page.path);
  const canonical = publicUrl(profile.origin, route);
  const title = page.title.trim() || profile.title;

  const titleElement = element("title");
  append(titleElement, textNode(title));
  append(head, titleElement);
  append(head, element("meta", { name: "description", content: description }));
  append(head, element("meta", {
    name: "robots",
    content: indexable ? "index,follow" : "noindex,nofollow,noarchive",
  }));
  append(head, element("link", { rel: "canonical", href: canonical }));
  append(head, element("meta", { property: "og:type", content: "website" }));
  append(head, element("meta", { property: "og:url", content: canonical }));
  append(head, element("meta", { property: "og:title", content: title }));
  append(head, element("meta", { property: "og:description", content: description }));
  append(head, element("meta", { property: "og:site_name", content: profile.title }));
  append(head, element("meta", { name: "twitter:card", content: "summary" }));
  append(head, element("meta", { name: "twitter:title", content: title }));
  append(head, element("meta", { name: "twitter:description", content: description }));

  const structuredData = {
    "@context": "https://schema.org",
    "@type": route === "/" ? "WebSite" : "WebPage",
    name: title,
    description,
    url: canonical,
    ...(route === "/" ? {} : { isPartOf: { "@type": "WebSite", name: profile.title, url: publicUrl(profile.origin, "/") } }),
  };
  const script = element("script", { type: "application/ld+json", "data-open-ox-seo": "json-ld" });
  append(script, textNode(JSON.stringify(structuredData).replaceAll("<", "\\u003c")));
  append(head, script);

  return serialize(document as never);
}

export async function applyGeneratedSiteSeo(
  outDir: string,
  profile: GeneratedSiteSeoProfile
): Promise<void> {
  const pages = new Map(profile.pages.map((page) => [normalizeRoute(page.path), page]));
  const files = await htmlFiles(outDir);
  await Promise.all(files.map(async (file) => {
    const relativePath = path.relative(outDir, file);
    const route = routeFromHtmlPath(relativePath);
    const page = pages.get(route) ?? {
      path: route,
      title: route === "/" ? profile.title : `${profile.title} - ${route.split("/").filter(Boolean).at(-1)}`,
      description: profile.description,
    };
    const source = await fs.readFile(file, "utf8");
    await fs.writeFile(
      file,
      applyDocumentSeo(source, page, profile, profile.indexable && !isErrorDocument(relativePath)),
      "utf8"
    );
  }));

  if (!profile.indexable) {
    await fs.writeFile(path.join(outDir, "robots.txt"), "User-agent: *\nDisallow: /\n", "utf8");
    await fs.rm(path.join(outDir, "sitemap.xml"), { force: true });
    return;
  }

  const sitemapPages = [...new Map(files.filter((file) =>
    !isErrorDocument(path.relative(outDir, file))
  ).map((file) => {
    const route = routeFromHtmlPath(path.relative(outDir, file));
    return [route, publicUrl(profile.origin, route)] as const;
  })).values()];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPages.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join("\n")}\n</urlset>\n`;
  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${publicUrl(profile.origin, "/sitemap.xml")}\n`;
  await Promise.all([
    fs.writeFile(path.join(outDir, "sitemap.xml"), sitemap, "utf8"),
    fs.writeFile(path.join(outDir, "robots.txt"), robots, "utf8"),
  ]);
}
