import { AnalyticsEventName } from "@/lib/analytics/catalog";
import { trackServerAnalyticsEvent } from "@/lib/analytics/serverEvents";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const EVENT_NAMES = {
  impression: AnalyticsEventName.brandBadgeImpression,
  collapse: AnalyticsEventName.brandBadgeCollapse,
  click: AnalyticsEventName.brandBadgeClick,
} as const;

const recentEvents = new Map<string, number>();
const projectRateBuckets = new Map<string, { count: number; resetAt: number }>();
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
const MAX_RECENT_EVENTS = 10_000;
const MAX_EVENTS_PER_PROJECT_PER_MINUTE = 120;

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: Request) {
  let body: {
    kind?: unknown;
    projectToken?: unknown;
    session?: unknown;
    viewportClass?: unknown;
    publicChannel?: unknown;
  };
  try {
    body = JSON.parse(await req.text()) as typeof body;
  } catch {
    return Response.json(
      { ok: false },
      { status: 400, headers: corsHeaders() },
    );
  }

  const kind = typeof body.kind === "string" ? body.kind : "";
  const projectToken =
    typeof body.projectToken === "string" ? body.projectToken : "";
  const session =
    typeof body.session === "string" ? body.session.slice(0, 80) : "";
  const viewportClass = body.viewportClass === "mobile" ? "mobile" : "desktop";
  const publicChannel =
    body.publicChannel === "vercel_deploy" ? "vercel_deploy" : "publish_preview";
  if (
    !(kind in EVENT_NAMES) ||
    !/^[a-f0-9-]{36}$/.test(projectToken) ||
    !session
  ) {
    return Response.json(
      { ok: false },
      { status: 400, headers: corsHeaders() },
    );
  }

  const service = createSupabaseServiceRoleClient();
  const { data: project } = await service
    .from("projects")
    .select("id")
    .eq("branding_attribution_token", projectToken)
    .maybeSingle();
  if (!project) {
    return Response.json(
      { ok: false },
      { status: 404, headers: corsHeaders() },
    );
  }

  const now = Date.now();
  const rateBucket = projectRateBuckets.get(projectToken);
  if (!rateBucket || now >= rateBucket.resetAt) {
    projectRateBuckets.set(projectToken, { count: 1, resetAt: now + 60_000 });
  } else if (rateBucket.count >= MAX_EVENTS_PER_PROJECT_PER_MINUTE) {
    return Response.json(
      { ok: false },
      { status: 429, headers: corsHeaders() },
    );
  } else {
    rateBucket.count += 1;
  }

  const dedupeKey = `${projectToken}:${session}:${kind}`;
  const seenAt = recentEvents.get(dedupeKey);
  if (seenAt && now - seenAt < DEDUPE_WINDOW_MS) {
    return Response.json(
      { ok: true, deduplicated: true },
      { headers: corsHeaders() },
    );
  }
  if (recentEvents.size >= MAX_RECENT_EVENTS) {
    for (const [key, timestamp] of recentEvents) {
      if (now - timestamp >= DEDUPE_WINDOW_MS) recentEvents.delete(key);
    }
    while (recentEvents.size >= MAX_RECENT_EVENTS) {
      const oldestKey = recentEvents.keys().next().value as string | undefined;
      if (!oldestKey) break;
      recentEvents.delete(oldestKey);
    }
  }
  recentEvents.set(dedupeKey, now);

  await trackServerAnalyticsEvent({
    eventName: EVENT_NAMES[kind as keyof typeof EVENT_NAMES],
    sessionId: `brand_${session}`,
    properties: {
      project_token: projectToken,
      badge_version: "v1",
      viewport_class: viewportClass,
      public_channel: publicChannel,
    },
  });
  return Response.json({ ok: true }, { headers: corsHeaders() });
}
