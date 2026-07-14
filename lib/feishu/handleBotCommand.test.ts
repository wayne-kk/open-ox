import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { handleFeishuBotText } from "./handleBotCommand";
import { __resetContinuationSuppressForTests } from "./continuationSuppress";

vi.mock("./activeProject", () => ({
  getFeishuActiveProject: vi.fn(async () => ({ projectId: null, projectName: null })),
  setFeishuActiveProject: vi.fn(async () => ({
    ok: true,
    projectId: "p1",
    projectName: "Acme",
  })),
}));

vi.mock("@/lib/projectManager", () => ({
  listProjectsSummary: vi.fn(async () => [
    { id: "p1", name: "Acme" },
    { id: "p2", name: "Beta" },
  ]),
}));

import { getFeishuActiveProject, setFeishuActiveProject } from "./activeProject";

const db = {} as SupabaseClient;

describe("handleFeishuBotText", () => {
  beforeEach(() => {
    __resetContinuationSuppressForTests();
    vi.clearAllMocks();
    vi.mocked(getFeishuActiveProject).mockResolvedValue({
      projectId: null,
      projectName: null,
    });
  });

  it("returns help without modify", async () => {
    const r = await handleFeishuBotText({ db, userId: "u1", text: "/help" });
    expect(r.skipModify).toBe(true);
    expect(r.text).toContain("/status");
  });

  it("status when unset points to Studio", async () => {
    const r = await handleFeishuBotText({ db, userId: "u1", text: "/status" });
    expect(r.skipModify).toBe(true);
    expect(r.text).toContain("未绑定");
    expect(r.text).toContain("Studio");
  });

  it("status shows active project", async () => {
    vi.mocked(getFeishuActiveProject).mockResolvedValue({
      projectId: "p1",
      projectName: "Acme",
    });
    const r = await handleFeishuBotText({ db, userId: "u1", text: "/status" });
    expect(r.text).toContain("Acme");
    expect(r.text).toContain("p1");
  });

  it("/use switches owned project", async () => {
    const r = await handleFeishuBotText({ db, userId: "u1", text: "/use Acme" });
    expect(r.skipModify).toBe(true);
    expect(setFeishuActiveProject).toHaveBeenCalledWith(db, "u1", "p1");
    expect(r.text).toContain("已换绑");
  });

  it("/use 1 switches by index", async () => {
    const r = await handleFeishuBotText({ db, userId: "u1", text: "/use 2" });
    expect(setFeishuActiveProject).toHaveBeenCalledWith(db, "u1", "p2");
    expect(r.text).toContain("已换绑");
  });

  it("/projects lists projects", async () => {
    const r = await handleFeishuBotText({ db, userId: "u1", text: "/projects" });
    expect(r.skipModify).toBe(true);
    expect(r.text).toContain("Acme");
    expect(r.text).toContain("/use 1");
  });

  it("plain text without modifyEnabled does not start modify", async () => {
    const r = await handleFeishuBotText({
      db,
      userId: "u1",
      text: "改 Hero",
      modifyEnabled: false,
    });
    expect(r.skipModify).toBe(true);
    expect(r.text).toContain("Modify 未启用");
  });

  it("plain text with modifyEnabled returns skipModify false", async () => {
    const r = await handleFeishuBotText({
      db,
      userId: "u1",
      text: "改 Hero",
      modifyEnabled: true,
    });
    expect(r).toEqual({ text: "改 Hero", skipModify: false });
  });
});
