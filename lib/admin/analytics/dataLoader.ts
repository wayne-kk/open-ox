import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { filterExternalUsers, getInternalEmailDomains } from "@/lib/admin/analytics/internalAccounts";

export interface AuthUserRecord {
  id: string;
  email: string | null;
  created_at: string;
}

export interface ProjectRecord {
  id: string;
  user_id: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  modification_history: unknown;
}

export interface GenerationRunRecord {
  id: string;
  project_id: string;
  user_id: string | null;
  status: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface AnalyticsEventRecord {
  event_name: string;
  user_id: string | null;
  client_ts: string;
  session_id: string;
  properties: Record<string, unknown>;
}

export interface AnalyticsBaseData {
  users: AuthUserRecord[];
  projects: ProjectRecord[];
  runs: GenerationRunRecord[];
  events: AnalyticsEventRecord[];
  adminUserIds: Set<string>;
  manualInternalIds: Set<string>;
  excludeInternal: boolean;
}

async function listAllAuthUsers(): Promise<AuthUserRecord[]> {
  const service = createSupabaseServiceRoleClient();
  const users: AuthUserRecord[] = [];
  const perPage = 200;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const user of data?.users ?? []) {
      users.push({
        id: user.id,
        email: user.email ?? null,
        created_at: user.created_at ?? new Date(0).toISOString(),
      });
    }
    if ((data?.users ?? []).length < perPage) break;
  }
  return users;
}

export async function loadAnalyticsBase(params: {
  from: Date;
  to: Date;
  excludeInternal: boolean;
  eventsTo?: Date;
}): Promise<AnalyticsBaseData> {
  const service = createSupabaseServiceRoleClient();
  const eventsEnd = params.eventsTo ?? new Date(params.to.getTime() + 31 * 86_400_000);

  const [users, adminRoles, manualInternal, projectsResult, runsResult, eventsResult] =
    await Promise.all([
      listAllAuthUsers(),
      service.from("user_roles").select("user_id").eq("role", "admin"),
      service.from("analytics_internal_accounts").select("user_id"),
      service.from("projects").select("id, user_id, status, created_at, completed_at, modification_history"),
      service.from("generation_runs").select("id, project_id, user_id, status, created_at, started_at, finished_at"),
      service
        .from("analytics_events")
        .select("event_name, user_id, client_ts, session_id, properties")
        .gte("client_ts", params.from.toISOString())
        .lte("client_ts", new Date(eventsEnd.getTime() + 86_399_999).toISOString()),
    ]);

  if (projectsResult.error) throw new Error(projectsResult.error.message);
  if (runsResult.error) throw new Error(runsResult.error.message);

  const adminUserIds = new Set(
    (adminRoles.data ?? []).map((row) => (row as { user_id: string }).user_id)
  );
  const manualInternalIds = new Set(
    manualInternal.error
      ? []
      : (manualInternal.data ?? []).map((row) => (row as { user_id: string }).user_id)
  );

  let filteredUsers = users;
  if (params.excludeInternal) {
    filteredUsers = filterExternalUsers(users, { adminUserIds, manualInternalIds });
  }
  const allowedUserIds = new Set(filteredUsers.map((user) => user.id));

  const projects = ((projectsResult.data ?? []) as ProjectRecord[]).filter(
    (project) => !project.user_id || allowedUserIds.has(project.user_id)
  );

  const allRuns = (runsResult.data ?? []) as GenerationRunRecord[];
  const runs = allRuns.filter((run) => !run.user_id || allowedUserIds.has(run.user_id));

  let events: AnalyticsEventRecord[] = [];
  if (!eventsResult.error) {
    events = ((eventsResult.data ?? []) as AnalyticsEventRecord[]).filter(
      (event) => !event.user_id || allowedUserIds.has(event.user_id)
    );
  }

  return {
    users: filteredUsers,
    projects,
    runs,
    events,
    adminUserIds,
    manualInternalIds,
    excludeInternal: params.excludeInternal,
  };
}

export function getInternalFilterSummary(data: AnalyticsBaseData): {
  excludedAdminCount: number;
  excludedManualCount: number;
  internalDomains: string[];
} {
  return {
    excludedAdminCount: data.adminUserIds.size,
    excludedManualCount: data.manualInternalIds.size,
    internalDomains: getInternalEmailDomains(),
  };
}
