import { unstable_cache } from "next/cache";
import { fetchAcquisition } from "@/lib/admin/analytics/acquisition";
import { evaluateAdminAlerts } from "@/lib/admin/analytics/alerts";
import { fetchCostAnalytics } from "@/lib/admin/analytics/cost";
import { fetchEngagement } from "@/lib/admin/analytics/engagement";
import { fetchActivationFunnel } from "@/lib/admin/analytics/funnel";
import { fetchGenerationQuality } from "@/lib/admin/analytics/generation";
import {
  fetchAdminOverview,
  fetchQueueHealth,
} from "@/lib/admin/analytics/queries";
import { fetchRetentionMatrix } from "@/lib/admin/analytics/retention";
import { fetchAdminUserDirectory } from "@/lib/admin/fetchUserDirectory";

export const fetchCachedAdminOverview = unstable_cache(
  async (from: string | null, to: string | null, excludeInternal: boolean) =>
    fetchAdminOverview({ from, to, excludeInternal }),
  ["admin-analytics-overview-v2"],
  { revalidate: 30, tags: ["admin-analytics"] },
);

export const fetchCachedQueueHealth = unstable_cache(
  async () => fetchQueueHealth(),
  ["admin-analytics-queue-v2"],
  { revalidate: 10, tags: ["admin-analytics"] },
);

export const fetchCachedGenerationQuality = unstable_cache(
  async (from: string | null, to: string | null, excludeInternal: boolean) =>
    fetchGenerationQuality({ from, to, excludeInternal }),
  ["admin-analytics-generation-v2"],
  { revalidate: 30, tags: ["admin-analytics"] },
);

export const fetchCachedAcquisition = unstable_cache(
  async (from: string | null, to: string | null, excludeInternal: boolean) =>
    fetchAcquisition({ from, to, excludeInternal }),
  ["admin-analytics-acquisition-v2"],
  { revalidate: 30, tags: ["admin-analytics"] },
);

export const fetchCachedEngagement = unstable_cache(
  async (from: string | null, to: string | null, excludeInternal: boolean) =>
    fetchEngagement({ from, to, excludeInternal }),
  ["admin-analytics-engagement-v2"],
  { revalidate: 30, tags: ["admin-analytics"] },
);

export const fetchCachedActivationFunnel = unstable_cache(
  async (from: string | null, to: string | null, excludeInternal: boolean) =>
    fetchActivationFunnel({ from, to, excludeInternal }),
  ["admin-analytics-funnel-v2"],
  { revalidate: 30, tags: ["admin-analytics"] },
);

export const fetchCachedRetention = unstable_cache(
  async (
    from: string | null,
    to: string | null,
    excludeInternal: boolean,
    anchor: "registration" | "firstReady",
  ) => fetchRetentionMatrix({ from, to, excludeInternal, anchor }),
  ["admin-analytics-retention-v2"],
  { revalidate: 30, tags: ["admin-analytics"] },
);

export const fetchCachedCostAnalytics = unstable_cache(
  async (from: string | null, to: string | null) =>
    fetchCostAnalytics({ from, to }),
  ["admin-analytics-cost-v2"],
  { revalidate: 30, tags: ["admin-analytics"] },
);

export const fetchCachedAdminAlerts = unstable_cache(
  async () =>
    evaluateAdminAlerts({
      fetchOverview: ({ from, to, excludeInternal }) =>
        fetchCachedAdminOverview(
          from ?? null,
          to ?? null,
          excludeInternal !== false,
        ),
      fetchQueue: fetchCachedQueueHealth,
    }),
  ["admin-analytics-alerts-v2"],
  { revalidate: 30, tags: ["admin-analytics"] },
);

export const fetchCachedAdminUserDirectory = unstable_cache(
  async (
    q: string,
    page: number,
    perPage: number,
    role: "all" | "admin" | "member",
    activation: "all" | "activated" | "not_activated",
    status: "all" | "active" | "silent" | "churned" | "never",
  ) => fetchAdminUserDirectory({ q, page, perPage, role, activation, status }),
  ["admin-user-directory-v2"],
  { revalidate: 30, tags: ["admin-user-directory"] },
);
