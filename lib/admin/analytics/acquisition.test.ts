import { describe, expect, it } from "vitest";
import {
  aggregateAcquisitionReport,
  resolveRegistrationChannel,
  type UserAcquisitionRow,
} from "@/lib/admin/analytics/acquisition";

describe("resolveRegistrationChannel", () => {
  it("returns unknown when acquisition row is missing", () => {
    expect(resolveRegistrationChannel(undefined)).toBe("unknown");
  });

  it("derives utm / referral / direct from row", () => {
    const base: UserAcquisitionRow = {
      user_id: "u1",
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
      referrer: null,
      landing_path: "/",
    };
    expect(resolveRegistrationChannel({ ...base, utm_source: "twitter" })).toBe("utm");
    expect(
      resolveRegistrationChannel(
        { ...base, referrer: "https://news.ycombinator.com/item?id=1" },
        "https://app.example"
      )
    ).toBe("referral");
    expect(resolveRegistrationChannel(base, "https://app.example")).toBe("direct");
  });
});

describe("aggregateAcquisitionReport", () => {
  it("buckets registrations by channel and UTM dimensions", () => {
    const users = [
      { id: "a", created_at: "2026-07-10T12:00:00.000Z" },
      { id: "b", created_at: "2026-07-11T12:00:00.000Z" },
      { id: "c", created_at: "2026-07-11T18:00:00.000Z" },
      { id: "d", created_at: "2026-07-12T09:00:00.000Z" },
    ];
    const acquisitions: UserAcquisitionRow[] = [
      {
        user_id: "a",
        utm_source: "twitter",
        utm_medium: "social",
        utm_campaign: "launch",
        utm_content: null,
        utm_term: null,
        referrer: "https://t.co/x",
        landing_path: "/?utm_source=twitter",
      },
      {
        user_id: "b",
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_content: null,
        utm_term: null,
        referrer: "https://news.ycombinator.com/",
        landing_path: "/",
      },
      {
        user_id: "c",
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_content: null,
        utm_term: null,
        referrer: null,
        landing_path: "/",
      },
    ];

    const report = aggregateAcquisitionReport({
      users,
      acquisitions,
      keys: ["2026-07-10", "2026-07-11", "2026-07-12"],
      pageOrigin: "https://app.example",
    });

    expect(report.totalRegistrations).toBe(4);
    expect(report.withAcquisition).toBe(3);
    expect(Object.fromEntries(report.channelShare.map((row) => [row.channel, row.count]))).toEqual({
      utm: 1,
      referral: 1,
      direct: 1,
      unknown: 1,
    });
    expect(report.bySource[0]?.key).toBe("twitter");
    expect(report.byCampaign[0]?.key).toBe("launch");
    expect(report.topReferrerHosts[0]?.key).toBe("news.ycombinator.com");
    expect(report.registrationTrend[1]?.values.referral).toBe(1);
    expect(report.registrationTrend[1]?.values.direct).toBe(1);
  });
});
