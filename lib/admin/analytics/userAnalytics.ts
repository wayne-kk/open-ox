import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { listDateKeys, seriesToPoints } from "@/lib/admin/analytics/dateRange";
import { computeSessions, maskEmail } from "@/lib/admin/analytics/sessionMetrics";
import { writeAdminAuditLog } from "@/lib/admin/analytics/auditLog";
import {
  classifyActivityStatus,
  getDisplayName,
  resolveAuthProvider,
  type UserActivityStatus,
} from "@/lib/admin/userDirectory";

export type UserTimelineEvent = {
  at: string;
  kind: string;
  label: string;
  meta?: string;
};

export type UserProjectSummary = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
};

export type UserAnalyticsResponse = {
  userId: string;
  email: string | null;
  name: string;
  registeredAt: string | null;
  isAdmin: boolean;
  provider: string;
  lastActiveAt: string | null;
  activityStatus: UserActivityStatus;
  creditBalance: number | null;
  creditPlan: "free" | "pro" | null;
  projectCount: number;
  readyCount: number;
  modifyCount: number;
  projects: UserProjectSummary[];
  dailyStudioMinutes: Array<{ date: string; values: Record<string, number> }>;
  timeline: UserTimelineEvent[];
};

function maxIso(current: string | null, candidate: string | null | undefined): string | null {
  if (!candidate) return current;
  const next = new Date(candidate).getTime();
  if (Number.isNaN(next)) return current;
  if (!current) return candidate;
  return next > new Date(current).getTime() ? candidate : current;
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

  const [projectsResult, runsResult, eventsResult, roleResult, creditsResult] = await Promise.all([
    service
      .from("projects")
      .select("id, name, status, created_at, completed_at, modification_history")
      .eq("user_id", params.userId)
      .order("created_at", { ascending: false }),
    service
      .from("generation_runs")
      .select("id, status, kind, created_at, started_at, finished_at, error")
      .eq("user_id", params.userId),
    service
      .from("analytics_events")
      .select("event_name, client_ts, session_id, properties")
      .eq("user_id", params.userId)
      .gte("client_ts", from.toISOString())
      .order("client_ts", { ascending: false })
      .limit(500),
    service.from("user_roles").select("role").eq("user_id", params.userId).eq("role", "admin").maybeSingle(),
    service
      .from("user_credit_accounts")
      .select("balance, plan")
      .eq("user_id", params.userId)
      .maybeSingle(),
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
  let lastActiveAt: string | null = null;

  for (const project of projects) {
    const createdAt = (project as { created_at: string }).created_at;
    const completedAt = (project as { completed_at: string | null }).completed_at;
    lastActiveAt = maxIso(lastActiveAt, createdAt);
    lastActiveAt = maxIso(lastActiveAt, completedAt);
    timeline.push({
      at: createdAt,
      kind: "project",
      label: `创建项目 ${(project as { name: string }).name}`,
      meta: (project as { status: string }).status,
    });
    if ((project as { status: string }).status === "ready" && completedAt) {
      timeline.push({
        at: completedAt,
        kind: "ready",
        label: `项目 Ready · ${(project as { name: string }).name}`,
      });
    }
  }

  for (const run of runs) {
    const createdAt = (run as { created_at: string }).created_at;
    const finishedAt = (run as { finished_at: string | null }).finished_at;
    lastActiveAt = maxIso(lastActiveAt, createdAt);
    lastActiveAt = maxIso(lastActiveAt, finishedAt);
    timeline.push({
      at: createdAt,
      kind: "generation",
      label: `生成 ${(run as { kind: string }).kind} · ${(run as { status: string }).status}`,
      meta: (run as { error: string | null }).error ?? undefined,
    });
  }

  for (const event of events.slice(0, 100)) {
    lastActiveAt = maxIso(lastActiveAt, event.client_ts);
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

  const email = authUser.email ?? null;
  const creditBalance =
    creditsResult.error || !creditsResult.data
      ? null
      : Number((creditsResult.data as { balance: number | string }).balance ?? 0);
  const creditPlan =
    creditsResult.error || !creditsResult.data
      ? null
      : (creditsResult.data as { plan: string }).plan === "pro"
        ? "pro"
        : "free";

  return {
    userId: params.userId,
    email: maskEmail(email),
    name: getDisplayName({
      userId: params.userId,
      email,
      userMetadata: authUser.user_metadata as Record<string, unknown>,
    }),
    registeredAt: authUser.created_at ?? null,
    isAdmin: Boolean(roleResult.data),
    provider: resolveAuthProvider({
      email,
      userMetadata: authUser.user_metadata as Record<string, unknown>,
      appMetadata: authUser.app_metadata as Record<string, unknown>,
    }),
    lastActiveAt,
    activityStatus: classifyActivityStatus(lastActiveAt),
    creditBalance: creditBalance != null && Number.isFinite(creditBalance) ? creditBalance : null,
    creditPlan,
    projectCount: projects.length,
    readyCount: projects.filter((project) => (project as { status: string }).status === "ready")
      .length,
    modifyCount,
    projects: projects.slice(0, 30).map((project) => ({
      id: (project as { id: string }).id,
      name: (project as { name: string }).name,
      status: (project as { status: string }).status,
      createdAt: (project as { created_at: string }).created_at,
      completedAt: (project as { completed_at: string | null }).completed_at,
    })),
    dailyStudioMinutes: seriesToPoints(
      Object.fromEntries(
        keys.map((date) => [date, { minutes: Math.round(studioByDate[date].minutes * 10) / 10 }])
      ),
      keys
    ),
    timeline: timeline.slice(0, 80),
  };
}
