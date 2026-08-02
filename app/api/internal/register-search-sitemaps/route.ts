import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/internal/cronAuth";
import { registerSitemapWithSearchEngines } from "@/lib/seo/sitemapRegistration";

async function run(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const results = await registerSitemapWithSearchEngines();
  return NextResponse.json({ sitemap: `${process.env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`, results });
}

export const GET = run;
export const POST = run;
