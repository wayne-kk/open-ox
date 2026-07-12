import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { listAllAuthAdminUsers } from "@/lib/admin/analytics/authUsers";
import { isInternalUser } from "@/lib/admin/analytics/internalAccounts";
import {
  buildUserActivityStats,
  classifyActivityStatus,
  emptyActivityStats,
  filterAndPageDirectoryUsers,
  getDisplayName,
  resolveAuthProvider,
  type UserDirectoryFilters,
  type UserDirectoryRow,
} from "@/lib/admin/userDirectory";

export async function fetchAdminUserDirectory(
  filters: UserDirectoryFilters
): Promise<{
  users: UserDirectoryRow[];
  pagination: ReturnType<typeof filterAndPageDirectoryUsers>["pagination"];
  adminIds: string[];
}> {
  const service = createSupabaseServiceRoleClient();

  const [authUsers, adminRoles, manualInternal, projectsResult, runsResult, creditsResult] =
    await Promise.all([
      listAllAuthAdminUsers(),
      service.from("user_roles").select("user_id").eq("role", "admin"),
      service.from("analytics_internal_accounts").select("user_id"),
      service
        .from("projects")
        .select("user_id, status, created_at, completed_at, modification_history"),
      service.from("generation_runs").select("user_id, created_at, finished_at"),
      service.from("user_credit_accounts").select("user_id, balance, plan"),
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

  const activityByUser = buildUserActivityStats({
    projects: (projectsResult.data ?? []) as Array<{
      user_id: string | null;
      status: string;
      created_at: string;
      completed_at: string | null;
      modification_history?: unknown;
    }>,
    runs: (runsResult.data ?? []) as Array<{
      user_id: string | null;
      created_at: string;
      finished_at: string | null;
    }>,
  });

  const creditsByUser = new Map<string, { balance: number; plan: "free" | "pro" }>();
  if (!creditsResult.error) {
    for (const row of creditsResult.data ?? []) {
      const userId = (row as { user_id: string }).user_id;
      const balance = Number((row as { balance: number | string }).balance ?? 0);
      const plan = (row as { plan: string }).plan === "pro" ? "pro" : "free";
      creditsByUser.set(userId, {
        balance: Number.isFinite(balance) ? balance : 0,
        plan,
      });
    }
  }

  const nowMs = Date.now();
  const rows: UserDirectoryRow[] = authUsers.map((user) => {
    const email = user.email ?? null;
    const activity = activityByUser.get(user.id) ?? emptyActivityStats();
    const credits = creditsByUser.get(user.id) ?? null;
    const lastActiveAt = activity.lastActiveAt;
    return {
      userId: user.id,
      email,
      name: getDisplayName({
        userId: user.id,
        email,
        userMetadata: user.user_metadata ?? null,
      }),
      registeredAt: user.created_at ?? null,
      isAdmin: adminUserIds.has(user.id),
      isInternal: isInternalUser({
        userId: user.id,
        email,
        adminUserIds,
        manualInternalIds,
      }),
      provider: resolveAuthProvider({
        email,
        userMetadata: user.user_metadata ?? null,
        appMetadata: (user as { app_metadata?: Record<string, unknown> | null }).app_metadata ?? null,
      }),
      projectCount: activity.projectCount,
      readyCount: activity.readyCount,
      modifyCount: activity.modifyCount,
      lastActiveAt,
      activityStatus: classifyActivityStatus(lastActiveAt, nowMs),
      creditBalance: credits?.balance ?? null,
      creditPlan: credits?.plan ?? null,
    };
  });

  const paged = filterAndPageDirectoryUsers(rows, filters);
  return {
    users: paged.users,
    pagination: paged.pagination,
    adminIds: [...adminUserIds],
  };
}
