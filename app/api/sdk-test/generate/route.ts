/**
 * POST /api/sdk-test/generate
 *
 * Tests the SDK interface by using the project's own generation engine
 * through the SDK's type contracts. This validates that the SDK's
 * interface design works correctly with the real engine.
 */

import { runGenerateProject } from "@/ai/flows";
import type { GenerateProjectOptions, BuildStep } from "@open-ox/sdk";
import { SSE_RESPONSE_HEADERS } from "@/lib/sse-headers";
import { setSiteRoot, clearSiteRoot } from "@/ai/tools/system/common";
import { join } from "path";
import { mkdirSync } from "fs";

export async function POST(req: Request) {
  const { prompt } = await req.json();

  if (!prompt) {
    return new Response(JSON.stringify({ error: "prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const projectId = `sdk_test_${Date.now()}`;
      const projectPath = join(process.cwd(), "sites", projectId);
      mkdirSync(projectPath, { recursive: true });
      setSiteRoot(projectPath);

      try {
        // Use SDK types to validate the interface contract
        const options: GenerateProjectOptions = {
          prompt,
          projectId,
          mode: "web",
          onStep: (step: BuildStep) => {
            const data = JSON.stringify({ type: "step", ...step });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          },
        };

        // Call the real engine directly (same as SDK would internally)
        const result = await runGenerateProject(
          options.prompt,
          options.onStep,
          { projectId: options.projectId }
        );

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: "done",
            result: {
              success: result.success,
              verificationStatus: result.verificationStatus,
              generatedFiles: result.generatedFiles,
              totalDuration: result.totalDuration,
              error: result.error,
            },
          })}\n\n`)
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`)
        );
      } finally {
        clearSiteRoot();
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_RESPONSE_HEADERS });
}
