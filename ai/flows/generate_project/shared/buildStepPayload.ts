/**
 * Shrink `BuildStep` payloads for the browser, Supabase, and public SSE streams.
 *
 * Env:
 * - `BUILD_STEP_TRACE_MAX_CHARS` — max length per of systemPrompt, userMessage,
 *   rawResponse, and step.detail (default 12000). Set to `-1` to disable truncation.
 * - `BUILD_STEP_TRACE_UNLIMITED=1` — send full traces (dev only; high memory use).
 *
 * Full prompts remain in `.open-ox/logs/generate_project/...` artifacts and in the
 * in-memory `GenerateProjectResult.steps` inside a single API request until it ends.
 */
import type { BuildStep, StepLlmCall, StepTrace } from "../types";

function maxPayloadChars(): number | null {
  if (process.env.BUILD_STEP_TRACE_UNLIMITED === "1") {
    return null;
  }
  const raw = process.env.BUILD_STEP_TRACE_MAX_CHARS;
  const n = raw === undefined ? 12_000 : Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return n;
}

function truncateText(value: string, max: number, label: string): string {
  if (value.length <= max) {
    return value;
  }
  const omitted = value.length - max;
  return `${value.slice(0, max)}\n… [truncated ${omitted} chars${label ? ` — ${label}` : ""}]`;
}

function redactLlmCall(call: StepLlmCall, max: number): StepLlmCall {
  const hint = "full text in .open-ox/logs/generate_project artifacts";
  return {
    ...call,
    systemPrompt:
      call.systemPrompt !== undefined
        ? truncateText(call.systemPrompt, max, hint)
        : undefined,
    userMessage:
      call.userMessage !== undefined ? truncateText(call.userMessage, max, hint) : undefined,
    rawResponse:
      call.rawResponse !== undefined ? truncateText(call.rawResponse, max, hint) : undefined,
  };
}

function redactTrace(trace: StepTrace | undefined, max: number): StepTrace | undefined {
  if (!trace) {
    return undefined;
  }
  const next: StepTrace = { ...trace };
  if (trace.llmCall) {
    next.llmCall = redactLlmCall(trace.llmCall, max);
  }
  return next;
}

/**
 * Clone a build step for SSE / DB / API clients: drops huge strings so the browser
 * and Supabase rows do not retain multi‑MB copies of every LLM call.
 * In-memory pipeline steps and disk artifacts stay full-fidelity.
 */
export function redactBuildStepForTransport(step: BuildStep): BuildStep {
  const max = maxPayloadChars();
  if (max === null) {
    return { ...step };
  }
  const detail =
    step.detail !== undefined && step.detail.length > max
      ? truncateText(step.detail, max, "see server logs / artifacts for full output")
      : step.detail;

  return {
    ...step,
    detail,
    trace: redactTrace(step.trace, max),
  };
}
