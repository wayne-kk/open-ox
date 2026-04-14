/**
 * Unit tests for the HTTP server adapter
 *
 * Tests the HTTP API layer using a real HTTP server on a random port.
 */

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { createServer, type Server } from "http";
import type { OpenOxClient } from "../client";

// We test the HTTP handler logic by creating a minimal mock client
// and verifying the server routes respond correctly.

function createMockClient(): OpenOxClient {
  return {
    generateProject: async (options: any) => {
      // Simulate calling onStep
      options.onStep?.({
        step: "test_step",
        status: "ok",
        detail: "mock step",
        timestamp: Date.now(),
        duration: 100,
      });
      return {
        success: true,
        verificationStatus: "passed",
        generatedFiles: ["page.tsx"],
        unvalidatedFiles: [],
        installedDependencies: [],
        dependencyInstallFailures: [],
        steps: [],
        totalDuration: 1000,
      };
    },
    modifyProject: async (options: any) => {
      options.onEvent?.({ type: "step", name: "test", status: "done" });
    },
    getProjectPath: (id: string) => `/projects/${id}`,
    listProjectFiles: async (id: string) => {
      if (id === "existing") return ["page.tsx", "layout.tsx"];
      return [];
    },
    readProjectFile: async () => "content",
  } as unknown as OpenOxClient;
}

let server: Server;
let port: number;

beforeAll(async () => {
  // Import and create server
  const { createHttpServer } = await import("../adapters/httpServer");
  const client = createMockClient();

  // Use port 0 to get a random available port
  await new Promise<void>((resolve) => {
    server = createHttpServer(client, { port: 0 });
    server.on("listening", () => {
      const addr = server.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterAll(() => {
  server?.close();
});

describe("HTTP Server", () => {
  it("GET /health returns ok", async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("GET /unknown returns 404", async () => {
    const res = await fetch(`http://localhost:${port}/unknown`);
    expect(res.status).toBe(404);
  });

  it("POST /generate returns SSE stream", async () => {
    const res = await fetch(`http://localhost:${port}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "test project" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");

    const text = await res.text();
    const events = text
      .split("\n\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)));

    // Should have at least a step event and a done event
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.some((e) => e.type === "step")).toBe(true);
    expect(events.some((e) => e.type === "done")).toBe(true);

    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent.result.success).toBe(true);
  });

  it("POST /generate rejects missing prompt", async () => {
    const res = await fetch(`http://localhost:${port}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("GET /projects/:id/files returns file list", async () => {
    const res = await fetch(`http://localhost:${port}/projects/existing/files`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.projectId).toBe("existing");
    expect(body.files).toEqual(["page.tsx", "layout.tsx"]);
  });

  it("OPTIONS returns CORS headers", async () => {
    const res = await fetch(`http://localhost:${port}/generate`, {
      method: "OPTIONS",
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});
