import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  type QueryCall = {
    table: string;
    columns: string;
    filters: Array<{ method: "gte" | "lte"; column: string; value: string }>;
  };

  const calls: QueryCall[] = [];
  const service = {
    from(table: string) {
      return {
        select(columns: string) {
          const call: QueryCall = { table, columns, filters: [] };
          calls.push(call);
          const result = Promise.resolve({ data: [], error: null });
          const query = {
            gte(column: string, value: string) {
              call.filters.push({ method: "gte", column, value });
              return query;
            },
            lte(column: string, value: string) {
              call.filters.push({ method: "lte", column, value });
              return query;
            },
            then: result.then.bind(result),
          };
          return query;
        },
      };
    },
  };
  return { calls, service };
});

vi.mock("@/lib/supabase/service-role", () => ({
  createSupabaseServiceRoleClient: () => mocks.service,
}));

vi.mock("@/lib/admin/analytics/dataLoader", () => ({
  loadAnalyticsAudience: async () => ({
    users: [],
    adminUserIds: new Set<string>(),
    manualInternalIds: new Set<string>(),
    excludeInternal: true,
  }),
  getInternalFilterSummary: () => ({
    excludedAdminCount: 0,
    excludedManualCount: 0,
    internalDomains: [],
  }),
}));

import { fetchGenerationQuality } from "@/lib/admin/analytics/generation";

describe("fetchGenerationQuality query plan", () => {
  beforeEach(() => {
    mocks.calls.length = 0;
  });

  it("bounds heavy project and generation-run reads to the requested range", async () => {
    await fetchGenerationQuality({
      from: "2026-07-01",
      to: "2026-07-07",
      excludeInternal: true,
    });

    const heavyProjects = mocks.calls.find(
      (call) =>
        call.table === "projects" &&
        call.columns.includes("build_steps") &&
        call.columns.includes("modification_history"),
    );
    const runs = mocks.calls.find(
      (call) => call.table === "generation_runs",
    );

    for (const call of [heavyProjects, runs]) {
      expect(call?.filters).toEqual([
        {
          method: "gte",
          column: "created_at",
          value: "2026-07-01T00:00:00.000Z",
        },
        {
          method: "lte",
          column: "created_at",
          value: "2026-07-07T23:59:59.999Z",
        },
      ]);
    }
  });
});
