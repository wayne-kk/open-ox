import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 20));
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
    const domain = searchParams.get("domain");

    let query = supabase
      .from("task_specs")
      .select("task_id,domain,goal,difficulty,created_at,updated_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (domain) query = query.eq("domain", domain);

    const result = await query;
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ tasks: result.data ?? [], count: (result.data ?? []).length, limit, offset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
    }
    const taskId = typeof body.task_id === "string" ? body.task_id.trim() : "";
    const domain = typeof body.domain === "string" ? body.domain.trim() : "";
    const goal = typeof body.goal === "string" ? body.goal.trim() : "";
    if (!taskId || !domain || !goal) {
      return NextResponse.json({ error: "task_id, domain, goal are required" }, { status: 400 });
    }

    const setup = isRecord(body.setup) ? body.setup : {};
    const tests = Array.isArray(body.tests) ? body.tests : [];
    const successCriteria = Array.isArray(body.success_criteria) ? body.success_criteria : [];
    const constraints = isRecord(body.constraints) ? body.constraints : null;
    const difficulty = typeof body.difficulty === "string" ? body.difficulty : null;

    const result = await supabase
      .from("task_specs")
      .upsert(
        {
          task_id: taskId,
          domain,
          goal,
          setup,
          tests,
          success_criteria: successCriteria,
          constraints,
          difficulty,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "task_id" }
      )
      .select("*")
      .single();

    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ task: result.data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = /required|invalid|must/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

