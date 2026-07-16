import { deriveAcquisitionChannel, isExternalReferrer } from "@/lib/analytics/acquisition";
import type { AcquisitionChannel } from "@/lib/analytics/catalog";
import {
  emptySeries,
  formatDateKey,
  incrementSeries,
  listDateKeys,
  parseDateRange,
  seriesToPoints,
  startOfUtcDay,
} from "@/lib/admin/analytics/dateRange";
import { listAllAuthUsers } from "@/lib/admin/analytics/authUsers";
import { filterExternalUsers, getInternalEmailDomains } from "@/lib/admin/analytics/internalAccounts";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

export type UserAcquisitionRow = {
  user_id: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  landing_path: string | null;
};

export type AcquisitionReportChannel = AcquisitionChannel | "unknown";

export type AcquisitionCountRow = { key: string; count: number };

export type AcquisitionResponse = {
  totalRegistrations: number;
  withAcquisition: number;
  channelShare: Array<{ channel: AcquisitionReportChannel; count: number }>;
  bySource: AcquisitionCountRow[];
  byMedium: AcquisitionCountRow[];
  byCampaign: AcquisitionCountRow[];
  topReferrerHosts: AcquisitionCountRow[];
  registrationTrend: Array<{ date: string; values: Record<string, number> }>;
  range: { from: string; to: string; days: number };
  excludeInternal: boolean;
  internalFilter: {
    excludedAdminCount: number;
    excludedManualCount: number;
    internalDomains: string[];
  };
};

function dateKeyFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatDateKey(startOfUtcDay(date));
}

function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topEntries(map: Map<string, number>, limit = 10): AcquisitionCountRow[] {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

export function resolveRegistrationChannel(
  row: UserAcquisitionRow | undefined,
  pageOrigin?: string | null
): AcquisitionReportChannel {
  if (!row) return "unknown";
  return deriveAcquisitionChannel(row, pageOrigin);
}

export function aggregateAcquisitionReport(params: {
  users: Array<{ id: string; created_at: string }>;
  acquisitions: UserAcquisitionRow[];
  keys: string[];
  pageOrigin?: string | null;
}): Omit<
  AcquisitionResponse,
  "range" | "excludeInternal" | "internalFilter"
> {
  const acqByUser = new Map(params.acquisitions.map((row) => [row.user_id, row]));
  const channelCounts = new Map<AcquisitionReportChannel, number>();
  const sourceCounts = new Map<string, number>();
  const mediumCounts = new Map<string, number>();
  const campaignCounts = new Map<string, number>();
  const referrerCounts = new Map<string, number>();
  const trend = emptySeries(params.keys, ["utm", "referral", "direct", "unknown"]);

  let totalRegistrations = 0;
  let withAcquisition = 0;

  for (const user of params.users) {
    const dateKey = dateKeyFromIso(user.created_at);
    if (!dateKey || !params.keys.includes(dateKey)) continue;

    totalRegistrations += 1;
    const row = acqByUser.get(user.id);
    if (row) withAcquisition += 1;

    const channel = resolveRegistrationChannel(row, params.pageOrigin);
    bump(channelCounts, channel);
    incrementSeries(trend, dateKey, channel);

    if (row?.utm_source) bump(sourceCounts, row.utm_source);
    if (row?.utm_medium) bump(mediumCounts, row.utm_medium);
    if (row?.utm_campaign) bump(campaignCounts, row.utm_campaign);

    if (row && isExternalReferrer(row.referrer, params.pageOrigin)) {
      const host = referrerHost(row.referrer);
      if (host) bump(referrerCounts, host);
    }
  }

  const channelOrder: AcquisitionReportChannel[] = ["utm", "referral", "direct", "unknown"];
  const channelShare = channelOrder.map((channel) => ({
    channel,
    count: channelCounts.get(channel) ?? 0,
  }));

  return {
    totalRegistrations,
    withAcquisition,
    channelShare,
    bySource: topEntries(sourceCounts),
    byMedium: topEntries(mediumCounts),
    byCampaign: topEntries(campaignCounts),
    topReferrerHosts: topEntries(referrerCounts),
    registrationTrend: seriesToPoints(trend, params.keys),
  };
}

export async function fetchAcquisition(params: {
  from?: string | null;
  to?: string | null;
  excludeInternal?: boolean;
}): Promise<AcquisitionResponse> {
  const range = parseDateRange(params);
  const keys = listDateKeys(range.from, range.to);
  const excludeInternal = params.excludeInternal !== false;
  const service = createSupabaseServiceRoleClient();

  const [users, adminRoles, manualInternal, acquisitionsResult] = await Promise.all([
    listAllAuthUsers(),
    service.from("user_roles").select("user_id").eq("role", "admin"),
    service.from("analytics_internal_accounts").select("user_id"),
    service
      .from("user_acquisition")
      .select(
        "user_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_path"
      ),
  ]);

  if (acquisitionsResult.error) {
    throw new Error(acquisitionsResult.error.message);
  }

  const adminUserIds = new Set(
    (adminRoles.data ?? []).map((row) => (row as { user_id: string }).user_id)
  );
  const manualInternalIds = new Set(
    manualInternal.error
      ? []
      : (manualInternal.data ?? []).map((row) => (row as { user_id: string }).user_id)
  );

  const filteredUsers = excludeInternal
    ? filterExternalUsers(users, { adminUserIds, manualInternalIds })
    : users;

  const allowed = new Set(filteredUsers.map((user) => user.id));
  const acquisitions = ((acquisitionsResult.data ?? []) as UserAcquisitionRow[]).filter((row) =>
    allowed.has(row.user_id)
  );

  const aggregated = aggregateAcquisitionReport({
    users: filteredUsers,
    acquisitions,
    keys,
  });

  return {
    ...aggregated,
    range: {
      from: formatDateKey(range.from),
      to: formatDateKey(range.to),
      days: range.days,
    },
    excludeInternal,
    internalFilter: {
      excludedAdminCount: adminUserIds.size,
      excludedManualCount: manualInternalIds.size,
      internalDomains: getInternalEmailDomains(),
    },
  };
}
