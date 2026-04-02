"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { runBuildSite } from "../lib/build-studio-api";
import type { AiResponse, BuildStep } from "../types/build-studio";

export type RightPanel = "topology" | "preview";

export interface ModifyStep {
  name: string;
  status: "running" | "done" | "error";
  message?: string;
}

export interface ModifyDiff {
  file: string;
  reasoning: string;
  patch: string;
  stats: { additions: number; deletions: number };
}

export interface ModifyPlan {
  analysis: string;
  changes: Array<{ path: string; action: string; reasoning: string }>;
}

export interface ModifyRecord {
  instruction: string;
  plan: ModifyPlan | null;
  steps: ModifyStep[];
  diffs: ModifyDiff[];
  error: string | null;
  completedAt: string;
}

export interface BuildStudioState {
  // Build
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
  handleRetry: () => Promise<void>;

  // Model
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  availableModels: Array<{ id: string; displayName: string }>;

  // Project
  projectId: string | null;
  setProjectId: (id: string | null) => void;

  // Right panel toggle
  rightPanel: RightPanel;
  setRightPanel: (p: RightPanel) => void;

  // Preview
  previewUrl: string | null;
  previewState: "idle" | "starting" | "ready" | "error";
  previewError: string | null;
  startPreview: () => Promise<void>;
  rebuildPreview: () => Promise<void>;

  // Modify
  modifyInstruction: string;
  setModifyInstruction: (v: string) => void;
  modifying: boolean;
  modifySteps: ModifyStep[];
  modifyPlan: ModifyPlan | null;
  modifyDiffs: ModifyDiff[];
  modifyError: string | null;
  handleModify: () => Promise<void>;
  modifyHistory: ModifyRecord[];
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

export function useBuildStudio(initialProjectId?: string | null): BuildStudioState {
  const [input, setInput] = useState("我想搭建一个万圣节宣传页面");
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [lastRunInput, setLastRunInput] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [selectedModel, setSelectedModel] = useState("gemini-3-flash-preview");

  // Fetch available models
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; displayName: string }>>([]);
  useEffect(() => {
    fetch("/api/models").then(r => r.json()).then(data => {
      if (data.models) setAvailableModels(data.models);
      if (data.default && !selectedModel) setSelectedModel(data.default);
    }).catch(() => { });
  }, []);

