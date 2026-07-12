import { describe, expect, it } from "vitest";
import {
  applyStaleDeployTimeout,
  BUILD_STALE_MS,
  idleDeployStatus,
  publicDeployStatusFromRow,
  QUEUED_STALE_MS,
} from "./deployStatus";

describe("idleDeployStatus", () => {
  it("does not report queued (that would spin forever in the Deploy menu)", () => {
    const idle = idleDeployStatus();
    expect(idle.status).toBeNull();
    expect(idle.status).not.toBe("queued");
  });
});

describe("publicDeployStatusFromRow", () => {
  const now = Date.parse("2026-07-12T12:00:00.000Z");

  it("maps missing row to null status (not queued)", () => {
    // Regression: previously rowToPublic(null) returned status "queued", so Deploy spun forever.
    expect(publicDeployStatusFromRow(null, now)).toEqual({
      status: null,
      lastError: null,
      stale: false,
    });
  });

  it("maps fresh queued row through", () => {
    expect(
      publicDeployStatusFromRow(
        {
          last_status: "queued",
          last_error: null,
          updated_at: new Date(now - 5_000).toISOString(),
        },
        now
      )
    ).toEqual({ status: "queued", lastError: null, stale: false });
  });

  it("marks orphaned queued as error so the spinner stops", () => {
    const result = publicDeployStatusFromRow(
      {
        last_status: "queued",
        last_error: null,
        updated_at: new Date(now - QUEUED_STALE_MS - 1).toISOString(),
      },
      now
    );
    expect(result).toMatchObject({ status: "error", stale: true });
    expect(result.lastError).toMatch(/未启动|重新 Deploy/);
  });
});

describe("applyStaleDeployTimeout", () => {
  const now = Date.parse("2026-07-12T12:00:00.000Z");

  it("keeps fresh queued status", () => {
    const updatedAt = new Date(now - 10_000).toISOString();
    expect(
      applyStaleDeployTimeout({ status: "queued", lastError: null, updatedAt }, now)
    ).toEqual({ status: "queued", lastError: null, stale: false });
  });

  it("fails building past the long stale window", () => {
    const updatedAt = new Date(now - BUILD_STALE_MS - 1).toISOString();
    const result = applyStaleDeployTimeout(
      { status: "building", lastError: null, updatedAt },
      now
    );
    expect(result.stale).toBe(true);
    expect(result.status).toBe("error");
  });

  it("leaves ready untouched", () => {
    expect(
      applyStaleDeployTimeout(
        {
          status: "ready",
          lastError: null,
          updatedAt: new Date(now - BUILD_STALE_MS * 2).toISOString(),
        },
        now
      )
    ).toEqual({ status: "ready", lastError: null, stale: false });
  });
});
