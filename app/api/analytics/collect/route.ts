import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

const MAX_BATCH = 50;
const MAX_EVENTS_PER_MINUTE = 120;

type CollectEvent = {
  eventName?: unknown;
  properties?: unknown;
  clientTs?: unknown;
  sessionId?: unknown;
  anonymousId?: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeEvent(raw: CollectEvent) {
  const eventName = typeof raw.eventName === "string" ? raw.eventName.trim().slice(0, 64) : "";
  const sessionId = typeof raw.sessionId === "string" ? raw.sessionId.trim().slice(0, 128) : "";
  const anonymousId =
    typeof raw.anonymousId === "string" ? raw.anonymousId.trim().slice(0, 128) : "";
  const clientTsRaw = typeof raw.clientTs === "string" ? raw.clientTs : "";
  const clientTs = clientTsRaw ? new Date(clientTsRaw) : new Date();
  const properties = isPlainObject(raw.properties) ? raw.properties : {};

  if (!eventName || !sessionId || !anonymousId || Number.isNaN(clientTs.getTime())) {
    return null;
  }

  return {
    event_name: eventName,
    session_id: sessionId,
    anonymous_id: anonymousId,
    client_ts: clientTs.toISOString(),
    properties,
  };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, data: null, error: "Invalid JSON", meta: null }, { status: 400 });
  }

  const eventsRaw = isPlainObject(body) && Array.isArray(body.events) ? body.events : [];
  if (eventsRaw.length === 0 || eventsRaw.length > MAX_BATCH) {
    return Response.json(
      { success: false, data: null, error: "events must contain 1-50 items", meta: null },
      { status: 400 }
    );
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 512) ?? null;
  const sanitized = eventsRaw
    .slice(0, MAX_BATCH)
    .map((event) => sanitizeEvent(event as CollectEvent))
    .filter((event): event is NonNullable<typeof event> => event != null);

  if (sanitized.length === 0) {
    return Response.json(
      { success: false, data: null, error: "No valid events", meta: null },
      { status: 400 }
    );
  }

  if (sanitized.length > MAX_EVENTS_PER_MINUTE) {
    return Response.json(
      { success: false, data: null, error: "Rate limit exceeded", meta: null },
      { status: 429 }
    );
  }

  const session = await getSessionUser();
  const userId = session?.user.id ?? null;

  const service = createSupabaseServiceRoleClient();
  const rows = sanitized.map((event) => ({
    ...event,
    user_id: userId,
    user_agent: userAgent,
  }));

  const { error } = await service.from("analytics_events").insert(rows);
  if (error) {
    if (error.message.includes("analytics_events")) {
      return Response.json(
        {
          success: false,
          data: null,
          error: "Analytics storage not migrated yet",
          meta: { code: "NOT_MIGRATED" },
        },
        { status: 503 }
      );
    }
    return Response.json({ success: false, data: null, error: error.message, meta: null }, { status: 500 });
  }

  return Response.json({ success: true, data: { accepted: rows.length }, error: null, meta: null });
}
