import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getLatestEvaluatorRun, getTrajectoryRun, listTrajectoryRunEvents, listTrajectoryRuns } from "@/lib/trajectory/store";
import { supabase } from "@/lib/supabase";
import { computeFieldCoverage, detectCanary, redactValue } from "@/lib/trajectory/governance";

const CORE_EVENT_TYPES = new Set([
  "run_start",
  "error",
  "checkpoint",
  "shell_command",
  "shell_result",
  "run_end",
]);

function toJsonl(lines: unknown[]): string {
  return lines.map((line) => JSON.stringify(line)).join("\n");
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId");
    const limit = Math.max(1, Math.min(200, Number(searchParams.get("limit")) || 50));
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
    const download = searchParams.get("download") === "1";
    const format = (searchParams.get("format") || "full").trim().toLowerCase();
    const includeAllEvents = searchParams.get("include_all_events") === "1";
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const fromTs = from ? Date.parse(from) : NaN;
    const toTs = to ? Date.parse(to) : NaN;
    if (from && !Number.isFinite(fromTs)) {
      return NextResponse.json({ error: "Invalid 'from' timestamp" }, { status: 400 });
    }
    if (to && !Number.isFinite(toTs)) {
      return NextResponse.json({ error: "Invalid 'to' timestamp" }, { status: 400 });
    }
    if (Number.isFinite(fromTs) && Number.isFinite(toTs) && fromTs > toTs) {
      return NextResponse.json({ error: "'from' cannot be later than 'to'" }, { status: 400 });
    }

    const selectedRunsBase = runId
      ? [await getTrajectoryRun(runId)].filter((run): run is NonNullable<typeof run> => run !== null)
      : await listTrajectoryRuns(limit, offset);
    const selectedRuns = selectedRunsBase.filter((run) => {
      const t = Date.parse(run.created_at);
      if (Number.isFinite(fromTs) && t < fromTs) return false;
      if (Number.isFinite(toTs) && t > toTs) return false;
      return true;
    });

    const payloadRuns = await Promise.all(
      selectedRuns.map(async (run) => {
        const [events, evaluator] = await Promise.all([
          listTrajectoryRunEvents(run.run_id),
          getLatestEvaluatorRun(run.run_id),
        ]);
        const filteredEvents = includeAllEvents
          ? events
          : events.filter((event) => CORE_EVENT_TYPES.has(event.event_type));
        return {
          run,
          evaluator,
          events: filteredEvents,
        };
      })
    );
    const redactedRecords = payloadRuns.map((record) => redactValue(record));

    const now = new Date().toISOString();
    const jsonl = toJsonl(redactedRecords);
    const hash = createHash("sha256").update(jsonl).digest("hex");
    const canaryDetected = detectCanary(jsonl);
    const fieldCoverage = computeFieldCoverage(redactedRecords.map((r) => ({ events: r.events })));
    const recordCount = redactedRecords.reduce((sum, record) => sum + record.events.length, 0);
    const manifest = {
      schema_version: "tbx.0.2",
      generated_at: now,
      range: { run_id: runId ?? null, limit, offset, from: from ?? null, to: to ?? null },
      event_filter: includeAllEvents ? "all" : "core-repair-events",
      samples: redactedRecords.length,
      record_count: recordCount,
      redaction_applied: true,
      canary_detected: canaryDetected,
      field_coverage: fieldCoverage,
      sha256: hash,
    };

    const auditInsert = await supabase
      .from("trajectory_export_audits")
      .insert({
        schema_version: manifest.schema_version,
        run_id_filter: runId,
        sample_count: manifest.samples,
        record_count: manifest.record_count,
        redaction_applied: manifest.redaction_applied,
        canary_detected: manifest.canary_detected,
        field_coverage: manifest.field_coverage,
        sha256: manifest.sha256,
        manifest,
      });
    // Best-effort auditing: export should not fail if audit insert is unavailable.
    if (auditInsert.error) {
      console.warn("[trajectory export] audit insert failed:", auditInsert.error.message);
    }

    if (format === "manifest-only" || format === "manifest") {
      return NextResponse.json({ manifest });
    }

    if (download) {
      return new Response(jsonl, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Content-Disposition": `attachment; filename="trajectories-${Date.now()}.jsonl"`,
          "X-Manifest-SHA256": hash,
        },
      });
    }

    return NextResponse.json({ manifest, records: redactedRecords, jsonl_preview: jsonl.slice(0, 4000) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

