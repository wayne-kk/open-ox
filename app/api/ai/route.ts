/**
 * AI API - POST /api/ai
 *
 * build_site 模式返回 text/event-stream (SSE)，每个 step 完成立即推送：
 *   data: {"type":"step", ...BuildStep}\n\n
 *   data: {"type":"done", "result": ProcessResult}\n\n
 *   data: {"type":"error", "message": string}\n\n
 *
 * 其他模式返回普通 JSON。
 */

import { processInput } from "@/ai";
import type { BuildStep } from "@/ai/flows/build_landing_page";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { input, mode, skill, flow, memory } = body;

    if (!input || typeof input !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'input' field" },
        { status: 400 }
      );
    }

    // ── SSE streaming for build_site ──────────────────────────────────────
    if (mode === "build_site") {
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          const send = (obj: Record<string, unknown>) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)
            );
          };

          try {
            const result = await processInput(input, {
              mode: "build_site",
              onStep: (step: BuildStep) => send({ type: "step", ...step }),
            });
            send({ type: "done", result });
          } catch (err) {
            send({
              type: "error",
              message: err instanceof Error ? err.message : "Internal error",
            });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // ── Regular JSON for other modes ─────────────────────────────────────
    const result = await processInput(input, {
      mode: mode ?? undefined,
      skill: skill ?? undefined,
      flow: flow ?? undefined,
      memory: memory ?? undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[AI API]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
