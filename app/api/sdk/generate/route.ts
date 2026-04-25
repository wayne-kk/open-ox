/**
 * POST /api/sdk/generate
 *
 * 公开 API 端点，供 @open-ox/sdk 远程调用。
 * 通过 Bearer token (OPEN_OX_API_KEY) 鉴权，不依赖 session。
 *
 * 请求体:
 *   { prompt: string, styleGuide?: string, model?: string }
 *
 * 返回 SSE 流:
 *   data: {"type":"step", ...BuildStep}
 *   data: {"type":"done", "result": GenerateProjectResult}
 *   data: {"type":"error", "message": string}
 */

import { runGenerateProject } from "@/ai/flows";
import { initProjectDir } from "@/lib/projectManager";
import { setRuntimeModelId, type ModelId } from "@/lib/config/models";
import type { BuildStep } from "@/ai/flows";
import { redactBuildStepForTransport } from "@/ai/flows/generate_project/shared/buildStepPayload";
import { SSE_RESPONSE_HEADERS } from "@/lib/sse-headers";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";
import { scheduleUploadFullProject } from "@/lib/storage";

function validateApiKey(req: Request): boolean {
  const expected = process.env.OPEN_OX_API_KEY;
  if (!expected) return false;
  const auth = req.headers.get("authorization");
  if (!auth) return false;
  const token = auth.replace(/^Bearer\s+/i, "");
  return token === expected;
}

export async function POST(req: Request) {
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const prompt: string | undefined = body.prompt;
  const styleGuide: string | undefined = body.styleGuide;
  const model: string | undefined = body.model;

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  if (model) {
    setRuntimeModelId(model as ModelId);
  }

  const projectId = `sdk_${randomUUID().slice(0, 8)}`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        const db = createSupabaseServiceRoleClient();
        await initProjectDir(db, projectId);

        const result = await runGenerateProject(
          prompt,
          (step: BuildStep) => {
            send({ type: "step", ...redactBuildStepForTransport(step) });
          },
          { projectId, styleGuide }
        );

        if (result.success) {
          scheduleUploadFullProject(projectId);
        }

        send({
          type: "done",
          result: {
            success: result.success,
            projectId,
            verificationStatus: result.verificationStatus,
            generatedFiles: result.generatedFiles,
            blueprint: result.blueprint,
            installedDependencies: result.installedDependencies,
            dependencyInstallFailures: result.dependencyInstallFailures,
            steps: result.steps.map(redactBuildStepForTransport),
            totalDuration: result.totalDuration,
            error: result.error,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error";
        send({ type: "error", message });
      } finally {
        setRuntimeModelId(null);
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_RESPONSE_HEADERS });
}
