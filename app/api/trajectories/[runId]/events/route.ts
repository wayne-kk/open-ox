import { NextResponse } from "next/server";
import { appendTrajectoryEvent, listTrajectoryRunEvents } from "@/lib/trajectory/store";
import { validateTrajectoryEvent } from "@/lib/trajectory/schema";

type Params = { params: Promise<{ runId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { runId } = await params;
    const events = await listTrajectoryRunEvents(runId);
    return NextResponse.json({
      run_id: runId,
      count: events.length,
      events,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = /ENOENT|not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { runId } = await params;
    const body = await req.json();

    // Validate full shape first, then ignore server-owned fields.
    // This keeps client payload aligned with the canonical schema.
    const parsed = validateTrajectoryEvent({
      ...body,
      run_id: runId,
      schema_version: body.schema_version ?? "tbx.0.1",
      seq: 1,
      event_id: "evt_tmp",
      ts: new Date().toISOString(),
    });

    const event = await appendTrajectoryEvent(runId, {
      task_id: parsed.task_id,
      phase: parsed.phase,
      event_type: parsed.event_type,
      actor: parsed.actor,
      payload: parsed.payload,
      meta: parsed.meta ?? {},
    });

    return NextResponse.json({ event });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = /invalid|missing|must|mismatch/i.test(message) ? 400 : /ENOENT|not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
