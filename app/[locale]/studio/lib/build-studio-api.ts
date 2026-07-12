import type { AiResponse, BuildStep, IntentAgentTurn } from "../types/build-studio";
import type { IntentProgressEvent } from "@/ai/flows/generate_project/intentAgent/types";
import {
  createAgentStreamClientSession,
  decodeAgentSseJsonLine,
  isSecureAgentStreamSupported,
  type AgentStreamClientSession,
} from "@/lib/transport/agentStream.client";
import { parseSseDataLine } from "@/lib/transport/agentStreamSse";

interface BuildSiteCallbacks {
  onStep: (step: BuildStep) => void;
  onIntentTurn?: (turn: IntentAgentTurn) => void;
  onIntentCommit?: (mergedBrief: string) => void;
  /** Live intent-agent tool loop activity (SSE `intent_progress`). */
  onIntentProgress?: (event: IntentProgressEvent) => void;
  onDone: (result: AiResponse) => void;
  /** User-facing info (not treated as a fatal “流程出错” in the UI). */
  onNotice?: (msg: string) => void;
  onError: (msg: string) => void;
}

type QueuedHandshake = {
  kind: "generation_queued";
  projectId: string;
  extras: Partial<AiResponse>;
};

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (!signal) return;
    const onAbort = () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function projectPayloadToAiResponse(project: Record<string, unknown>): AiResponse {
  const status = String(project.status ?? "");
  const err =
    typeof project.error === "string" ? project.error : project.error ? String(project.error) : undefined;
  const vf = project.verificationStatus as "passed" | "failed" | undefined;
  const content =
    status === "ready"
      ? `项目已生成完成。${vf === "passed" ? "构建验证通过。" : ""}`
      : status === "failed"
        ? `项目生成失败：${err ?? "未知错误"}`
        : "";

  return {
    content,
    projectId: project.id as string | undefined,
    blueprint: project.blueprint as AiResponse["blueprint"],
    buildSteps: (project.buildSteps ?? []) as BuildStep[],
    generatedFiles: (project.generatedFiles ?? []) as string[],
    verificationStatus: vf,
    logDirectory: project.logDirectory as string | undefined,
    buildTotalDuration:
      typeof project.totalDuration === "number"
        ? project.totalDuration
        : project.totalDuration != null
          ? Number(project.totalDuration)
          : undefined,
    error: status === "failed" ? err : undefined,
    unvalidatedFiles: project.unvalidatedFiles as AiResponse["unvalidatedFiles"],
    installedDependencies:
      project.installedDependencies as AiResponse["installedDependencies"],
    dependencyInstallFailures:
      project.dependencyInstallFailures as AiResponse["dependencyInstallFailures"],
  };
}

