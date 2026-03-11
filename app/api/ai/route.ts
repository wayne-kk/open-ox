/**
 * AI API - POST /api/ai
 *
 * 默认 Agent 模式（Tool-calling）: LLM 自主选择并调用 skills
 *
 * Body: {
 *   input: string,
 *   mode?: "agent" | "code_agent" | "skill" | "flow",
 *   skill?: string,   // skill 模式
 *   flow?: string,    // flow 模式
 *   memory?: string,
 * }
 */

import { processInput } from "@/ai";
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
