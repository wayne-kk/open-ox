export type UserActivityStatus = "active" | "silent" | "churned" | "never";

export type UserDirectoryFilters = {
  q?: string;
  role?: "all" | "admin" | "member";
  activation?: "all" | "activated" | "not_activated";
  status?: "all" | UserActivityStatus;
  page?: number;
  perPage?: number;
};

export type UserDirectoryRow = {
  userId: string;
  email: string | null;
  name: string;
  registeredAt: string | null;
  isAdmin: boolean;
  isInternal: boolean;
  provider: string;
  projectCount: number;
  readyCount: number;
  modifyCount: number;
  lastActiveAt: string | null;
  activityStatus: UserActivityStatus;
  creditBalance: number | null;
  creditPlan: "free" | "pro" | null;
};

export type UserActivityStats = {
  projectCount: number;
  readyCount: number;
  modifyCount: number;
  lastActiveAt: string | null;
};

const ACTIVE_MS = 7 * 86_400_000;
const SILENT_MS = 30 * 86_400_000;

export function getDisplayName(params: {
  userId: string;
  email: string | null | undefined;
  userMetadata?: Record<string, unknown> | null;
}): string {
  const meta = params.userMetadata ?? {};
  const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
  if (fullName) return fullName;
  const name = typeof meta.name === "string" ? meta.name.trim() : "";
  if (name) return name;
  const preferred =
    typeof meta.preferred_username === "string" ? meta.preferred_username.trim() : "";
  if (preferred) return preferred;
  if (params.email) return params.email.split("@")[0] ?? params.userId.slice(0, 8);
  return params.userId.slice(0, 8);
}

export function resolveAuthProvider(params: {
  email: string | null | undefined;
  userMetadata?: Record<string, unknown> | null;
  appMetadata?: Record<string, unknown> | null;
}): string {
  const userMeta = params.userMetadata ?? {};
  if (typeof userMeta.feishu_open_id === "string" && userMeta.feishu_open_id) {
    return "feishu";
  }
  const appMeta = params.appMetadata ?? {};
  if (typeof appMeta.provider === "string" && appMeta.provider.trim()) {
    return appMeta.provider.trim().toLowerCase();
  }
  if (params.email?.endsWith("@feishu.open-ox.local")) return "feishu";
  return "unknown";
}

export function classifyActivityStatus(
  lastActiveAt: string | null | undefined,
  nowMs = Date.now()
): UserActivityStatus {
  if (!lastActiveAt) return "never";
  const ts = new Date(lastActiveAt).getTime();
  if (Number.isNaN(ts)) return "never";
  const age = nowMs - ts;
  if (age <= ACTIVE_MS) return "active";
  if (age <= SILENT_MS) return "silent";
  return "churned";
}

function maxIso(current: string | null, candidate: string | null | undefined): string | null {
  if (!candidate) return current;
  const next = new Date(candidate).getTime();
  if (Number.isNaN(next)) return current;
  if (!current) return candidate;
  return next > new Date(current).getTime() ? candidate : current;
}

/**
 * Aggregate per-user project/run activity for the directory.
 */
export function buildUserActivityStats(params: {
  projects: Array<{
    user_id: string | null;
    status: string;
    created_at: string;
    completed_at: string | null;
    modification_history?: unknown;
  }>;
  runs: Array<{
    user_id: string | null;
    created_at: string;
    finished_at: string | null;
  }>;
}): Map<string, UserActivityStats> {
  const stats = new Map<string, UserActivityStats>();

  function ensure(userId: string): UserActivityStats {
    const existing = stats.get(userId);
    if (existing) return existing;
    const created: UserActivityStats = {
      projectCount: 0,
      readyCount: 0,
      modifyCount: 0,
      lastActiveAt: null,
    };
    stats.set(userId, created);
    return created;
  }

  for (const project of params.projects) {
    if (!project.user_id) continue;
    const row = ensure(project.user_id);
    row.projectCount += 1;
    if (project.status === "ready") row.readyCount += 1;
    if (Array.isArray(project.modification_history)) {
      row.modifyCount += project.modification_history.length;
    }
    row.lastActiveAt = maxIso(row.lastActiveAt, project.created_at);
    row.lastActiveAt = maxIso(row.lastActiveAt, project.completed_at);
  }

  for (const run of params.runs) {
    if (!run.user_id) continue;
    const row = ensure(run.user_id);
    row.lastActiveAt = maxIso(row.lastActiveAt, run.created_at);
    row.lastActiveAt = maxIso(row.lastActiveAt, run.finished_at);
  }

  return stats;
}

export function emptyActivityStats(): UserActivityStats {
  return { projectCount: 0, readyCount: 0, modifyCount: 0, lastActiveAt: null };
}

export function filterAndPageDirectoryUsers(
  rows: UserDirectoryRow[],
  filters: UserDirectoryFilters
): {
  users: UserDirectoryRow[];
  pagination: {
    q: string;
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    role: string;
    activation: string;
    status: string;
  };
} {
  const q = (filters.q ?? "").trim().toLowerCase();
  const role = filters.role ?? "all";
  const activation = filters.activation ?? "all";
  const status = filters.status ?? "all";
  const perPage = Math.max(1, Math.min(filters.perPage ?? 20, 50));

  let filtered = rows;
  if (q) {
    filtered = filtered.filter((user) => {
      const haystack = `${user.name} ${user.email ?? ""} ${user.userId}`.toLowerCase();
      return haystack.includes(q);
    });
  }
  if (role === "admin") filtered = filtered.filter((user) => user.isAdmin);
  if (role === "member") filtered = filtered.filter((user) => !user.isAdmin);
  if (activation === "activated") filtered = filtered.filter((user) => user.readyCount > 0);
  if (activation === "not_activated") filtered = filtered.filter((user) => user.readyCount === 0);
  if (status !== "all") {
    filtered = filtered.filter((user) => user.activityStatus === status);
  }

  const sorted = [...filtered].sort((a, b) => {
    const ta = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
    const tb = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
    return tb - ta;
  });

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, filters.page ?? 1), totalPages);
  const start = (page - 1) * perPage;

  return {
    users: sorted.slice(start, start + perPage),
    pagination: {
      q,
      page,
      perPage,
      total,
      totalPages,
      role,
      activation,
      status,
    },
  };
}
