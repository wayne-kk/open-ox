import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { WORKSPACE_ROOT } from "../../../tools/system/common";
import type { BuildStep } from "../types";

export interface StepLogger {
  resultSteps: BuildStep[];
  startStep: (step: string) => void;
  logStep: (step: string, status: "ok" | "error", detail?: string) => BuildStep;
  timed: <T>(
    stepName: string,
    fn: () => Promise<T>,
    onOk?: (value: T) => string | undefined
  ) => Promise<T>;
}

export interface ArtifactLogger {
  runDirAbsolute: string;
  runDirRelative: string;
  writeJson: (step: string, name: string, value: unknown) => Promise<string>;
  writeText: (step: string, name: string, content: string, extension?: string) => Promise<string>;
}

const ARTIFACT_ROOT_RELATIVE = ".open-ox/logs/generate_project";

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
  const targetDir = join(runDirAbsolute, stepDirName);
  await ensureDir(targetDir);
  const absolutePath = join(targetDir, fileName);
  await writeFile(absolutePath, content, "utf-8");
  return join(runDirRelative, stepDirName, fileName);
}

export function createArtifactLogger(prefix = "generate_project"): ArtifactLogger {
  const runId = createRunId();
  const runDirRelative = join(ARTIFACT_ROOT_RELATIVE, `${sanitizeSegment(prefix)}_${runId}`);
  const runDirAbsolute = join(WORKSPACE_ROOT, runDirRelative);

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
      const normalizedExtension = extension.replace(/^\.+/, "") || "txt";
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
    stepStarts.set(step, Date.now());
  };

  const logStep = (step: string, status: "ok" | "error", detail?: string) => {
    const now = Date.now();
    const duration = now - (stepStarts.get(step) ?? now);
    const entry: BuildStep = { step, status, detail, timestamp: now, duration };

    resultSteps.push(entry);
    options?.onStep?.(entry);

    const icon = status === "ok" ? "✓" : "✗";
    const suffix = duration > 0 ? ` (+${(duration / 1000).toFixed(1)}s)` : "";
    console.log(`[${prefix}] ${icon} ${step}${detail ? `: ${detail}` : ""}${suffix}`);

    return entry;
  };

  const timed = async <T>(
    stepName: string,
    fn: () => Promise<T>,
    onOk?: (value: T) => string | undefined
  ): Promise<T> => {
    startStep(stepName);
    try {
      const value = await fn();
      logStep(stepName, "ok", onOk?.(value));
      return value;
    } catch (error) {
      logStep(
        stepName,
        "error",
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  };

  return {
    resultSteps,
    startStep,
    logStep,
    timed,
  };
}
