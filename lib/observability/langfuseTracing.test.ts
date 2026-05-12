import { beforeEach, describe, expect, it, vi } from "vitest";

describe("langfuseTracing", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_PUBLIC_KEY;
  });

  it("returns null client when keys are missing", async () => {
    const { getLangfuse } = await import("./langfuseTracing");
    expect(getLangfuse()).toBeNull();
  });

  it("creates client once keys are set without restarting the module", async () => {
    vi.resetModules();
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_PUBLIC_KEY;
    const { getLangfuse } = await import("./langfuseTracing");
    expect(getLangfuse()).toBeNull();
    process.env.LANGFUSE_SECRET_KEY = "sk-test";
    process.env.LANGFUSE_PUBLIC_KEY = "pk-test";
    expect(getLangfuse()).not.toBeNull();
  });

  it("resolveLangfuseSessionId uses client id when set otherwise projectId", async () => {
    const { resolveLangfuseSessionId } = await import("./langfuseTracing");
    expect(
      resolveLangfuseSessionId({
        projectId: "p1",
        clientSessionId: "  my-session  ",
        trajectoryRunId: "traj-9",
      })
    ).toBe("my-session");
    expect(
      resolveLangfuseSessionId({
        projectId: "p1",
        trajectoryRunId: "run-abc",
      })
    ).toBe("p1");
    expect(resolveLangfuseSessionId({ projectId: "p1" })).toBe("p1");
  });
});
