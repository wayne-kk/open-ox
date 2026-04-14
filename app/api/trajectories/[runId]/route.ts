import { NextResponse } from "next/server";
import { getLatestEvaluatorRun, getTrajectoryRun, listTrajectoryRunEvents } from "@/lib/trajectory/store";

type Params = { params: Promise<{ runId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { runId } = await params;
    const run = await getTrajectoryRun(runId);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    const [events, evaluator] = await Promise.all([
      listTrajectoryRunEvents(runId),
      getLatestEvaluatorRun(runId),
    ]);
    return NextResponse.json({
      run,
      evaluator,
      events,
      count: events.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

