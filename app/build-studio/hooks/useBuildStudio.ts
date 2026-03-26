"use client";

import { useEffect, useRef, useState } from "react";
import { runBuildSite, clearTemplate } from "../lib/build-studio-api";
import type { AiResponse, BuildStep } from "../types/build-studio";

export interface BuildStudioState {
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  clearing: boolean;
  response: AiResponse | null;
  lastRunInput: string | null;
  elapsed: number;
  flowStart: number;
  handleRun: () => Promise<void>;
  handleClear: () => Promise<void>;
}

export function useBuildStudio(): BuildStudioState {
  const [input, setInput] = useState("我想搭建一个万圣节宣传页面");
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [lastRunInput, setLastRunInput] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (loading && startedAt) {
      timerRef.current = setInterval(() => {
        setElapsed(Date.now() - startedAt);
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, startedAt]);

  // cancel in-flight request on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function handleRun() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const t0 = Date.now();
    setStartedAt(t0);
    setElapsed(0);
    setLoading(true);
    setResponse(null);
    setLastRunInput(input);

    try {
      await runBuildSite(
        input,
        {
          onStep: (step: BuildStep) =>
            setResponse((prev) => ({
              content: prev?.content ?? "",
              generatedFiles: prev?.generatedFiles,
              verificationStatus: prev?.verificationStatus,
              unvalidatedFiles: prev?.unvalidatedFiles,
              installedDependencies: prev?.installedDependencies,
              dependencyInstallFailures: prev?.dependencyInstallFailures,
              buildTotalDuration: prev?.buildTotalDuration,
              logDirectory: prev?.logDirectory,
              buildSteps: [...(prev?.buildSteps ?? []), step],
            })),
          onDone: (result) =>
            setResponse((prev) => ({
              ...result,
              buildSteps: result.buildSteps ?? prev?.buildSteps,
            })),
          onError: (msg) => setResponse({ content: "", error: msg }),
        },
        abortRef.current.signal
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setResponse({
          content: "",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleClear() {
    setClearing(true);
    try {
      await clearTemplate();
    } catch (err) {
      console.error("[clear-template]", err);
    } finally {
      setClearing(false);
    }
  }

  const flowStart =
    response?.buildSteps?.[0]?.timestamp != null
      ? response.buildSteps[0].timestamp - response.buildSteps[0].duration
      : startedAt ?? 0;

  return {
    input,
    setInput,
    loading,
    clearing,
    response,
    lastRunInput,
    elapsed,
    flowStart,
    handleRun,
    handleClear,
  };
}
