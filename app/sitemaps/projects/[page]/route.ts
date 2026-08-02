import { routing } from "@/i18n/routing";
import { projectCoverDisplayUrl } from "@/lib/projectCoverUrls";
import { listIndexableProjectsForSitemap, listProjectSitemapShards } from "@/lib/seo/projectSearchRepository";
import { indexableProjectUrl } from "@/lib/seo/publishedProject";
import { resolvePublicOrigin } from "@/lib/seo/siteUrl";
import { sitemapUrlSetXml, sitemapXmlResponse } from "@/lib/seo/sitemapXml";

type Params = { params: Promise<{ page: string }> };

export async function GET(_request: Request, { params }: Params) {
  const rawPage = (await params).page;
  if (!/^\d+$/.test(rawPage)) return new Response("Not found", { status: 404 });
  const page = Number(rawPage);
  const origin = await resolvePublicOrigin();
  const shard = (await listProjectSitemapShards()).find((candidate) => candidate.page === page);
  if (!shard) return new Response("Not found", { status: 404 });
  const projects = await listIndexableProjectsForSitemap(shard);
  const urls = projects.flatMap((project) => {
    const alternates: Record<string, string> = {};
    for (const locale of routing.locales) {
      alternates[locale] = indexableProjectUrl(project, locale, origin);
    }
    alternates["x-default"] = indexableProjectUrl(project, routing.defaultLocale, origin);
    return routing.locales.map((locale) => ({
      loc: indexableProjectUrl(project, locale, origin),
      lastmod: new Date(project.seoUpdatedAt).toISOString(),
      changefreq: "weekly",
      priority: 0.6,
      alternates,
      images: project.coverImageUpdatedAt
        ? [new URL(projectCoverDisplayUrl(project.id, project.coverImageUpdatedAt), origin).toString()]
        : undefined,
    }));
  });
  return sitemapXmlResponse(sitemapUrlSetXml(urls));
}
