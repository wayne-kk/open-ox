/**
 * HTTP Server example - Expose the SDK as a REST API with SSE streaming
 *
 * Endpoints:
 *   POST /generate  → SSE stream of build steps + final result
 *   POST /modify    → SSE stream of modify events
 *   GET  /projects/:id/files → list generated files
 *   GET  /health    → health check
 */

import { OpenOxClient } from "@open-ox/sdk";
import { createNodeAdapters, createHttpServer } from "@open-ox/sdk/server";

const client = new OpenOxClient({
  llm: {
    apiKey: process.env.OPENAI_API_KEY!,
    baseURL: process.env.OPENAI_API_URL,
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
  },
  projectsRoot: process.env.PROJECTS_ROOT ?? "./generated-projects",
  ...createNodeAdapters(),
});

const server = createHttpServer(client, {
  port: Number(process.env.PORT ?? 3100),
  apiKey: process.env.API_KEY, // optional auth
  corsOrigin: "*",
});

console.log("Open OX SDK HTTP server started");
console.log("Try: curl -X POST http://localhost:3100/generate -H 'Content-Type: application/json' -d '{\"prompt\": \"A landing page for a coffee shop\"}'");