async function recoverAfterSseDisconnected(
  projectId: string,
  callbacks: BuildSiteCallbacks,
  signal?: AbortSignal
): Promise<boolean> {
  if (signal?.aborted) return false;
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, { signal });
    if (!res.ok) return false;
    const project = (await res.json()) as Record<string, unknown>;
    const status = String(project.status ?? "");

    if (status === "generating") {
      callbacks.onNotice?.("与服务器的实时连接已断开，已改为轮询跟踪生成进度…");
      await waitForBackgroundGeneration(projectId, callbacks, signal);
      return true;
    }

    if (status === "ready" || status === "failed") {
      callbacks.onDone(projectPayloadToAiResponse(project));
      return true;
    }

    if (status === "awaiting_input") {
      const msg =
        "与服务器的事件连接已中断（常见于服务重启或网络波动）。项目仍在「等待补充信息」，请重新发送上一条消息。";
      if (callbacks.onNotice) {
        callbacks.onNotice(msg);
      } else {
        callbacks.onError(msg);
      }
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

const GENERATION_STATUS_GRACE_POLLS = 8;

async function waitForBackgroundGeneration(
  projectId: string,
  callbacks: BuildSiteCallbacks,
  signal?: AbortSignal,
  extras?: Partial<AiResponse>,
  options?: { afterIntentCommit?: boolean }
): Promise<void> {
  let lastFingerprint = "";
  try {
    let firstPoll = true;
    let pollCount = 0;
    let sawGenerating = false;
    while (!signal?.aborted) {
      if (!firstPoll) {
        await delay(700, signal);
      }
      firstPoll = false;
      pollCount += 1;
      const res = await fetch(`/api/projects/${projectId}`, { signal });
      if (!res.ok) {
        callbacks.onError((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
        return;
      }
      const project = (await res.json()) as Record<string, unknown>;
      const status = String(project.status ?? "");
      const steps = (project.buildSteps ?? []) as BuildStep[];
      const fp = JSON.stringify(steps);
      if (fp !== lastFingerprint) {
        for (const s of steps) {
          callbacks.onStep(s);
        }
        lastFingerprint = fp;
      }
      if (status === "generating") {
        sawGenerating = true;
        continue;
      }
      if (status === "ready" || status === "failed") {
        callbacks.onDone({
          ...projectPayloadToAiResponse(project),
          ...extras,
        });
        return;
      }
      // Race: intent-agent SSE returns before DB status flips to generating.
      if (
        options?.afterIntentCommit &&
        !sawGenerating &&
        pollCount < GENERATION_STATUS_GRACE_POLLS
      ) {
        continue;
      }
      callbacks.onDone({
        ...projectPayloadToAiResponse(project),
        ...extras,
      });
      return;
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      callbacks.onError("已取消");
    } else {
      callbacks.onError(e instanceof Error ? e.message : String(e));
    }
  }
}

/** Per-SSE-stream flags so `done` fallbacks do not re-deliver an already-seen turn. */
export type IntentSseStreamState = {
  sawIntentAgentTurn: boolean;
};

/** Exported for unit tests — drives Studio intent/build SSE event handling. */
export async function processSSEChunk(
  chunk: string,
  callbacks: BuildSiteCallbacks,
  secureSession: AgentStreamClientSession | null,
  streamState?: IntentSseStreamState
): Promise<QueuedHandshake | undefined> {
  const line = parseSseDataLine(chunk);
  if (!line) return;

  const event = await decodeAgentSseJsonLine(secureSession, line);
  if (!event) return;

  try {

    if (event.type === "intent_agent_turn") {
      if (streamState) streamState.sawIntentAgentTurn = true;
      callbacks.onIntentTurn?.(event.turn as IntentAgentTurn);
      return;
    }
    if (event.type === "intent_progress") {
      const kind = event.kind;
      if (kind === "assistant_round" || kind === "reasoning" || kind === "tool") {
        callbacks.onIntentProgress?.(event as IntentProgressEvent);
      }
      return;
    }
    if (event.type === "intent_agent_commit") {
      callbacks.onIntentCommit?.(String(event.mergedBrief ?? ""));
      return;
    }
    if (event.type === "step") {
      callbacks.onStep(event as unknown as BuildStep);
      return;
    }
    if (event.type === "done") {
      const phase = typeof event.phase === "string" ? event.phase : "";
      const result = (event.result ?? {}) as {
        generationQueued?: boolean;
        projectId?: string;
        mergedBriefFromAgent?: string;
        intentAgent?: IntentAgentTurn;
        content?: string;
      };
      const genQueued =
        phase === "generation_queued" || result.generationQueued === true;

      if (genQueued && typeof result.projectId === "string") {
        const extras: Partial<AiResponse> = {};
        if (result.mergedBriefFromAgent)
          extras.mergedBriefFromAgent = String(result.mergedBriefFromAgent);
        if (result.mergedBriefFromAgent)
          extras.mergedBrief = String(result.mergedBriefFromAgent);
        if (result.intentAgent) extras.intentAgent = result.intentAgent as IntentAgentTurn;
        if (typeof result.content === "string") extras.content = result.content;

        return {
          kind: "generation_queued",
          projectId: result.projectId,
          extras,
        };
      }

      // Fallback only when `intent_agent_turn` was dropped (e.g. secure-stream decode).
      // Unconditional hydrate here double-fires onIntentTurn and duplicates chat bubbles
      // once activityLog differs across the two appends.
      if (
        !streamState?.sawIntentAgentTurn &&
        (phase === "intent_only" || phase === "commit_only") &&
        result.intentAgent
      ) {
        if (streamState) streamState.sawIntentAgentTurn = true;
        callbacks.onIntentTurn?.(result.intentAgent as IntentAgentTurn);
      }

      callbacks.onDone(result as unknown as AiResponse);
      return;
    }
    if (event.type === "error") {
      callbacks.onError(String(event.message));
    }
  } catch {
    // ignore malformed SSE chunks
  }
  return undefined;
}

export async function runBuildSite(
  input: string,
  callbacks: BuildSiteCallbacks,
  signal?: AbortSignal,
  options?: {
    model?: string;
    retryProjectId?: string;
    resumeFromCheckpoint?: boolean;
    projectId?: string;
    /** Pasted screenshot (data URL) — intent-agent only */
    imageBase64?: string | null;
  }
): Promise<void> {
  const useIntentAgent = Boolean(options?.projectId && !options.retryProjectId);
  const secureSession =
    useIntentAgent && isSecureAgentStreamSupported()
      ? await createAgentStreamClientSession()
      : null;

  const res = await fetch(useIntentAgent ? "/api/ai/intent-agent" : "/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      useIntentAgent
        ? {
            projectId: options?.projectId,
            message: input,
            ...(options?.model ? { model: options.model } : {}),
            ...(options?.imageBase64 ? { imageBase64: options.imageBase64 } : {}),
            ...(secureSession ? { clientPublicKey: secureSession.clientPublicKeySpki } : {}),
            runGenerateOnCommit: true,
          }
        : {
            userPrompt: input,
            ...(options?.model ? { model: options.model } : {}),
            ...(options?.resumeFromCheckpoint ? { resumeFromCheckpoint: true } : {}),
            ...(options?.retryProjectId ? { retryProjectId: options.retryProjectId } : {}),
            ...(options?.projectId ? { projectId: options.projectId } : {}),
          }
    ),
    signal,
  });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname)}`;
    }
    callbacks.onError("请先登录");
    return;
  }

  const contentType = res.headers.get("content-type") ?? "";

  const handleQueuedHandshake = async (q: QueuedHandshake): Promise<boolean> => {
    await waitForBackgroundGeneration(q.projectId, callbacks, signal, q.extras, {
      afterIntentCommit: true,
    });
    return true;
  };

  if (contentType.includes("text/event-stream")) {
    const reader = res.body?.getReader();
    if (!reader) throw new Error("SSE stream unavailable");

    const decoder = new TextDecoder();
    let buffer = "";
    const streamState: IntentSseStreamState = { sawIntentAgentTurn: false };

    let sseReadError: unknown;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const chunk of lines) {
          const handshake = await processSSEChunk(chunk, callbacks, secureSession, streamState);
          if (handshake?.kind === "generation_queued") {
            await handleQueuedHandshake(handshake);
            return;
          }
        }
      }

      if (buffer.trim()) {
        const handshake = await processSSEChunk(buffer, callbacks, secureSession, streamState);
        if (handshake?.kind === "generation_queued") {
          await handleQueuedHandshake(handshake);
          return;
        }
      }
    } catch (err) {
      sseReadError = err;
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // already released or stream not locked
      }
    }

    if (sseReadError !== undefined) {
      const err = sseReadError;
      const isAbort =
        Boolean(signal?.aborted) ||
        (err instanceof DOMException && err.name === "AbortError") ||
        (err instanceof Error && err.name === "AbortError");
      if (isAbort) {
        callbacks.onError("已取消");
        return;
      }
      const recoveryProjectId = options?.projectId ?? options?.retryProjectId;
      if (recoveryProjectId && !signal?.aborted) {
        const recovered = await recoverAfterSseDisconnected(recoveryProjectId, callbacks, signal);
        if (recovered) return;
      }
      const detail = err instanceof Error ? err.message : String(err);
      callbacks.onError(
        `实时连接中断${detail ? `（${detail}）` : ""}。若刚确认过需求，后台可能仍在生成；请刷新页面或稍后查看项目列表。`
      );
      return;
    }
  } else if (contentType.includes("application/json")) {
    const raw = await res.json().catch(() => ({})) as {
      ok?: boolean;
      projectId?: string;
      error?: string;
      code?: string;
    };
    if (!res.ok) {
      callbacks.onError(typeof raw.error === "string" ? raw.error : `HTTP ${res.status}`);
      return;
    }
    if (typeof raw.projectId === "string" && raw.ok === true) {
      await waitForBackgroundGeneration(raw.projectId, callbacks, signal);
      return;
    }
    if ("error" in raw && raw.error) {
      callbacks.onError(String(raw.error));
      return;
    }
    callbacks.onDone(raw as unknown as AiResponse);
  }
}

export async function clearTemplate(): Promise<void> {
  const res = await fetch("/api/clear-template", { method: "POST" });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
}
