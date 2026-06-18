import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export type ServerAnalyticsEvent = {
  userId?: string | null;
  eventName: string;
  properties?: Record<string, unknown>;
  sessionId?: string;
};

export async function trackServerAnalyticsEvent(event: ServerAnalyticsEvent): Promise<void> {
  try {
    const service = createSupabaseServiceRoleClient();
    const userId = event.userId ?? null;
    await service.from("analytics_events").insert({
      user_id: userId,
      anonymous_id: userId ? `user_${userId}` : "server_anonymous",
      session_id: event.sessionId ?? `server_${Date.now()}`,
      event_name: event.eventName,
      properties: event.properties ?? {},
      client_ts: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[analytics] server event failed:", err instanceof Error ? err.message : err);
  }
}

export function trackServerAnalyticsEventFireAndForget(event: ServerAnalyticsEvent): void {
  void trackServerAnalyticsEvent(event);
}
