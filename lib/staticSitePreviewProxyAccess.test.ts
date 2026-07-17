import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PREVIEW_ACCESS_GRANT_COOKIE,
  clearStaticPreviewAccessRowCache,
  loadStaticPreviewAccessRow,
  mintPreviewAccessGrant,
  previewAccessGrantSetCookieHeader,
  readPreviewAccessGrantFromCookieHeader,
  resolveStaticPreviewAccess,
  verifyPreviewAccessGrant,
} from "./staticSitePreviewProxyAccess";

describe("preview access grant cookie", () => {
  beforeEach(() => {
    vi.stubEnv("OPEN_OX_PREVIEW_CAPTURE_SECRET", "test-grant-secret-32chars-xxxxxx");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips mint + verify for the same project", () => {
    const now = 1_700_000_000;
    const token = mintPreviewAccessGrant("proj-a", now);
    expect(token).toBeTruthy();
    expect(verifyPreviewAccessGrant("proj-a", token, now)).toBe(true);
    expect(verifyPreviewAccessGrant("proj-b", token, now)).toBe(false);
    expect(verifyPreviewAccessGrant("proj-a", token, now + 60)).toBe(true);
  });

  it("rejects expired grants", () => {
    const now = 1_700_000_000;
    const token = mintPreviewAccessGrant("proj-a", now)!;
    expect(verifyPreviewAccessGrant("proj-a", token, now + 16 * 60)).toBe(false);
  });

  it("parses cookie header and builds Path-scoped Set-Cookie", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.com");
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_ORIGIN", "");
    const token = mintPreviewAccessGrant("2026-07-16T10-51-18-282Z_project", 1_700_000_000)!;
    const header = `${PREVIEW_ACCESS_GRANT_COOKIE}=${encodeURIComponent(token)}; other=1`;
    expect(readPreviewAccessGrantFromCookieHeader(header)).toBe(token);
    const set = previewAccessGrantSetCookieHeader("2026-07-16T10-51-18-282Z_project", token);
    expect(set).toContain(
      `Path=/site-previews/${encodeURIComponent("2026-07-16T10-51-18-282Z_project")}`
    );
    expect(set).toContain("HttpOnly");
    expect(set).toContain("SameSite=Lax");
    expect(set).not.toContain("SameSite=None");
  });

  it("scopes grant cookie Path to /{id} on dedicated preview origin", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.com");
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_ORIGIN", "https://p.example.com");
    const token = mintPreviewAccessGrant("p1", 1_700_000_000)!;
    const set = previewAccessGrantSetCookieHeader("p1", token);
    expect(set).toContain("Path=/p1");
    expect(set).toContain("SameSite=None");
    expect(set).toContain("Secure");
    expect(set).toContain("Partitioned");
  });
});

describe("loadStaticPreviewAccessRow", () => {
  afterEach(() => {
    clearStaticPreviewAccessRowCache();
  });

  it("selects only lean columns and caches the row", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "p1",
        user_id: "owner-1",
        publish_preview: true,
        deleted_at: null,
      },
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const db = { from } as never;

    const row1 = await loadStaticPreviewAccessRow("p1", { db, nowMs: 1000 });
    expect(row1).toEqual({
      id: "p1",
      ownerUserId: "owner-1",
      publishPreview: true,
      deleted: false,
    });
    expect(select).toHaveBeenCalledWith("id, user_id, publish_preview, deleted_at");

    const row2 = await loadStaticPreviewAccessRow("p1", { db, nowMs: 2000 });
    expect(row2).toEqual(row1);
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("treats soft-deleted projects as missing", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "p1",
        user_id: "owner-1",
        publish_preview: true,
        deleted_at: "2026-07-17T12:00:00.000Z",
      },
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const db = { from } as never;

    const row = await loadStaticPreviewAccessRow("p1", { db, nowMs: 1000 });
    expect(row).toBeNull();
  });
});