  const [projectId, setProjectId] = useState<string | null>(initialProjectId ?? null);
  const [rightPanel, setRightPanel] = useState<RightPanel>("topology");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "starting" | "ready" | "error">("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [modifyInstruction, setModifyInstruction] = useState("");
  const [modifying, setModifying] = useState(false);
  const [modifySteps, setModifySteps] = useState<ModifyStep[]>([]);
  const [modifyPlan, setModifyPlan] = useState<ModifyPlan | null>(null);
  const [modifyDiffs, setModifyDiffs] = useState<ModifyDiff[]>([]);
  const [modifyError, setModifyError] = useState<string | null>(null);
  const [modifyHistory, setModifyHistory] = useState<ModifyRecord[]>([]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const projectIdFromGenerationRef = useRef<string | null>(null);
  // Refs to capture in-progress modify state for history
  const modifyStepsRef = useRef<ModifyStep[]>([]);
  const modifyPlanRef = useRef<ModifyPlan | null>(null);
  const modifyDiffsRef = useRef<ModifyDiff[]>([]);

  useEffect(() => {
    if (loading && startedAt) {
      timerRef.current = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading, startedAt]);

  useEffect(() => { return () => abortRef.current?.abort(); }, []);

  // When projectId changes (e.g. loading an existing project), reset preview state
  // and restore conversation history from the project registry
  useEffect(() => {
    setPreviewUrl(null);
    setPreviewState("idle");
    setPreviewError(null);
    setModifySteps([]);
    setModifyPlan(null);
    setModifyDiffs([]);
    setModifyError(null);

    if (!projectId) {
      // No project — clear conversation
      setResponse(null);
      setLastRunInput(null);
      return;
    }

    // If this projectId was just set by a generation run, don't overwrite the response
    if (projectIdFromGenerationRef.current === projectId) {
      projectIdFromGenerationRef.current = null;
      return;
    }

    // Load project metadata to restore conversation context
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((project) => {
        if (!project) return;
        setLastRunInput(project.userPrompt ?? null);
        if (project.modelId) setSelectedModel(project.modelId);

        // Restore modification history
        if (project.modificationHistory && project.modificationHistory.length > 0) {
          setModifyHistory(project.modificationHistory.map((r: {
            instruction: string;
            plan?: { analysis: string; changes: Array<{ path: string; action: string; reasoning: string }> };
            diffs?: Array<{ file: string; reasoning: string; patch: string; stats: { additions: number; deletions: number } }>;
            error?: string;
            modifiedAt: string;
          }) => ({
            instruction: r.instruction,
            plan: r.plan ?? null,
            steps: [],
            diffs: r.diffs ?? [],
            error: r.error ?? null,
            completedAt: r.modifiedAt,
          })));
        }
        // Restore full response — same shape as what was shown during generation
        setResponse((prev) => prev ?? {
          content: project.status === "ready"
            ? `项目已生成完成。${project.verificationStatus === "passed" ? "构建验证通过。" : ""}`
            : project.status === "failed"
              ? `项目生成失败：${project.error ?? "未知错误"}`
              : "项目生成中...",
          projectId: project.id,
          verificationStatus: project.verificationStatus,
          blueprint: project.blueprint,
          buildSteps: project.buildSteps ?? [],
          generatedFiles: project.generatedFiles ?? [],
          logDirectory: project.logDirectory,
          error: project.error,
        });
      })
      .catch(() => { /* ignore */ });
  }, [projectId]);

  async function handleRun() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const t0 = Date.now();
    setStartedAt(t0);
    setElapsed(0);
    setLoading(true);
    setResponse(null);
    setLastRunInput(input);
    setProjectId(null);
    setRightPanel("topology");
    setPreviewUrl(null);
    setPreviewState("idle");

    try {
      await runBuildSite(
        input,
        {
          onStep: (step: BuildStep) =>
            setResponse((prev) => {
              const existing = prev?.buildSteps ?? [];
              const idx = existing.findIndex((s) => s.step === step.step);
              const updated = idx >= 0
                ? [...existing.slice(0, idx), step, ...existing.slice(idx + 1)]
                : [...existing, step];
              return {
                content: prev?.content ?? "",
                generatedFiles: prev?.generatedFiles,
                verificationStatus: prev?.verificationStatus,
                unvalidatedFiles: prev?.unvalidatedFiles,
                installedDependencies: prev?.installedDependencies,
                dependencyInstallFailures: prev?.dependencyInstallFailures,
                buildTotalDuration: prev?.buildTotalDuration,
                logDirectory: prev?.logDirectory,
                buildSteps: updated,
              };
            }),
          onDone: (result) => {
            setResponse((prev) => ({ ...result, buildSteps: result.buildSteps ?? prev?.buildSteps }));
            if (result.projectId) {
              projectIdFromGenerationRef.current = result.projectId;
              setProjectId(result.projectId);
              window.history.replaceState(null, "", `/build-studio?projectId=${result.projectId}`);
            }
          },
          onError: (msg) => setResponse({ content: "", error: msg }),
        },
        abortRef.current.signal,
        { model: selectedModel }
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setResponse({ content: "", error: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleClear() {
    setClearing(true);
    try {
      await fetch("/api/clear-template", { method: "POST" });
    } catch (err) {
      console.error("[clear-template]", err);
    } finally {
      setClearing(false);
    }
  }

  async function handleRetry() {
    if (!projectId || loading) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const t0 = Date.now();
    setStartedAt(t0);
    setElapsed(0);
    setLoading(true);
    setResponse(null);
    setRightPanel("topology");
    setPreviewUrl(null);
    setPreviewState("idle");

    const retryId = projectId;

    try {
      await runBuildSite(
        "", // prompt comes from the existing project
        {
          onStep: (step: BuildStep) =>
            setResponse((prev) => {
              const existing = prev?.buildSteps ?? [];
              const idx = existing.findIndex((s) => s.step === step.step);
              const updated = idx >= 0
                ? [...existing.slice(0, idx), step, ...existing.slice(idx + 1)]
                : [...existing, step];
              return {
                content: prev?.content ?? "",
                generatedFiles: prev?.generatedFiles,
                verificationStatus: prev?.verificationStatus,
                unvalidatedFiles: prev?.unvalidatedFiles,
                installedDependencies: prev?.installedDependencies,
                dependencyInstallFailures: prev?.dependencyInstallFailures,
                buildTotalDuration: prev?.buildTotalDuration,
                logDirectory: prev?.logDirectory,
                buildSteps: updated,
              };
            }),
          onDone: (result) => {
            setResponse((prev) => ({ ...result, buildSteps: result.buildSteps ?? prev?.buildSteps }));
            if (result.projectId) {
              projectIdFromGenerationRef.current = result.projectId;
              setProjectId(result.projectId);
              window.history.replaceState(null, "", `/build-studio?projectId=${result.projectId}`);
            }
          },
          onError: (msg) => setResponse({ content: "", error: msg }),
        },
        abortRef.current.signal,
        { model: selectedModel, retryProjectId: retryId }
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setResponse({ content: "", error: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      setLoading(false);
    }
  }

  const startPreview = useCallback(async () => {
    if (!projectId) return;
    setPreviewUrl(null);
    setPreviewState("starting");
    setPreviewError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/preview`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setPreviewUrl(data.url);
        setPreviewState("ready");
      } else {
        const err = await res.json().catch(() => ({}));
        setPreviewError(err.error ?? `HTTP ${res.status}`);
        setPreviewState("error");
      }
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Network error");
      setPreviewState("error");
    }
  }, [projectId]);

  const rebuildPreview = useCallback(async () => {
    if (!projectId) return;
    setPreviewUrl(null);
    setPreviewState("starting");
    setPreviewError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/preview`, { method: "PUT" });
      if (res.ok) {
        const data = await res.json();
        setPreviewUrl(data.url);
        setPreviewState("ready");
      } else {
        const err = await res.json().catch(() => ({}));
        setPreviewError(err.error ?? `HTTP ${res.status}`);
        setPreviewState("error");
      }
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Network error");
      setPreviewState("error");
    }
  }, [projectId]);

  // Auto-start preview when switching to preview panel
  useEffect(() => {
    if (rightPanel === "preview" && projectId && previewState === "idle") {
      startPreview();
    }
  }, [rightPanel, projectId, previewState, startPreview]);

  const handleModify = useCallback(async () => {
    if (!modifyInstruction.trim() || modifying || !projectId) return;
    setModifying(true);
    setModifySteps([]);
    setModifyPlan(null);
    setModifyDiffs([]);
    setModifyError(null);
    modifyStepsRef.current = [];
    modifyPlanRef.current = null;
    modifyDiffsRef.current = [];

    try {
      const res = await fetch(`/api/projects/${projectId}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInstruction: modifyInstruction }),
      });

      if (!res.ok || !res.body) { setModifyError("Failed to start modification"); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "step") {
              setModifySteps((prev) => {
                const idx = prev.findIndex((s) => s.name === event.name);
                let next: ModifyStep[];
                if (idx >= 0) { next = [...prev]; next[idx] = { name: event.name, status: event.status, message: event.message }; }
                else { next = [...prev, { name: event.name, status: event.status, message: event.message }]; }
                modifyStepsRef.current = next;
                return next;
              });
            } else if (event.type === "plan") {
              setModifyPlan(event.plan);
              modifyPlanRef.current = event.plan;
            } else if (event.type === "diff") {
              setModifyDiffs((prev) => {
                const next = [...prev, { file: event.file, reasoning: event.reasoning, patch: event.patch, stats: event.stats }];
                modifyDiffsRef.current = next;
                return next;
              });
            } else if (event.type === "error") {
              setModifyError(event.message);
            } else if (event.type === "done") {
              setModifyInstruction("");
              // Commit this modify run to history
              setModifyHistory((prev) => [...prev, {
                instruction: modifyInstruction,
                plan: modifyPlanRef.current,
                steps: modifyStepsRef.current,
                diffs: modifyDiffsRef.current,
                error: null,
                completedAt: new Date().toISOString(),
              }]);
              // Rebuild sandbox with updated files, then refresh preview
              rebuildPreview().catch(() => {
              // If rebuild fails, at least try refreshing the iframe
                if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setModifyError(msg);
      setModifyHistory((prev) => [...prev, {
        instruction: modifyInstruction,
        plan: modifyPlanRef.current,
        steps: modifyStepsRef.current,
        diffs: modifyDiffsRef.current,
        error: msg,
        completedAt: new Date().toISOString(),
      }]);
    } finally {
      setModifying(false);
    }
  }, [modifyInstruction, modifying, projectId]);

  const flowStart =
    response?.buildSteps?.[0]?.timestamp != null
      ? response.buildSteps[0].timestamp - response.buildSteps[0].duration
      : startedAt ?? 0;

  return {
    input, setInput, loading, clearing, response, lastRunInput, elapsed, flowStart,
    handleRun, handleClear, handleRetry,
    selectedModel, setSelectedModel, availableModels,
    projectId, setProjectId,
    rightPanel, setRightPanel,
    previewUrl, previewState, previewError, startPreview, rebuildPreview,
    modifyInstruction, setModifyInstruction, modifying,
    modifySteps, modifyPlan, modifyDiffs, modifyError, handleModify,
    modifyHistory,
    iframeRef,
  };
}
