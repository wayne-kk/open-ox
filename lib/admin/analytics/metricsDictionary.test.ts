import { describe, expect, it } from "vitest";
import {
  averageDailySuccessRatePercent,
  computeDauByDate,
  computeFirstProjectDateByUser,
  computeSuccessRatePercent,
  countMilestonesByDate,
  queueFinishedSinceParams,
} from "@/lib/admin/analytics/metricsDictionary";

describe("computeDauByDate", () => {
  it("counts only page_view / studio_heartbeat for logged-in users", () => {
    const dau = computeDauByDate({
      keys: ["2026-07-10", "2026-07-11"],
      events: [
        { event_name: "page_view", user_id: "u1", client_ts: "2026-07-10T08:00:00.000Z" },
        { event_name: "studio_heartbeat", user_id: "u1", client_ts: "2026-07-10T09:00:00.000Z" },
        { event_name: "page_view", user_id: "u2", client_ts: "2026-07-10T10:00:00.000Z" },
        { event_name: "preview_open", user_id: "u3", client_ts: "2026-07-10T11:00:00.000Z" },
        { event_name: "page_view", user_id: null, client_ts: "2026-07-10T12:00:00.000Z" },
        { event_name: "page_view", user_id: "u4", client_ts: "2026-07-11T08:00:00.000Z" },
      ],
    });

    expect(dau.get("2026-07-10")).toBe(2);
    expect(dau.get("2026-07-11")).toBe(1);
  });

  it("does not treat project/run activity as DAU (events-only)", () => {
    const dau = computeDauByDate({
      keys: ["2026-07-10"],
      events: [],
    });
    expect(dau.get("2026-07-10")).toBe(0);
  });

  it("respects allowedUserIds", () => {
    const dau = computeDauByDate({
      keys: ["2026-07-10"],
      allowedUserIds: new Set(["u1"]),
      events: [
        { event_name: "page_view", user_id: "u1", client_ts: "2026-07-10T08:00:00.000Z" },
        { event_name: "page_view", user_id: "u2", client_ts: "2026-07-10T08:00:00.000Z" },
      ],
    });
    expect(dau.get("2026-07-10")).toBe(1);
  });
});

describe("computeFirstProjectDateByUser + countMilestonesByDate", () => {
  it("counts each user only on their lifetime first project day", () => {
    const firstByUser = computeFirstProjectDateByUser([
      { user_id: "u1", created_at: "2026-07-10T10:00:00.000Z" },
      { user_id: "u1", created_at: "2026-07-11T10:00:00.000Z" },
      { user_id: "u2", created_at: "2026-07-11T12:00:00.000Z" },
    ]);

    expect(firstByUser.get("u1")).toBe("2026-07-10");
    expect(firstByUser.get("u2")).toBe("2026-07-11");

    const counts = countMilestonesByDate({
      keys: ["2026-07-10", "2026-07-11"],
      milestoneByUser: firstByUser,
    });
    expect(counts.get("2026-07-10")).toBe(1);
    expect(counts.get("2026-07-11")).toBe(1);
  });
});

describe("computeSuccessRatePercent", () => {
  it("excludes queued/running from the denominator and buckets by finished_at", () => {
    const runs = [
      { status: "succeeded", finished_at: "2026-07-10T12:00:00.000Z" },
      { status: "failed", finished_at: "2026-07-10T13:00:00.000Z" },
      { status: "queued", finished_at: null },
      { status: "running", finished_at: null },
      { status: "succeeded", finished_at: "2026-07-11T01:00:00.000Z" },
    ];

    expect(computeSuccessRatePercent(runs, "2026-07-10")).toBe(50);
    expect(computeSuccessRatePercent(runs, "2026-07-11")).toBe(100);
  });

  it("returns 0 when there are no terminal runs that day", () => {
    expect(
      computeSuccessRatePercent([{ status: "queued", finished_at: null }], "2026-07-10")
    ).toBe(0);
  });
});

describe("averageDailySuccessRatePercent", () => {
  it("averages daily rates including empty days as 0", () => {
    const runs = [
      { status: "succeeded", finished_at: "2026-07-10T12:00:00.000Z" },
      { status: "failed", finished_at: "2026-07-10T13:00:00.000Z" },
    ];
    // 50% on day1, 0% on day2 → avg 25
    expect(averageDailySuccessRatePercent(runs, ["2026-07-10", "2026-07-11"])).toBe(25);
  });
});

describe("queueFinishedSinceParams", () => {
  it("describes exact-count filters for 24h terminal counts", () => {
    expect(queueFinishedSinceParams("succeeded", "2026-07-11T00:00:00.000Z")).toEqual({
      status: "succeeded",
      finishedSince: "2026-07-11T00:00:00.000Z",
    });
    expect(queueFinishedSinceParams("failed", "2026-07-11T00:00:00.000Z").status).toBe("failed");
  });
});
