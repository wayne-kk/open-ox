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

export interface ModifyToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: string;
}

export interface ModifyPlan {
  analysis: string;
  changes: Array<{ path: string; action: string; reasoning: string }>;
}

export interface ModifyRecord {
  instruction: string;
  image?: string | null; // base64 data URL if image was attached
  plan: ModifyPlan | null;
  steps: ModifyStep[];
  diffs: ModifyDiff[];
  toolCalls: ModifyToolCall[];
  thinking: string[];
  error: string | null;
  completedAt: string;
  isSystemMessage?: boolean;
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
  projectLoading: boolean;

  // Right panel toggle
  rightPanel: RightPanel;
  setRightPanel: (p: RightPanel) => void;

  // Preview
  previewUrl: string | null;
  previewState: "idle" | "starting" | "ready" | "error";
  previewError: string | null;
  previewVersion: number;
  startPreview: () => Promise<void>;
  rebuildPreview: () => Promise<void>;

  // Modify
  modifyInstruction: string;
  setModifyInstruction: (v: string) => void;
  modifyImage: string | null;
  setModifyImage: (v: string | null) => void;
  modifying: boolean;
  modifySteps: ModifyStep[];
  modifyPlan: ModifyPlan | null;
  modifyDiffs: ModifyDiff[];
  modifyToolCalls: ModifyToolCall[];
  modifyThinking: string[];
  modifyError: string | null;
  handleModify: () => Promise<void>;
  clearModifyHistory: () => void;
  modifyHistory: ModifyRecord[];
  pendingModifyInstruction: string | null;
  pendingModifyImage: string | null;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

export function useBuildStudio(initialProjectId?: string | null, initialPrompt?: string | null): BuildStudioState {
  const [input, setInput] = useState(initialPrompt ?? "");
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
  const [projectLoading, setProjectLoading] = useState<boolean>(!!initialProjectId);
  const [rightPanel, setRightPanel] = useState<RightPanel>("topology");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "starting" | "ready" | "error">("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);

  const [modifyInstruction, setModifyInstruction] = useState("");
  const [modifyImage, setModifyImage] = useState<string | null>(null);
  const [modifying, setModifying] = useState(false);
  const [modifySteps, setModifySteps] = useState<ModifyStep[]>([]);
  const [modifyPlan, setModifyPlan] = useState<ModifyPlan | null>(null);
  const [modifyDiffs, setModifyDiffs] = useState<ModifyDiff[]>([]);
  const [modifyToolCalls, setModifyToolCalls] = useState<ModifyToolCall[]>([]);
  const [modifyThinking, setModifyThinking] = useState<string[]>([]);
  const [modifyError, setModifyError] = useState<string | null>(null);
  const [modifyHistory, setModifyHistory] = useState<ModifyRecord[]>([]);
  const [contextCleared, setContextCleared] = useState(false);
  const [pendingModifyInstruction, setPendingModifyInstruction] = useState<string | null>(null);
  const [pendingModifyImage, setPendingModifyImage] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const projectIdFromGenerationRef = useRef<string | null>(null);
  const autoStartedRef = useRef(false);
  // Refs to capture in-progress modify state for history
  const modifyStepsRef = useRef<ModifyStep[]>([]);
  const modifyPlanRef = useRef<ModifyPlan | null>(null);
  const modifyDiffsRef = useRef<ModifyDiff[]>([]);
  const modifyThinkingRef = useRef<string[]>([]);
  const modifyToolCallsRef = useRef<ModifyToolCall[]>([]);

  useEffect(() => {
    if (loading && startedAt) {
      timerRef.current = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading, startedAt]);

  useEffect(() => { return () => abortRef.current?.abort(); }, []);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  type ProjectData = {
    id: string; status: string; userPrompt: string; modelId?: string;
    buildSteps?: unknown[]; generatedFiles?: string[]; blueprint?: unknown;
    verificationStatus?: string; logDirectory?: string; error?: string;
    modificationHistory?: Array<{
      instruction: string; modifiedAt: string;
      plan?: { analysis: string; changes: Array<{ path: string; action: string; reasoning: string }> };
      diffs?: Array<{ file: string; reasoning: string; patch: string; stats: { additions: number; deletions: number } }>;
      toolCalls?: Array<{ tool: string; args: Record<string, unknown>; result: string }>;
      thinking?: string[];
      image?: string | null;
      error?: string;
    }>;
  };

  const applyProjectData = useCallback((project: ProjectData) => {
    setLastRunInput(project.userPrompt ?? null);
    if (project.modelId) setSelectedModel(project.modelId);
    if (project.modificationHistory?.length) {
      setModifyHistory(project.modificationHistory.map((r) => ({
        instruction: r.instruction,
        image: r.image ?? null,
        plan: r.plan ?? null,
        steps: [],
        diffs: r.diffs ?? [],
        toolCalls: r.toolCalls ?? [],
        thinking: r.thinking ?? [],
        error: r.error ?? null,
        completedAt: r.modifiedAt,
      })));
    }
    setResponse({
      content: project.status === "ready"
        ? `项目已生成完成。${project.verificationStatus === "passed" ? "构建验证通过。" : ""}`
        : project.status === "failed"
          ? `项目生成失败：${project.error ?? "未知错误"}`
          : "项目生成中...",
      projectId: project.id,
      verificationStatus: project.verificationStatus as "passed" | "failed" | undefined,
      blueprint: project.blueprint as import("../types/build-studio").AiResponse["blueprint"],
      buildSteps: (project.buildSteps ?? []) as import("../types/build-studio").BuildStep[],
      generatedFiles: project.generatedFiles ?? [],
      logDirectory: project.logDirectory,
      error: project.status === "failed" ? (project.error ?? "Generation failed") : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When projectId changes: load project data, start polling if still generating
  useEffect(() => {
    setPreviewUrl(null);
    setPreviewState("idle");
    setPreviewError(null);
    setModifySteps([]);
    setModifyPlan(null);
    setModifyDiffs([]);
    setModifyError(null);
    stopPolling();

    if (!projectId) {
      setResponse(null);
      setLastRunInput(null);
      return;
    }

    // If this projectId was just set by a live generation run, don't overwrite
    if (projectIdFromGenerationRef.current === projectId) {
      projectIdFromGenerationRef.current = null;
      setProjectLoading(false);
      return;
    }

    fetch(`/api/projects/${projectId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((project: ProjectData | null) => {
        if (!project) { setProjectLoading(false); return; }
        applyProjectData(project);
        setProjectLoading(false);

        if (project.status === "generating") {
          // Poll every 3s to pick up incremental buildSteps and final status
          setLoading(true);
          pollingRef.current = setInterval(async () => {
            const r2 = await fetch(`/api/projects/${projectId}`);
            if (!r2.ok) return;
            const updated: ProjectData = await r2.json();
            applyProjectData(updated);
            if (updated.status !== "generating") {
              stopPolling();
              setLoading(false);
            }
          }, 3000);
        }
      })
      .catch(() => { setProjectLoading(false); });

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Auto-run: first visit to a freshly created project (no buildSteps yet),
  // OR re-entry into a failed project (offer retry via handleRetry, not auto-trigger)
  useEffect(() => {
    if (initialProjectId && !autoStartedRef.current) {
      autoStartedRef.current = true;
      fetch(`/api/projects/${initialProjectId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((project: ProjectData | null) => {
          if (project?.status === "generating" && !(project.buildSteps?.length)) {
            // Brand new project — kick off build immediately
            void handleRun();
          }
          // failed projects: just load the data (already done by the projectId effect above),
          // user can manually retry via the UI
        })
        .catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  async function handleRun() {
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

    // Resolve the prompt to display: use input state, or fall back to what's stored in the project
    let displayPrompt = input;
    if (!displayPrompt && projectId) {
      try {
        const r = await fetch(`/api/projects/${projectId}`);
        if (r.ok) { const p = await r.json(); displayPrompt = p.userPrompt ?? ""; }
      } catch { /* ignore */ }
    }
    setLastRunInput(displayPrompt || null);

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
            }
          },
          onError: (msg) => setResponse({ content: "", error: msg }),
        },
        abortRef.current.signal,
        {
          model: selectedModel,
          // Pass the pre-created projectId so the server skips createProject
          ...(projectId ? { projectId } : {}),
          // Pass styleGuide stored by HeroPrompt (only present on first build)
          ...(projectId && typeof sessionStorage !== "undefined"
            ? (() => {
              const sg = sessionStorage.getItem(`styleGuide:${projectId}`);
              if (sg) { sessionStorage.removeItem(`styleGuide:${projectId}`); return { styleGuide: sg }; }
              return {};
            })()
            : {}),
        }
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
              // Stay on the same /studio/[id] URL — no redirect needed
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
        setPreviewVersion((v) => v + 1);
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
        setPreviewVersion((v) => v + 1);
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
    // Capture image immediately and clear from input
    const capturedImage = modifyImage;
    setModifyImage(null);
    setPendingModifyInstruction(modifyInstruction);
    setPendingModifyImage(capturedImage);
    setModifying(true);
    setModifySteps([]);
    setModifyPlan(null);
    setModifyDiffs([]);
    setModifyToolCalls([]);
    setModifyThinking([]);
    setModifyError(null);
    modifyStepsRef.current = [];
    modifyPlanRef.current = null;
    modifyDiffsRef.current = [];
    modifyThinkingRef.current = [];
    modifyToolCallsRef.current = [];

    try {
      const res = await fetch(`/api/projects/${projectId}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInstruction: modifyInstruction,
          model: selectedModel,
          clearContext: contextCleared,
          ...(capturedImage ? { imageBase64: capturedImage } : {}),
          conversationHistory: contextCleared ? [] : modifyHistory.filter((r) => !r.isSystemMessage).map((r) => ({
            instruction: r.instruction,
            summary: r.plan?.analysis
              ? `${r.plan.analysis} Files: ${r.diffs.map((d) => d.file).join(", ")}`
              : r.error
                ? `Failed: ${r.error}`
                : `Modified ${r.diffs.length} file(s)`,
          })),
        }),
      });

      if (!res.ok || !res.body) { setModifyError("Failed to start modification"); return; }
      setContextCleared(false); // reset after successful request

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
            } else if (event.type === "tool_call") {
              const tc = { tool: event.tool, args: event.args, result: event.result };
              setModifyToolCalls((prev) => [...prev, tc]);
              modifyToolCallsRef.current = [...modifyToolCallsRef.current, tc];
            } else if (event.type === "thinking") {
              setModifyThinking((prev) => [...prev, event.content]);
              modifyThinkingRef.current = [...modifyThinkingRef.current, event.content];
            } else if (event.type === "error") {
              setModifyError(event.message);
            } else if (event.type === "done") {
              setModifyInstruction("");
              setModifyImage(null);
              setModifyHistory((prev) => [...prev, {
                instruction: modifyInstruction,
                image: capturedImage ?? null,
                plan: modifyPlanRef.current,
                steps: modifyStepsRef.current,
                diffs: modifyDiffsRef.current,
                toolCalls: modifyToolCallsRef.current,
                thinking: modifyThinkingRef.current,
                error: null,
                completedAt: new Date().toISOString(),
              }]);

              // Always try to rebuild preview if there were changes
              if (modifyDiffsRef.current.length === 0) break;

              setRightPanel("preview");
              setPreviewState("starting");
              setPreviewUrl(null);

              // Always use PUT (rebuildDevServer) — it guarantees fresh file
              // upload + build. Never POST (startDevServer) which has a reconnect
              // shortcut that reuses a running sandbox WITHOUT re-uploading files.
              fetch(`/api/projects/${projectId}/preview`, { method: "PUT" })
                .then((r) => r.ok ? r.json() : r.json().catch(() => ({})).then((err) => Promise.reject(err)))
                .then((data) => {
                  setPreviewUrl(data.url);
                  setPreviewVersion((v) => v + 1);
                  setPreviewState("ready");
                })
                .catch((err) => {
                  console.error("[preview] Rebuild failed:", err);
                  setPreviewState("error");
                  setPreviewError(
                    event.buildPassed === false
                      ? "构建失败，预览无法更新。请修复代码错误后重试。"
                      : (err?.error ?? "Preview rebuild failed")
                  );
                });
            }
          } catch (e) { console.warn("[modify] SSE parse error:", e); }
        }
      }
      console.log("[modify] stream ended. steps:", modifyStepsRef.current.length, "diffs:", modifyDiffsRef.current.length);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setModifyError(msg);
      setModifyHistory((prev) => [...prev, {
        instruction: modifyInstruction,
        image: capturedImage ?? null,
        plan: modifyPlanRef.current,
        steps: modifyStepsRef.current,
        diffs: modifyDiffsRef.current,
        toolCalls: modifyToolCallsRef.current,
        thinking: modifyThinkingRef.current,
        error: msg,
        completedAt: new Date().toISOString(),
      }]);
    } finally {
      setModifying(false);
      setPendingModifyInstruction(null);
      setPendingModifyImage(null);
    }
  }, [modifyInstruction, modifyImage, modifying, projectId, selectedModel, modifyHistory]);

  const flowStart =
    response?.buildSteps?.[0]?.timestamp != null
      ? response.buildSteps[0].timestamp - response.buildSteps[0].duration
      : startedAt ?? 0;

  return {
    input, setInput, loading, clearing, response, lastRunInput, elapsed, flowStart,
    handleRun, handleClear, handleRetry,
    selectedModel, setSelectedModel, availableModels,
    projectId, setProjectId, projectLoading,
    rightPanel, setRightPanel,
    previewUrl, previewState, previewError, previewVersion, startPreview, rebuildPreview,
    modifyInstruction, setModifyInstruction, modifyImage, setModifyImage, modifying,
    modifySteps, modifyPlan, modifyDiffs, modifyToolCalls, modifyThinking, modifyError, handleModify,
    clearModifyHistory: () => {
      setModifyHistory([{
        instruction: "/clear",
        plan: null, steps: [], diffs: [], toolCalls: [], thinking: [],
        error: null, completedAt: new Date().toISOString(), isSystemMessage: true,
      }]);
      setModifySteps([]); setModifyPlan(null); setModifyDiffs([]);
      setModifyToolCalls([]); setModifyThinking([]); setModifyError(null);
      setContextCleared(true);
    },
    modifyHistory,
    pendingModifyInstruction,
    pendingModifyImage,
    iframeRef,
  };
}
