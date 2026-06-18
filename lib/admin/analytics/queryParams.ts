import type { NextRequest } from "next/server";

export function parseAnalyticsQuery(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const anchor = searchParams.get("anchor");
  return {
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    excludeInternal: searchParams.get("excludeInternal") !== "false",
    anchor: anchor === "firstReady" ? ("firstReady" as const) : ("registration" as const),
  };
}
