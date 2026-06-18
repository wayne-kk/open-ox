import { describe, expect, it } from "vitest";
import { buildUserMilestones } from "@/lib/admin/analytics/funnel";
import type { AnalyticsBaseData } from "@/lib/admin/analytics/dataLoader";

function baseData(overrides: Partial<AnalyticsBaseData> = {}): AnalyticsBaseData {
  return {
    users: [{ id: "u1", email: "a@test.com", created_at: "2026-06-01T10:00:00.000Z" }],
    projects: [],
    runs: [],
    events: [],
    adminUserIds: new Set(),
    manualInternalIds: new Set(),
    excludeInternal: true,
    ...overrides,
  };
}

describe("buildUserMilestones", () => {
  it("tracks first project and ready milestones", () => {
    const milestones = buildUserMilestones(
      baseData({
        projects: [
          {
            id: "p1",
            user_id: "u1",
            status: "ready",
            created_at: "2026-06-02T10:00:00.000Z",
            completed_at: "2026-06-03T10:00:00.000Z",
            modification_history: [],
          },
        ],
        runs: [
          {
            id: "r1",
            project_id: "p1",
            user_id: "u1",
            status: "succeeded",
            created_at: "2026-06-02T11:00:00.000Z",
            started_at: "2026-06-02T11:05:00.000Z",
            finished_at: "2026-06-02T12:00:00.000Z",
          },
        ],
      })
    );

    expect(milestones).toHaveLength(1);
    expect(milestones[0]?.firstProjectAt).toBe("2026-06-02");
    expect(milestones[0]?.firstQueuedAt).toBe("2026-06-02");
    expect(milestones[0]?.firstRunningAt).toBe("2026-06-02");
    expect(milestones[0]?.firstReadyAt).toBe("2026-06-02");
  });
});
