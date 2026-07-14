import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getFeishuActiveProject, setFeishuActiveProject } from "./activeProject";

vi.mock("@/lib/projectManager", () => ({
  getProject: vi.fn(async (_db: unknown, id: string) => {
    const g = (globalThis as { __feishuTestProject?: { id: string; name: string; ownerUserId: string } | null })
      .__feishuTestProject;
    if (!g || g.id !== id) return null;
    return g;
  }),
}));

function mockDb(opts: {
  settingsRow?: { user_id?: string; active_project_id: string | null } | null;
}) {
  const maybeSingle = vi.fn(async () => ({
    data:
      opts.settingsRow === undefined
        ? null
        : opts.settingsRow === null
          ? null
          : { user_id: opts.settingsRow.user_id ?? "u1", active_project_id: opts.settingsRow.active_project_id },
    error: null,
  }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const update = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }));
  const insert = vi.fn(async () => ({ error: null }));

  const from = vi.fn((table: string) => {
    if (table === "user_feishu_settings") {
      return { select, update, insert };
    }
    return {};
  });

  return { db: { from } as unknown as SupabaseClient, update, insert, select };
}

describe("feishu activeProject", () => {
  it("returns null when no settings row", async () => {
    const { db } = mockDb({ settingsRow: null });
    await expect(getFeishuActiveProject(db, "u1")).resolves.toEqual({
      projectId: null,
      projectName: null,
    });
  });

  it("returns project when pointer is valid and owned", async () => {
    (globalThis as { __feishuTestProject?: unknown }).__feishuTestProject = {
      id: "p1",
      name: "Acme",
      ownerUserId: "u1",
    };
    const { db } = mockDb({ settingsRow: { active_project_id: "p1" } });
    await expect(getFeishuActiveProject(db, "u1")).resolves.toEqual({
      projectId: "p1",
      projectName: "Acme",
    });
  });

  it("treats foreign-owned pointer as unset", async () => {
    (globalThis as { __feishuTestProject?: unknown }).__feishuTestProject = {
      id: "p1",
      name: "Acme",
      ownerUserId: "other",
    };
    const { db } = mockDb({ settingsRow: { active_project_id: "p1" } });
    await expect(getFeishuActiveProject(db, "u1")).resolves.toEqual({
      projectId: null,
      projectName: null,
    });
  });

  it("set rejects non-owner without writing", async () => {
    (globalThis as { __feishuTestProject?: unknown }).__feishuTestProject = {
      id: "p1",
      name: "Acme",
      ownerUserId: "other",
    };
    const { db, update, insert } = mockDb({ settingsRow: null });
    const result = await setFeishuActiveProject(db, "u1", "p1");
    expect(result).toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "Not project owner",
    });
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("set updates existing row; clear writes null via update", async () => {
    (globalThis as { __feishuTestProject?: unknown }).__feishuTestProject = {
      id: "p1",
      name: "Acme",
      ownerUserId: "u1",
    };
    const { db, update, insert } = mockDb({
      settingsRow: { user_id: "u1", active_project_id: null },
    });
    await expect(setFeishuActiveProject(db, "u1", "p1")).resolves.toEqual({
      ok: true,
      projectId: "p1",
      projectName: "Acme",
    });
    expect(update).toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();

    await expect(setFeishuActiveProject(db, "u1", null)).resolves.toEqual({
      ok: true,
      projectId: null,
      projectName: null,
    });
  });

  it("set inserts when no settings row yet", async () => {
    (globalThis as { __feishuTestProject?: unknown }).__feishuTestProject = {
      id: "p1",
      name: "Acme",
      ownerUserId: "u1",
    };
    const { db, insert } = mockDb({ settingsRow: null });
    await expect(setFeishuActiveProject(db, "u1", "p1")).resolves.toMatchObject({
      ok: true,
      projectId: "p1",
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", active_project_id: "p1" })
    );
  });

  it("set returns PROJECT_NOT_FOUND when missing", async () => {
    (globalThis as { __feishuTestProject?: unknown }).__feishuTestProject = null;
    const { db } = mockDb({ settingsRow: null });
    await expect(setFeishuActiveProject(db, "u1", "missing")).resolves.toEqual({
      ok: false,
      code: "PROJECT_NOT_FOUND",
      message: "Project not found",
    });
  });
});