describe("resolveStaticPreviewAccess", () => {
  beforeEach(() => {
    vi.stubEnv("OPEN_OX_PREVIEW_CAPTURE_SECRET", "test-grant-secret-32chars-xxxxxx");
    clearStaticPreviewAccessRowCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    clearStaticPreviewAccessRowCache();
  });

  function mockDb(row: {
    id: string;
    user_id: string | null;
    publish_preview: boolean | null;
    deleted_at?: string | null;
  } | null) {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: row
        ? { deleted_at: null, ...row }
        : null,
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    return { from } as never;
  }

  it("allows capture secret without DB or session", async () => {
    const getSessionUser = vi.fn();
    const result = await resolveStaticPreviewAccess({
      projectId: "p1",
      request: new Request("http://localhost/site-previews/p1", {
        headers: { "x-open-ox-preview-capture": "test-grant-secret-32chars-xxxxxx" },
      }),
      getSessionUser,
      isAdminUser: vi.fn(),
      db: mockDb(null),
    });
    expect(result).toEqual({ status: "ok" });
    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it("allows publishPreview anonymously and sets a grant cookie", async () => {
    const getSessionUser = vi.fn();
    const result = await resolveStaticPreviewAccess({
      projectId: "p1",
      request: new Request("http://localhost/site-previews/p1"),
      getSessionUser,
      isAdminUser: vi.fn(),
      db: mockDb({ id: "p1", user_id: "owner-1", publish_preview: true }),
      nowSec: 1_700_000_000,
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.setGrantCookie).toContain(PREVIEW_ACCESS_GRANT_COOKIE);
    }
    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it("allows private project via valid grant cookie without session", async () => {
    const token = mintPreviewAccessGrant("p1", 1_700_000_000)!;
    const getSessionUser = vi.fn();
    const result = await resolveStaticPreviewAccess({
      projectId: "p1",
      request: new Request("http://localhost/site-previews/p1", {
        headers: {
          cookie: `${PREVIEW_ACCESS_GRANT_COOKIE}=${encodeURIComponent(token)}`,
        },
      }),
      getSessionUser,
      isAdminUser: vi.fn(),
      db: mockDb({ id: "p1", user_id: "owner-1", publish_preview: false }),
      nowSec: 1_700_000_000,
    });
    expect(result).toEqual({ status: "ok" });
    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it("allows private project via ox_grant query and sets cookie", async () => {
    const token = mintPreviewAccessGrant("p1", 1_700_000_000)!;
    const getSessionUser = vi.fn();
    const result = await resolveStaticPreviewAccess({
      projectId: "p1",
      request: new Request(
        `http://p.example.com/p1?ox_grant=${encodeURIComponent(token)}`
      ),
      getSessionUser,
      isAdminUser: vi.fn(),
      db: mockDb({ id: "p1", user_id: "owner-1", publish_preview: false }),
      nowSec: 1_700_000_000,
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.setGrantCookie).toContain(PREVIEW_ACCESS_GRANT_COOKIE);
    }
    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it("allows private owner via session and sets grant cookie", async () => {
    const isAdminUser = vi.fn().mockResolvedValue(false);
    const result = await resolveStaticPreviewAccess({
      projectId: "p1",
      request: new Request("http://localhost/site-previews/p1"),
      getSessionUser: async () => ({
        user: { id: "owner-1" },
        supabase: {} as never,
      }),
      isAdminUser,
      db: mockDb({ id: "p1", user_id: "owner-1", publish_preview: false }),
      nowSec: 1_700_000_000,
    });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.setGrantCookie).toContain(PREVIEW_ACCESS_GRANT_COOKIE);
    }
  });

  it("forbids anonymous access to private projects", async () => {
    const result = await resolveStaticPreviewAccess({
      projectId: "p1",
      request: new Request("http://localhost/site-previews/p1"),
      getSessionUser: async () => null,
      isAdminUser: vi.fn(),
      db: mockDb({ id: "p1", user_id: "owner-1", publish_preview: false }),
    });
    expect(result).toEqual({ status: "forbidden" });
  });

  it("denies grant cookie after project is soft-deleted", async () => {
    const token = mintPreviewAccessGrant("p1", 1_700_000_000)!;
    const result = await resolveStaticPreviewAccess({
      projectId: "p1",
      request: new Request("http://localhost/site-previews/p1", {
        headers: {
          cookie: `${PREVIEW_ACCESS_GRANT_COOKIE}=${encodeURIComponent(token)}`,
        },
      }),
      getSessionUser: vi.fn(),
      isAdminUser: vi.fn(),
      db: mockDb({
        id: "p1",
        user_id: "owner-1",
        publish_preview: true,
        deleted_at: "2026-07-17T12:00:00.000Z",
      }),
      nowSec: 1_700_000_000,
    });
    expect(result).toEqual({ status: "not_found" });
  });
});
