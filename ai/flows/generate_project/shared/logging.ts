import { mkdir, writeFile } from "fs/promises";
import { sep } from "path";
import { WORKSPACE_ROOT } from "../../../tools/system/common";
import type { BuildStep, StepTrace } from "../types";

export interface StepLogger {
  resultSteps: BuildStep[];
  startStep: (step: string) => void;
  logStep: (
    step: string,
    status: "ok" | "error",
    detail?: string,
    skillId?: string | null,
    trace?: StepTrace
  ) => BuildStep;
  attachTrace: (step: string, trace: StepTrace) => void;
  timed: <T>(
    stepName: string,
    fn: () => Promise<T>,
    onOk?: (value: T) => string | undefined | { detail?: string; trace?: StepTrace }
  ) => Promise<T>;
  timedWithTrace: <T>(
    stepName: string,
    fn: (addTrace: (trace: StepTrace) => void) => Promise<T>,
    onOk?: (value: T) => string | undefined | { detail?: string; trace?: StepTrace }
  ) => Promise<T>;
}

export interface ArtifactLogger {
  runDirAbsolute: string;
  runDirRelative: string;
  writeJson: (step: string, name: string, value: unknown) => Promise<string>;
  writeText: (step: string, name: string, content: string, extension?: string) => Promise<string>;
}

const ARTIFACT_ROOT_RELATIVE = ".open-ox/logs/generate_project";

/** Runtime FS paths only — avoids Turbopack inferring project-wide globs from `path.join()`. */
function appendAbsolutePath(base: string, ...segments: string[]): string {
  let out = base;
  for (const seg of segments) {
    const trimmed = seg.replace(/^[/\\]+|[/\\]+$/g, "");
    if (!trimmed) continue;
    out = out.replace(/[/\\]+$/, "") + sep + trimmed;
  }
  return out;
}

