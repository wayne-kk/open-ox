import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { parseDateRange, listDateKeys, formatDateKey, seriesToPoints } from "@/lib/admin/analytics/dateRange";
import { computeSessions, maskEmail } from "@/lib/admin/analytics/sessionMetrics";
import { writeAdminAuditLog } from "@/lib/admin/analytics/auditLog";

export type UserTimelineEvent = {
  at: string;
  kind: string;
  label: string;
  meta?: string;
};

export type UserAnalyticsResponse = {
  userId: string;
  email: string | null;
  name: string;
  registeredAt: string | null;
  projectCount: number;
  readyCount: number;
  modifyCount: number;
  dailyStudioMinutes: Array<{ date: string; values: Record<string, number> }>;
  timeline: UserTimelineEvent[];
};

function getDisplayName(meta: Record<string, unknown> | null | undefined, email: string | null, userId: string): string {
  const fullName = typeof meta?.full_name === "string" ? meta.full_name.trim() : "";
  if (fullName) return fullName;
  const name = typeof meta?.name === "string" ? meta.name.trim() : "";
  if (name) return name;
  if (email) return email.split("@")[0];
  return userId.slice(0, 8);
}

export async function fetchUserAnalytics(params: {
  userId: string;
  adminUserId: string;
  days?: number;
}): Promise<UserAnalyticsResponse | null> {
  const service = createSupabaseServiceRoleClient();
  const userResp = await service.auth.admin.getUserById(params.userId);
  const authUser = userResp.data.user;
  if (!authUser) return null;

  await writeAdminAuditLog({
    adminUserId: params.adminUserId,
    action: "user_detail_view",
    resource: params.userId,
    metadata: { days: params.days ?? 90 },
  });

  const days = params.days ?? 90;
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86_400_000);
  const keys = listDateKeys(from, to);

  const [projectsResult, runsResult, eventsResult] = await Promise.all([
    service.from("projects").select("id, name, status, created_at, completed_at, modification_history").eq("user_id", params.userId),
    service.from("generation_runs").select("id, status, kind, created_at, started_at, finished_at, error").eq("user_id", params.userId),
    service
      .from("analytics_events")
      .select("event_name, client_ts, session_id, properties")
      .eq("user_id", params.userId)
      .gte("client_ts", from.toISOString())
      .order("client_ts", { ascending: false })
      .limit(500),
  ]);

  const projects = projectsResult.data ?? [];
  const runs = runsResult.data ?? [];
  const events = (eventsResult.error ? [] : eventsResult.data ?? []) as Array<{
    event_name: string;
    client_ts: string;
    session_id: string;
    properties: Record<string, unknown>;
  }>;

  const sessions = computeSessions(
    events.map((event) => ({
      ...event,
      user_id: params.userId,
    }))
  );

  const studioByDate = Object.fromEntries(keys.map((date) => [date, { minutes: 0 }]));
  for (const session of sessions) {
    if (!studioByDate[session.startDateKey]) continue;
    const studioMinutes = events.some(
      (event) =>
        event.session_id === session.sessionId &&
        (event.event_name === "studio_enter" || event.event_name === "studio_heartbeat")
    )
      ? session.durationMinutes
      : 0;
    studioByDate[session.startDateKey].minutes += studioMinutes;
  }

  const timeline: UserTimelineEvent[] = [];

  for (const project of projects) {
    timeline.push({
      at: (project as { created_at: string }).created_at,
      kind: "project",
      label: `创建项目 ${(project as { name: string }).name}`,
      meta: (project as { status: string }).status,
    });
    if ((project as { status: string }).status === "ready" && (project as { completed_at: string | null }).completed_at) {
      timeline.push({
        at: (project as { completed_at: string }).completed_at,
        kind: "ready",
        label: `项目 Ready · ${(project as { name: string }).name}`,
      });
    }
  }

  for (const run of runs) {
    timeline.push({
      at: (run as { created_at: string }).created_at,
      kind: "generation",
      label: `生成 ${(run as { kind: string }).kind} · ${(run as { status: string }).status}`,
      meta: (run as { error: string | null }).error ?? undefined,
    });
  }

  for (const event of events.slice(0, 100)) {
    if (event.event_name === "page_view") {
      timeline.push({
        at: event.client_ts,
        kind: "page_view",
        label: `访问 ${String(event.properties?.path ?? "/")}`,
      });
    }
  }

  timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const modifyCount = projects.reduce((sum, project) => {
    const history = (project as { modification_history: unknown }).modification_history;
    return sum + (Array.isArray(history) ? history.length : 0);
  }, 0);

  return {
    userId: params.userId,
    email: maskEmail(authUser.email ?? null),
    name: getDisplayName(authUser.user_metadata as Record<string, unknown>, authUser.email ?? null, params.userId),
    registeredAt: authUser.created_at ?? null,
    projectCount: projects.length,
    readyCount: projects.filter((project) => (project as { status: string }).status === "ready").length,
    modifyCount,
    dailyStudioMinutes: seriesToPoints(
      Object.fromEntries(keys.map((date) => [date, { minutes: Math.round(studioByDate[date].minutes * 10) / 10 }])),
      keys
    ),
    timeline: timeline.slice(0, 80),
  };
}
