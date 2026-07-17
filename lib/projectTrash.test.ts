import { describe, expect, it, vi } from "vitest";
import {
  TRASH_AUTO_PURGE_DAYS,
  buildTrashUpdate,
  listDueTrashProjectIds,
  listProjectsSummary,
  restoreProject,
  trashProject,
} from "./projectManager";

describe("buildTrashUpdate", () => {
  const now = new Date("2026-07-17T12:00:00.000Z");

  it("clears Publish Preview and Allow Remix and schedules purge when autoPurge is on", () => {
    const patch = buildTrashUpdate({ autoPurge: true, now });
    expect(patch.publish_preview).toBe(false);
    expect(patch.allow_remix).toBe(false);
    expect(patch.deleted_at).toBe("2026-07-17T12:00:00.000Z");
    expect(patch.purge_after).toBe("2026-08-16T12:00:00.000Z");
    expect(TRASH_AUTO_PURGE_DAYS).toBe(30);
  });

  it("leaves purge_after null when autoPurge is off", () => {
    const patch = buildTrashUpdate({ autoPurge: false, now });
    expect(patch.deleted_at).toBe("2026-07-17T12:00:00.000Z");
    expect(patch.purge_after).toBeNull();
    expect(patch.publish_preview).toBe(false);
    expect(patch.allow_remix).toBe(false);
  });
});

describe("trashProject", () => {
  it("updates the project with the trash patch and does not delete the row", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    const del = vi.fn();
    const from = vi.fn(() => ({ update, delete: del }));
    const db = { from } as never;

    const now = new Date("2026-07-17T12:00:00.000Z");
    await trashProject(db, "proj-1", { autoPurge: true, now });

    expect(from).toHaveBeenCalledWith("projects");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: "2026-07-17T12:00:00.000Z",
        purge_after: "2026-08-16T12:00:00.000Z",
        publish_preview: false,
        allow_remix: false,
      })
    );
    expect(eq).toHaveBeenCalledWith("id", "proj-1");
    expect(del).not.toHaveBeenCalled();
  });
});

describe("listProjectsSummary trash filters", () => {
  function mockListQuery(rows: unknown[] = []) {
    const calls: { method: string; args: unknown[] }[] = [];
    const api: Record<string, unknown> = {};
    const chain = (method: string) =>
      (...args: unknown[]) => {
        calls.push({ method, args });
        return api;
      };
    api.select = chain("select");
    api.order = chain("order");
    api.eq = chain("eq");
    api.is = chain("is");
    api.not = chain("not");
    api.in = chain("in");
    api.or = chain("or");
    api.range = chain("range");
    Object.defineProperty(api, "then", {
      value: (resolve: (v: unknown) => unknown) =>
        resolve({ data: rows, error: null }),
    });
    const from = vi.fn(() => api);
    return { db: { from } as never, calls, from };
  }

  it("excludes trashed projects from owner Workspace lists by default", async () => {
    const { db, calls } = mockListQuery([]);
    await listProjectsSummary(db, { userId: "u1" });
    expect(calls.some((c) => c.method === "is" && c.args[0] === "deleted_at" && c.args[1] === null)).toBe(
      true
    );
  });

  it("excludes trashed projects from Community lists", async () => {
    const { db, calls } = mockListQuery([]);
    await listProjectsSummary(db, { communityListed: true });
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "publish_preview")).toBe(true);
    expect(calls.some((c) => c.method === "is" && c.args[0] === "deleted_at" && c.args[1] === null)).toBe(
      true
    );
  });

  it("lists only trashed projects when trashedOnly is set", async () => {
    const { db, calls } = mockListQuery([]);
    await listProjectsSummary(db, { userId: "u1", trashedOnly: true });
    expect(
      calls.some((c) => c.method === "not" && c.args[0] === "deleted_at" && c.args[1] === "is" && c.args[2] === null)
    ).toBe(true);
    expect(calls.some((c) => c.method === "is" && c.args[0] === "folder_id")).toBe(false);
  });
});

describe("restoreProject", () => {
  it("clears trash fields and does not set Publish Preview", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    const db = { from } as never;

    await restoreProject(db, "proj-1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        deleted_at: null,
        purge_after: null,
      })
    );
    const patch = update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(patch).not.toHaveProperty("publish_preview", true);
    expect(patch).not.toHaveProperty("allow_remix", true);
    expect(eq).toHaveBeenCalledWith("id", "proj-1");
  });
});

describe("listDueTrashProjectIds", () => {
  it("selects trashed rows with purge_after <= now", async () => {
    const calls: { method: string; args: unknown[] }[] = [];
    const api: Record<string, unknown> = {};
    const chain = (method: string) =>
      (...args: unknown[]) => {
        calls.push({ method, args });
        return api;
      };
    api.select = chain("select");
    api.not = chain("not");
    api.lte = chain("lte");
    api.order = chain("order");
    api.limit = vi.fn().mockResolvedValue({
      data: [{ id: "due-1" }, { id: "due-2" }],
      error: null,
    });
    const from = vi.fn(() => api);
    const db = { from } as never;
    const now = new Date("2026-08-16T12:00:00.000Z");

    const ids = await listDueTrashProjectIds(db, { now, limit: 50 });
    expect(ids).toEqual(["due-1", "due-2"]);
    expect(calls.some((c) => c.method === "not" && c.args[0] === "deleted_at")).toBe(true);
    expect(calls.some((c) => c.method === "not" && c.args[0] === "purge_after")).toBe(true);
    expect(
      calls.some(
        (c) =>
          c.method === "lte" &&
          c.args[0] === "purge_after" &&
          c.args[1] === "2026-08-16T12:00:00.000Z"
      )
    ).toBe(true);
  });
});
