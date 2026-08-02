import {
  listProjectSitemapShards,
} from "@/lib/seo/projectSearchRepository";
import { isSeoOriginLocal, resolvePublicOrigin } from "@/lib/seo/siteUrl";
import { sitemapIndexXml, sitemapXmlResponse } from "@/lib/seo/sitemapXml";

export const dynamic = "force-dynamic";

export async function GET() {
  const origin = await resolvePublicOrigin();
  if (isSeoOriginLocal(origin)) return sitemapXmlResponse(sitemapIndexXml([]));
  const shards = await listProjectSitemapShards();
  const locations = [`${origin}/sitemaps/static`];
  for (const shard of shards) {
    locations.push(`${origin}/sitemaps/projects/${shard.page}`);
  }
  return sitemapXmlResponse(sitemapIndexXml(locations));
}
