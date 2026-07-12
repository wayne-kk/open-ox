import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("langfuseTracing", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_BASE_URL;
    delete process.env.LANGFUSE_BASEURL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
      })
    ).toBe("my-session");
    expect(resolveLangfuseSessionId({ projectId: "p1" })).toBe("p1");
  });

  it("continues the same trace id across separate ALS roots", async () => {
    process.env.LANGFUSE_SECRET_KEY = "sk-test";
    process.env.LANGFUSE_PUBLIC_KEY = "pk-test";
    process.env.LANGFUSE_BASE_URL = "https://cloud.langfuse.com";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ successes: [], errors: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const {
      runWithLangfuseTraceRoot,
      getLangfuseTraceId,
      updateLangfuseActiveTrace,
      flushLangfuse,
    } = await import("./langfuseTracing");

    const fixedId = "11111111-1111-4111-8111-111111111111";
    await runWithLangfuseTraceRoot(
      { name: "ox.trace.intent_agent", id: fixedId, sessionId: "proj-1" },
      async () => {
        expect(getLangfuseTraceId()).toBe(fixedId);
        updateLangfuseActiveTrace({
          name: "ox.trace.project_build",
          metadata: { status: "generation_queued" },
        });
      }
    );
    await flushLangfuse();

    await runWithLangfuseTraceRoot(
      {
        name: "ox.trace.project_build",
        id: fixedId,
        sessionId: "proj-1",
        metadata: { status: "generating" },
      },
      async () => {
        expect(getLangfuseTraceId()).toBe(fixedId);
        updateLangfuseActiveTrace({
          metadata: { status: "succeeded" },
          output: { success: true },
        });
      }
    );
    await flushLangfuse();

    const bodies = fetchMock.mock.calls
      .map((c) => c[1] as { body?: string } | undefined)
      .filter((init) => typeof init?.body === "string")
      .map((init) => String(init!.body));
    const joined = bodies.join("\n");
    expect(joined).toContain(fixedId);
    expect(joined).toContain("ox.trace.project_build");
  });
});
