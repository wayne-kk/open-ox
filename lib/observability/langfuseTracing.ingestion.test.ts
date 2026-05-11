import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Verifies the Langfuse client queues work and flush triggers POST to `/api/public/ingestion`.
 * Does not use real API keys.
 */
describe("Langfuse ingestion pipeline", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_BASEURL;
    delete process.env.LANGFUSE_BASE_URL;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  it("POSTs to ingestion URL after trace + flushAsync", async () => {
    process.env.LANGFUSE_SECRET_KEY = "sk-lf-test";
    process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-test";
    process.env.LANGFUSE_BASE_URL = "https://us.cloud.langfuse.com";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ successes: [], errors: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { runWithLangfuseTraceRoot, flushLangfuse } = await import("./langfuseTracing");

    await runWithLangfuseTraceRoot(
      { name: "vitest_smoke", sessionId: "sess-1", input: { probe: true } },
      async () => {
        /* no LLM — trace row only */
      }
    );
    await flushLangfuse();

    expect(fetchMock).toHaveBeenCalled();
    const urls = fetchMock.mock.calls.map((c) => String(c[0] ?? ""));
    const ingestionHit = urls.some((u) => u.includes("/api/public/ingestion"));
    expect(ingestionHit).toBe(true);
    const usHost = urls.some((u) => u.startsWith("https://us.cloud.langfuse.com"));
    expect(usHost).toBe(true);
  });
});
