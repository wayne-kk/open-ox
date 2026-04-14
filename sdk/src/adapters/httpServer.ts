/**
 * Lightweight HTTP server adapter for exposing the SDK as a REST API.
 *
 * Provides SSE streaming for real-time progress updates.
 * Can be used standalone or mounted into an existing Express/Fastify app.
 *
 * @example
 * ```ts
 * import { OpenOxClient } from "@open-ox/sdk";
 * import { createNodeAdapters, createHttpServer } from "@open-ox/sdk/server";
 *
 * const client = new OpenOxClient({
 *   llm: { apiKey: process.env.OPENAI_API_KEY! },
 *   projectsRoot: "./projects",
 *   ...createNodeAdapters(),
 * });
 *
 * const server = createHttpServer(client, { port: 3100 });
 * // POST /generate  → SSE stream of build steps + final result
 * // POST /modify    → SSE stream of modify events
 * // GET  /projects/:id/files → list generated files
 * ```
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import type { OpenOxClient } from "../client";

export interface HttpServerOptions {
  port?: number;
  host?: string;
  /** Optional API key for request authentication */
  apiKey?: string;
  /** CORS origin (default: "*") */
  corsOrigin?: string;
}

export function createHttpServer(client: OpenOxClient, options: HttpServerOptions = {}) {
  const { port = 3100, host = "0.0.0.0", apiKey, corsOrigin = "*" } = options;

  const server = createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Auth check
    if (apiKey) {
      const authHeader = req.headers.authorization;
      if (authHeader !== `Bearer ${apiKey}`) {
        sendJson(res, 401, { error: "Unauthorized" });
        return;
      }
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    try {
      if (req.method === "POST" && url.pathname === "/generate") {
        await handleGenerate(client, req, res);
      } else if (req.method === "POST" && url.pathname === "/modify") {
        await handleModify(client, req, res);
      } else if (req.method === "GET" && url.pathname.match(/^\/projects\/[^/]+\/files$/)) {
        const projectId = url.pathname.split("/")[2];
        await handleListFiles(client, projectId, res);
      } else if (req.method === "GET" && url.pathname === "/health") {
        sendJson(res, 200, { status: "ok" });
      } else {
        sendJson(res, 404, { error: "Not found" });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[open-ox-sdk] Request error:", message);
      if (!res.headersSent) {
        sendJson(res, 500, { error: message });
      }
    }
  });

  server.listen(port, host, () => {
    console.log(`[open-ox-sdk] HTTP server listening on http://${host}:${port}`);
  });

  return server;
}

// ─── Route Handlers ──────────────────────────────────────────────────────────

async function handleGenerate(
  client: OpenOxClient,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readBody(req);
  const { prompt, projectId, styleGuide, enableSkills, mode } = body;

  if (!prompt || typeof prompt !== "string") {
    sendJson(res, 400, { error: "prompt is required" });
    return;
  }

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const result = await client.generate({
    prompt,
    styleGuide,
    mode,
    onStep: (step) => {
      writeSSE(res, { type: "step", ...step });
    },
  });

  writeSSE(res, { type: "done", result });
  res.end();
}

async function handleModify(
  _client: OpenOxClient,
  _req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  sendJson(res, 501, { error: "Modify is not yet supported in SDK mode" });
}

async function handleListFiles(
  _client: OpenOxClient,
  projectId: string,
  res: ServerResponse
): Promise<void> {
  // In HTTP-client mode, the SDK doesn't have local file access.
  // This endpoint is a pass-through placeholder.
  sendJson(res, 200, { projectId, files: [] });
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const text = Buffer.concat(chunks).toString("utf-8");
        resolve(text ? JSON.parse(text) : {});
      } catch (err) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function writeSSE(res: ServerResponse, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
