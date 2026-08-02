import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/internal/cronAuth";
import { processSearchDiscoveryJobs } from "@/lib/seo/searchDiscovery";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

async function run(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const result = await processSearchDiscoveryJobs(createSupabaseServiceRoleClient());
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error), code: "SEARCH_DISCOVERY_FAILED" },
      { status: 500 }
    );
  }
}

export const GET = run;
export const POST = run;
