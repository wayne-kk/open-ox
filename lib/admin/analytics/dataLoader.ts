import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { listAllAuthUsers } from "@/lib/admin/analytics/authUsers";
import {
  filterExternalUsers,
  getInternalEmailDomains,
} from "@/lib/admin/analytics/internalAccounts";

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

export interface AnalyticsAudience {
  users: AuthUserRecord[];
  adminUserIds: Set<string>;
  manualInternalIds: Set<string>;
  excludeInternal: boolean;
}

type AnalyticsAudienceSource = Omit<
  AnalyticsAudience,
  "users" | "excludeInternal"
> & {
  users: AuthUserRecord[];
};

let audienceSourceCache:
  | { expiresAt: number; promise: Promise<AnalyticsAudienceSource> }
  | undefined;

async function loadAnalyticsAudienceSource(): Promise<AnalyticsAudienceSource> {
  const now = Date.now();
  if (audienceSourceCache && audienceSourceCache.expiresAt > now) {
    return audienceSourceCache.promise;
  }

  const promise = (async () => {
    const service = createSupabaseServiceRoleClient();
    const [users, adminRoles, manualInternal] = await Promise.all([
      listAllAuthUsers(),
      service.from("user_roles").select("user_id").eq("role", "admin"),
      service.from("analytics_internal_accounts").select("user_id"),
    ]);

    return {
      users,
      adminUserIds: new Set(
        (adminRoles.data ?? []).map(
          (row) => (row as { user_id: string }).user_id,
        ),
      ),
      manualInternalIds: new Set(
        manualInternal.error
          ? []
          : (manualInternal.data ?? []).map(
              (row) => (row as { user_id: string }).user_id,
            ),
      ),
    };
  })();

  audienceSourceCache = { expiresAt: now + 30_000, promise };
  promise.catch(() => {
    if (audienceSourceCache?.promise === promise) {
      audienceSourceCache = undefined;
    }
  });
  return promise;
}

export function invalidateAnalyticsAudienceCache(): void {
  audienceSourceCache = undefined;
}

export async function loadAnalyticsAudience(params: {
  excludeInternal: boolean;
}): Promise<AnalyticsAudience> {
  const { users, adminUserIds, manualInternalIds } =
    await loadAnalyticsAudienceSource();
  const filteredUsers = params.excludeInternal
    ? filterExternalUsers(users, { adminUserIds, manualInternalIds })
    : users;

  return {
    users: filteredUsers,
    adminUserIds,
    manualInternalIds,
    excludeInternal: params.excludeInternal,
  };
}

export async function loadAnalyticsBase(params: {
  from: Date;
  to: Date;
  excludeInternal: boolean;
  eventsTo?: Date;
}): Promise<AnalyticsBaseData> {
  const service = createSupabaseServiceRoleClient();
  const eventsEnd =
    params.eventsTo ?? new Date(params.to.getTime() + 31 * 86_400_000);

  const [audience, projectsResult, runsResult, eventsResult] =
    await Promise.all([
      loadAnalyticsAudience({ excludeInternal: params.excludeInternal }),
      service
        .from("projects")
        .select(
          "id, user_id, status, created_at, completed_at, modification_history",
        ),
      service
        .from("generation_runs")
        .select(
          "id, project_id, user_id, status, created_at, started_at, finished_at",
        ),
      service
        .from("analytics_events")
        .select("event_name, user_id, client_ts, session_id, properties")
        .gte("client_ts", params.from.toISOString())
        .lte(
          "client_ts",
          new Date(eventsEnd.getTime() + 86_399_999).toISOString(),
        ),
    ]);

  if (projectsResult.error) throw new Error(projectsResult.error.message);
  if (runsResult.error) throw new Error(runsResult.error.message);

  const allowedUserIds = new Set(audience.users.map((user) => user.id));

  const projects = ((projectsResult.data ?? []) as ProjectRecord[]).filter(
    (project) => !project.user_id || allowedUserIds.has(project.user_id),
  );

  const allRuns = (runsResult.data ?? []) as GenerationRunRecord[];
  const runs = allRuns.filter(
    (run) => !run.user_id || allowedUserIds.has(run.user_id),
  );

  let events: AnalyticsEventRecord[] = [];
  if (!eventsResult.error) {
    events = ((eventsResult.data ?? []) as AnalyticsEventRecord[]).filter(
      (event) => !event.user_id || allowedUserIds.has(event.user_id),
    );
  }

  return {
    users: audience.users,
    projects,
    runs,
    events,
    adminUserIds: audience.adminUserIds,
    manualInternalIds: audience.manualInternalIds,
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
