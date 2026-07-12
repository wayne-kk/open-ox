import { describe, expect, it } from "vitest";
import {
  buildUserActivityStats,
  classifyActivityStatus,
  filterAndPageDirectoryUsers,
  getDisplayName,
  resolveAuthProvider,
  type UserDirectoryRow,
} from "@/lib/admin/userDirectory";

describe("classifyActivityStatus", () => {
  const now = Date.parse("2026-07-12T00:00:00.000Z");

  it("classifies never / active / silent / churned", () => {
    expect(classifyActivityStatus(null, now)).toBe("never");
    expect(classifyActivityStatus("2026-07-10T00:00:00.000Z", now)).toBe("active");
    expect(classifyActivityStatus("2026-06-20T00:00:00.000Z", now)).toBe("silent");
    expect(classifyActivityStatus("2026-05-01T00:00:00.000Z", now)).toBe("churned");
  });
});

describe("buildUserActivityStats", () => {
  it("aggregates projects, ready, modify, and last activity", () => {
    const stats = buildUserActivityStats({
      projects: [
        {
          user_id: "u1",
          status: "ready",
          created_at: "2026-07-01T00:00:00.000Z",
          completed_at: "2026-07-02T00:00:00.000Z",
          modification_history: [{}, {}],
        },
        {
          user_id: "u1",
          status: "failed",
          created_at: "2026-07-03T00:00:00.000Z",
          completed_at: null,
          modification_history: [],
        },
      ],
      runs: [
        {
          user_id: "u1",
          created_at: "2026-07-04T00:00:00.000Z",
          finished_at: "2026-07-05T12:00:00.000Z",
        },
      ],
    });

    const row = stats.get("u1");
    expect(row?.projectCount).toBe(2);
    expect(row?.readyCount).toBe(1);
    expect(row?.modifyCount).toBe(2);
    expect(row?.lastActiveAt).toBe("2026-07-05T12:00:00.000Z");
  });
});

describe("resolveAuthProvider / getDisplayName", () => {
  it("detects feishu and google", () => {
    expect(
      resolveAuthProvider({
        email: "x@y.com",
        userMetadata: { feishu_open_id: "ou_1" },
      })
    ).toBe("feishu");
    expect(
      resolveAuthProvider({
        email: "a@b.com",
        appMetadata: { provider: "google" },
      })
    ).toBe("google");
  });

  it("prefers full_name", () => {
    expect(
      getDisplayName({
        userId: "u1",
        email: "a@b.com",
        userMetadata: { full_name: "Ada" },
      })
    ).toBe("Ada");
  });
});

describe("filterAndPageDirectoryUsers", () => {
  const base: UserDirectoryRow = {
    userId: "u1",
    email: "a@test.com",
    name: "Ada",
    registeredAt: "2026-07-01T00:00:00.000Z",
    isAdmin: false,
    isInternal: false,
    provider: "google",
    projectCount: 1,
    readyCount: 1,
    modifyCount: 0,
    lastActiveAt: "2026-07-10T00:00:00.000Z",
    activityStatus: "active",
    creditBalance: 10,
    creditPlan: "free",
  };

  it("filters by activation and pages", () => {
    const rows: UserDirectoryRow[] = [
      base,
      {
        ...base,
        userId: "u2",
        name: "Bob",
        email: "b@test.com",
        readyCount: 0,
        activityStatus: "never",
        registeredAt: "2026-07-02T00:00:00.000Z",
      },
    ];
    const result = filterAndPageDirectoryUsers(rows, {
      activation: "activated",
      page: 1,
      perPage: 10,
    });
    expect(result.users).toHaveLength(1);
    expect(result.users[0]?.userId).toBe("u1");
    expect(result.pagination.total).toBe(1);
  });
});
