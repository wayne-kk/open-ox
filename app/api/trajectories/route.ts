import { NextResponse } from "next/server";
import { createTrajectoryRun } from "@/lib/trajectory/store";
import { validateRunStartInput } from "@/lib/trajectory/schema";

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
