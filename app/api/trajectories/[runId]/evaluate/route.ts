import { NextResponse } from "next/server";
import { appendTrajectoryEvent, createEvaluatorRun, getTrajectoryRun, listTrajectoryRunEvents } from "@/lib/trajectory/store";

type Params = { params: Promise<{ runId: string }> };

function scoreRun(events: Array<{ seq?: number; event_type: string; payload: Record<string, unknown> }>) {
  const hasError = events.some((e) => e.event_type === "error");
  const runEnd = [...events].reverse().find((e) => e.event_type === "run_end");
  const passedByPayload =
    runEnd?.payload?.verificationStatus === "passed" ||
    runEnd?.payload?.success === true;

  const toolCalls = events.filter((e) => e.event_type === "tool_call").length;
  const checkpoints = events.filter((e) => e.event_type === "checkpoint").length;
  const tests = events.filter((e) => e.event_type === "test_result").length;

  const coverageScore = Math.min(1, (checkpoints + tests) / 5);
  const stabilityScore = hasError ? 0.4 : 1;
  const completionScore = passedByPayload ? 1 : runEnd ? 0.7 : 0.2;
  const automationScore = Math.min(1, toolCalls / 10);
  const total = Number(
    (coverageScore * 0.25 + stabilityScore * 0.3 + completionScore * 0.3 + automationScore * 0.15).toFixed(3)
  );

  const verdict: "passed" | "failed" | "partial" = total >= 0.8 ? "passed" : total >= 0.45 ? "partial" : "failed";
  const failureType = verdict === "failed" ? (hasError ? "runtime_error" : "insufficient_coverage") : null;
  const summary = `coverage=${coverageScore.toFixed(2)}, stability=${stabilityScore.toFixed(2)}, completion=${completionScore.toFixed(2)}, automation=${automationScore.toFixed(2)}, total=${total.toFixed(2)}`;
  const evidenceRefs = events
    .map((event, idx) => ({ event, idx: event.seq ?? idx + 1 }))
    .filter(({ event }) =>
      event.event_type === "run_end" ||
      event.event_type === "error" ||
      event.event_type === "test_result" ||
      event.event_type === "shell_result"
    )
    .slice(-10)
    .map(({ idx, event }) => ({
      seq: idx,
      event_type: event.event_type,
    }));

  return {
    verdict,
    failureType,
    summary,
    score: {
      total,
      coverage: coverageScore,
      stability: stabilityScore,
      completion: completionScore,
      automation: automationScore,
      counters: { events: events.length, tool_calls: toolCalls, checkpoints, tests },
      evidence_refs: evidenceRefs,
    },
  };
}

export async function POST(_req: Request, { params }: Params) {
  try {
    const { runId } = await params;
    const run = await getTrajectoryRun(runId);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    const events = await listTrajectoryRunEvents(runId);
    const scored = scoreRun(events);
    const evaluator = await createEvaluatorRun({
      runId,
      verdict: scored.verdict,
      score: scored.score,
      failureType: scored.failureType,
      summary: scored.summary,
    });

    // Best effort: append evaluation event if run is still open.
    if (run.status === "running") {
      await appendTrajectoryEvent(runId, {
        task_id: run.task_id,
        phase: "verification",
        event_type: "test_result",
        actor: "evaluator",
        payload: {
          evaluator_run_id: evaluator.id,
          verdict: evaluator.verdict,
          score: evaluator.score,
          summary: evaluator.summary,
        },
        meta: { source: "mvp_evaluator" },
      }).catch(() => null);
    }

    return NextResponse.json({ run_id: runId, evaluator });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

