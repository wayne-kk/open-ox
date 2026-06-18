import { describe, expect, it } from "vitest";
import {
  bucketSessionDuration,
  computeSessions,
  maskEmail,
  normalizePagePath,
} from "@/lib/admin/analytics/sessionMetrics";

describe("sessionMetrics", () => {
  it("normalizes common paths", () => {
    expect(normalizePagePath("/studio/foo")).toBe("/studio");
    expect(normalizePagePath("/projects/abc")).toBe("/projects/[id]");
  });

  it("computes session duration from events", () => {
    const sessions = computeSessions([
      {
        event_name: "page_view",
        user_id: "u1",
        client_ts: "2026-06-01T10:00:00.000Z",
        session_id: "s1",
        properties: { path: "/studio" },
      },
      {
        event_name: "studio_heartbeat",
        user_id: "u1",
        client_ts: "2026-06-01T10:05:00.000Z",
        session_id: "s1",
        properties: { path: "/studio" },
      },
    ]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.durationMinutes).toBeGreaterThan(0);
  });

  it("buckets durations and masks email", () => {
    expect(bucketSessionDuration(0.5)).toBe("0-1");
    expect(bucketSessionDuration(12)).toBe("5-15");
    expect(maskEmail("alice@example.com")).toBe("a***@example.com");
  });
});
