import { NextResponse } from "next/server";
import { createTrajectoryRun, getLatestEvaluatorRun, listTrajectoryRuns } from "@/lib/trajectory/store";
import { validateRunStartInput } from "@/lib/trajectory/schema";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 20));
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
    const rows = await listTrajectoryRuns(limit, offset);
    const enriched = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        evaluator: await getLatestEvaluatorRun(row.run_id),
      }))
    );
    return NextResponse.json({ runs: enriched, count: enriched.length, limit, offset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = validateRunStartInput(body);
    const { runId, firstEvent } = await createTrajectoryRun(input);
    return NextResponse.json({
      run_id: runId,
      first_event: firstEvent,
      status: "running",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = /invalid|missing|must/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