/** Relative log paths (posix-style) for display and persistence. */
function appendRelativePath(...segments: string[]): string {
  return segments
    .map((s) => s.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "step";
}

function createRunId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}_${random}`;
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

async function writeArtifactFile(
  runDirAbsolute: string,
  runDirRelative: string,
  step: string,
  fileName: string,
  content: string
): Promise<string> {
  const stepDirName = sanitizeSegment(step);
  const targetDir = appendAbsolutePath(runDirAbsolute, stepDirName);
  await ensureDir(targetDir);
  const absolutePath = appendAbsolutePath(targetDir, fileName);
  await writeFile(absolutePath, content, "utf-8");
  return appendRelativePath(runDirRelative, stepDirName, fileName);
}

export function createArtifactLogger(prefix = "generate_project"): ArtifactLogger {
  const runId = createRunId();
  const runDirRelative = appendRelativePath(
    ARTIFACT_ROOT_RELATIVE,
    `${sanitizeSegment(prefix)}_${runId}`
  );
  const runDirAbsolute = appendAbsolutePath(WORKSPACE_ROOT, runDirRelative);

  return {
    runDirAbsolute,
    runDirRelative,
    writeJson: async (step: string, name: string, value: unknown) => {
      const fileName = `${sanitizeSegment(name)}.json`;
      return writeArtifactFile(
        runDirAbsolute,
        runDirRelative,
        step,
        fileName,
        JSON.stringify(value, null, 2)
      );
    },
    writeText: async (step: string, name: string, content: string, extension = "txt") => {
      const rawExtension = extension.replace(/^\.+/, "").trim();
      const normalizedExtension = /^[a-zA-Z0-9]{1,16}$/.test(rawExtension) ? rawExtension : "txt";
      const safeName = sanitizeSegment(name);
      const fileName = `${safeName}.${normalizedExtension}`;
      return writeArtifactFile(runDirAbsolute, runDirRelative, step, fileName, content);
    },
  };
}

export function createStepLogger(options?: {
  onStep?: (step: BuildStep) => void;
  prefix?: string;
}): StepLogger {
  const resultSteps: BuildStep[] = [];
  const stepStarts = new Map<string, number>();
  const prefix = options?.prefix ?? "generate_project";

  const startStep = (step: string) => {
    const now = Date.now();
    stepStarts.set(step, now);
    // Emit an "active" event so the UI shows the step as in-progress immediately
    const activeEntry: BuildStep = { step, status: "active", timestamp: now, duration: 0 };
    options?.onStep?.(activeEntry);
  };

  const logStep = (
    step: string,
    status: "ok" | "error",
    detail?: string,
    skillId?: string | null,
    trace?: StepTrace
  ): BuildStep => {
    const now = Date.now();
    const duration = now - (stepStarts.get(step) ?? now);
    const entry: BuildStep = { step, status, detail, timestamp: now, duration, skillId };
    if (trace && Object.keys(trace).length > 0) {
      entry.trace = trace;
    }

    resultSteps.push(entry);
    options?.onStep?.(entry);

    const icon = status === "ok" ? "✓" : "✗";
    const suffix = duration > 0 ? ` (+${(duration / 1000).toFixed(1)}s)` : "";
    console.log(`[${prefix}] ${icon} ${step}${detail ? `: ${detail}` : ""}${suffix}`);

    return entry;
  };

  const attachTrace = (step: string, trace: StepTrace): void => {
    const entry = resultSteps.findLast((s) => s.step === step);
    if (!entry) return;
    entry.trace = { ...entry.trace, ...trace };
    // re-emit so the SSE stream gets the updated trace
    options?.onStep?.(entry);
  };

  const timed = async <T>(
    stepName: string,
    fn: () => Promise<T>,
    onOk?: (value: T) => string | undefined | { detail?: string; trace?: StepTrace }
  ): Promise<T> => {
    startStep(stepName);
    try {
      const value = await fn();
      const maybe = onOk?.(value);
      let detail: string | undefined;
      let trace: StepTrace | undefined;
      if (maybe != null && typeof maybe === "object" && ("trace" in maybe || "detail" in maybe)) {
        detail = (maybe as { detail?: string }).detail;
        trace = (maybe as { trace?: StepTrace }).trace;
      } else {
        detail = maybe as string | undefined;
      }
      logStep(stepName, "ok", detail, undefined, trace);
      return value;
    } catch (error) {
      logStep(stepName, "error", error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  const timedWithTrace = async <T>(
    stepName: string,
    fn: (addTrace: (trace: StepTrace) => void) => Promise<T>,
    onOk?: (value: T) => string | undefined | { detail?: string; trace?: StepTrace }
  ): Promise<T> => {
    startStep(stepName);
    let pendingTrace: StepTrace = {};
    const addTrace = (trace: StepTrace) => {
      pendingTrace = { ...pendingTrace, ...trace };
    };
    try {
      const value = await fn(addTrace);
      const maybe = onOk?.(value);
      let detail: string | undefined;
      let traceFromOk: StepTrace | undefined;
      if (maybe != null && typeof maybe === "object" && ("trace" in maybe || "detail" in maybe)) {
        detail = (maybe as { detail?: string }).detail;
        traceFromOk = (maybe as { trace?: StepTrace }).trace;
      } else {
        detail = maybe as string | undefined;
      }
      const mergedTrace =
        Object.keys(pendingTrace).length > 0 || (traceFromOk && Object.keys(traceFromOk).length > 0)
          ? { ...pendingTrace, ...traceFromOk }
          : undefined;
      const entry = logStep(stepName, "ok", detail, undefined, mergedTrace);
      if (mergedTrace && Object.keys(mergedTrace).length > 0) {
        options?.onStep?.(entry);
      }
      return value;
    } catch (error) {
      const entry = logStep(stepName, "error", error instanceof Error ? error.message : String(error));
      if (Object.keys(pendingTrace).length > 0) {
        entry.trace = { ...entry.trace, ...pendingTrace };
        options?.onStep?.(entry);
      }
      throw error;
    }
  };

  return {
    resultSteps,
    startStep,
    logStep,
    attachTrace,
    timed,
    timedWithTrace,
  };
}
