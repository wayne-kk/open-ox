"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { runBuildSite } from "../lib/build-studio-api";
import type { AiResponse, BuildStep, IntentAgentTurn, IntentProgressEvent } from "../types/build-studio";
import { stripRecoverablePrefixForDisplay } from "@/lib/generationRecovery";
import {
  createAgentStreamClientSession,
  decodeAgentSseJsonLine,
  isSecureAgentStreamSupported,
  type AgentStreamClientSession,
} from "@/lib/transport/agentStream.client";
import { parseSseDataLine } from "@/lib/transport/agentStreamSse";
import { trackEvent } from "@/lib/analytics/client";
import { toClientHistoryPayload } from "@/ai/flows/modify_project/history/modifyHistoryTurn";
import type { BoardRun, BoardTaskInput } from "@/lib/modify/boardRun/boardRunTypes";
import { isBoardRunBlocking } from "@/lib/modify/boardRun/isBoardRunBlocking";
import {
  buildVibeSelectUserMessage,
  type VibeDirection,
} from "@/lib/studio/vibeDirections";
import {
  evaluateStudioCapabilities,
  type StudioCapabilities,
  type StudioProjectLifecycleStatus,
} from "@/lib/studio/capabilities";

function trackPreviewOpen(projectId: string) {
  trackEvent("preview_open", { projectId, path: "/studio" });
}

function projectNameFromBuildResult(result: {
  blueprint?: { brief?: { projectTitle?: string } } | null;
}): string | null {
  const title = result.blueprint?.brief?.projectTitle;
  return typeof title === "string" && title.trim() ? title.trim() : null;
}

function lifecycleFromBuildResult(result: AiResponse): StudioProjectLifecycleStatus {
  const turn = result.intentAgent;
  if (
    turn &&
    turn.status !== "commit_generate" &&
    !(result.buildSteps?.length)
  ) {
    return "awaiting_input";
  }
  if (result.verificationStatus || (result.generatedFiles?.length ?? 0) > 0 || result.blueprint) {
    return "ready";
  }
  if (result.error) return "failed";
  return "ready";
}

function hasOperableArtifactFromResponse(response: AiResponse | null): boolean {
  if (!response) return false;
  return Boolean(
    response.verificationStatus ||
      (response.generatedFiles?.length ?? 0) > 0 ||
      (response.blueprint && (response.buildSteps?.length ?? 0) > 0)
  );
}

export type RightPanel = "topology" | "preview" | "code";

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
  image?: string | null;
  plan: ModifyPlan | null;
  steps: ModifyStep[];
  diffs: ModifyDiff[];
  toolCalls: ModifyToolCall[];
  thinking: string[];
  error: string | null;
  completedAt: string;
  isSystemMessage?: boolean;
  /** From intent router SSE — 对话 / 问答 / 规划 / 修改 */
  intentLabel?: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** User-attached screenshot (data URL) shown in the conversation stream */
  imageDataUrl?: string | null;
  intentPayload?: IntentAgentTurn["yieldPayload"];
  /** Snapshot of tool/reasoning steps for this assistant turn (session only). */
  activityLog?: IntentProgressEvent[];
}

export interface BuildStudioState {
  // Build
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  clearing: boolean;
  response: AiResponse | null;
  intentAgent: IntentAgentTurn | null;
  mergedBrief: string | null;
  conversationMessages: ConversationMessage[];
  /** Live intent-agent progress for the in-flight turn (cleared when the turn completes). */
  intentProgressLog: IntentProgressEvent[];
  /** Bumps when the user sends build/modify input so the conversation pane can scroll it into view. */
  userInputScrollNonce: number;
  lastRunInput: string | null;
  elapsed: number;
  flowStart: number;
  handleRun: (messageOverride?: string, vibe?: VibeDirection | null) => Promise<void>;
  /**
   * Early vibe pick (on options/clarify). Stores direction for later generate;
   * does not force commit.
   */
  handleConfirmVibe: (vibe: VibeDirection) => Promise<void>;
  /** Skip early vibe picker; style inferred downstream. */
  handleSkipVibe: () => Promise<void>;
  /** Direction-lock panel: confirm vibe + SiteOutline and enqueue generate. */
  handleConfirmDirection: (payload: {
    vibe: VibeDirection;
    outline: import("@/lib/studio/siteOutline").SiteOutline;
  }) => Promise<void>;
  /** True after user selected or skipped vibe — hide the early picker. */
  vibeResolved: boolean;
  /** Locked vibe for the next commit_generate, if any. */
  confirmedVibe: VibeDirection | null;
  handleClear: () => Promise<void>;
  handleRetry: () => Promise<void>;
  /** Generation poll shows no SSE for a while — user can unlock as interrupted */
  generationSeemsStuck: boolean;
  recoveryUnlocking: boolean;
  handleUnlockInterruptedGeneration: () => Promise<void>;
  /** After unlock / recoverable failed: resume preserving checkpoint */
  handleContinueFromCheckpoint: () => Promise<void>;

  /** Pasted screenshot for intent / generate dialogue (Studio). */
  intentImage: string | null;
  setIntentImage: (v: string | null) => void;

  // Model
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  selectedEffortTier: "fast" | "balanced" | "deep";
  setSelectedEffortTier: (t: "fast" | "balanced" | "deep") => void;
  availableModels: Array<{ id: string; displayName: string }>;

  // Project
  projectId: string | null;
  setProjectId: (id: string | null) => void;
  projectLoading: boolean;
  /** True when GET /api/projects/:id returned 404 (deleted / missing). */
  projectNotFound: boolean;
  /** DB display name (synced from blueprint title after generate). */
  projectName: string | null;
  /** Remix lineage snapshots (display only). */
  remixedFromTitle: string | null;
  remixedFromOwnerUsername: string | null;

  // Right panel toggle
  rightPanel: RightPanel;
  setRightPanel: (p: RightPanel) => void;

  // Preview
  previewUrl: string | null;
  previewState: "idle" | "starting" | "ready" | "error";
  previewError: string | null;
  previewVersion: number;
  /** From preview API: local | storage | e2b */
  previewBackend: "local" | "storage" | "e2b" | null;
  /** local next-dev + Direct env — show floating Direct editor / allow PATCH */
  directEditCapable: boolean;
  startPreview: () => Promise<void>;
  rebuildPreview: () => Promise<void>;
  /** After Design Mode direct patch — refresh iframe without full rebuild when possible. */
  bumpPreviewAfterDirectPatch: (url?: string | null) => void;
  /** After generate/retry (and optionally modify), switch to Preview and start/rebuild dev server */
  autoPreviewAfterBuild: boolean;
  setAutoPreviewAfterBuild: (v: boolean) => void;

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
  modifyIntentLabel: string;
  handleModify: (instructionOverride?: string) => Promise<void>;
  setOnBeforeModifySend: (fn: (() => string | null) | null) => void;
  setOnAfterModifySend: (fn: (() => void) | null) => void;
  clearModifyHistory: () => void;
  modifyHistory: ModifyRecord[];
  pendingModifyInstruction: string | null;
  pendingModifyImage: string | null;
  /** Active proposed/confirmed BoardRun for task-slice Modify (v0.1). */
  proposedBoardRun: BoardRun | null;
  boardRunBusy: boolean;
  boardDraining: boolean;
  reviseProposedBoard: (tasks: BoardTaskInput[]) => Promise<void>;
  confirmProposedBoard: (tasks: BoardTaskInput[]) => Promise<void>;
  declineProposedBoard: () => Promise<void>;
  forceSplitIntoTasks: () => Promise<void>;
  pauseBoardQueue: () => Promise<void>;
  continueBoardQueue: () => Promise<void>;
  cancelBoardRemaining: () => Promise<void>;
  retryBoardTask: (taskId: string) => Promise<void>;
  skipBoardTask: (taskId: string) => Promise<void>;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** Bumped when modify writes workspace files — CODE panel refreshes clean tabs. */
  codeWorkspaceEpoch: number;

  /** Persisted project lifecycle (awaiting_input | generating | ready | failed). */
  projectStatus: StudioProjectLifecycleStatus | null;
  /** Studio interaction gate (code/preview/deploy/…). */
  capabilities: StudioCapabilities;
}

const AUTO_PREVIEW_STORAGE_KEY = "open-ox:studio:autoPreviewAfterBuild";
const CONVERSATION_STORAGE_PREFIX = "open-ox:studio:conversation:";

function modifyIntentLabelToCategory(
  label?: string
): "conversation" | "read_only" | "plan_only" | "code_change" | undefined {
  switch (label) {
    case "对话":
      return "conversation";
    case "问答":
      return "read_only";
    case "规划":
      return "plan_only";
    case "修改":
      return "code_change";
    default:
      return undefined;
  }
}

function modifyIntentCategoryToLabel(
  category?: "conversation" | "read_only" | "plan_only" | "code_change"
): string | undefined {
  switch (category) {
    case "conversation":
      return "对话";
    case "read_only":
      return "问答";
    case "plan_only":
      return "规划";
    case "code_change":
      return "修改";
    default:
      return undefined;
  }
}

/** Polling DB while status is `generating` — after this duration with no SSE, offer recovery UX */
const GENERATION_POLL_STUCK_MS = 90_000;

function readAutoPreviewAfterBuild(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(AUTO_PREVIEW_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function conversationStorageKey(projectId: string): string {
  return `${CONVERSATION_STORAGE_PREFIX}${projectId}`;
}

function intentAssistantContent(turn: IntentAgentTurn | null | undefined): string {
  return (
    turn?.yieldPayload?.message ??
    turn?.assistantText ??
    turn?.errorMessage ??
    ""
  ).trim();
}

function shouldAppendIntentAssistant(turn: IntentAgentTurn | null | undefined): boolean {
  if (!turn) return false;
  if (turn.status === "commit_generate") return false;
  return intentAssistantContent(turn).length > 0;
}

/** Strip server-persisted trace appendix from intent_agent build step detail. */
function intentDetailUserFacing(detail: string | undefined): string {
  if (!detail?.trim()) return "";
  return detail.split("\n\n--- 意向分析轨迹 ---")[0]?.trim() ?? detail.trim();
}

function yieldPayloadFromIntentBuildStep(
  step: BuildStep
): IntentAgentTurn["yieldPayload"] | undefined {
  const output = step.trace?.output as Record<string, unknown> | undefined;
  const raw = output?.yieldPayload;
  if (!raw || typeof raw !== "object") return undefined;
  const payload = raw as Record<string, unknown>;
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!message) return undefined;
  const kindRaw = payload.kind;
  const kind =
    kindRaw === "capability" ||
    kindRaw === "clarify" ||
    kindRaw === "options" ||
    kindRaw === "confirm_brief" ||
    kindRaw === "confirm_direction"
      ? kindRaw
      : "clarify";
  const suggestedReplies = Array.isArray(payload.suggestedReplies)
    ? payload.suggestedReplies.filter((r): r is string => typeof r === "string")
    : [];
  const optionsRaw = Array.isArray(payload.options) ? payload.options : [];
  const options = optionsRaw
    .filter((o): o is { id: string; label: string; hint?: string } => {
      if (!o || typeof o !== "object") return false;
      const row = o as Record<string, unknown>;
      return typeof row.id === "string" && typeof row.label === "string";
    })
    .map((o) => ({
      id: o.id,
      label: o.label,
      ...(typeof o.hint === "string" && o.hint.trim() ? { hint: o.hint.trim() } : {}),
    }));
  const briefDraftMarkdown =
    typeof payload.briefDraftMarkdown === "string" && payload.briefDraftMarkdown.trim()
      ? payload.briefDraftMarkdown.trim()
      : undefined;
  const siteOutline =
    payload.siteOutline && typeof payload.siteOutline === "object"
      ? (payload.siteOutline as IntentAgentTurn["yieldPayload"] extends { siteOutline?: infer S }
          ? S
          : never)
      : undefined;
  return {
    kind,
    message,
    suggestedReplies,
    options,
    ...(briefDraftMarkdown ? { briefDraftMarkdown } : {}),
    ...(siteOutline ? { siteOutline } : {}),
  };
}

function readStoredConversationMessages(projectId: string): ConversationMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(conversationStorageKey(projectId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ConversationMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (message): message is ConversationMessage =>
          Boolean(message) &&
          typeof message.id === "string" &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          (message.imageDataUrl === undefined ||
            message.imageDataUrl === null ||
            typeof message.imageDataUrl === "string")
      )
      .slice(-50);
  } catch {
    return [];
  }
}

function writeStoredConversationMessages(projectId: string, messages: ConversationMessage[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(conversationStorageKey(projectId), JSON.stringify(messages.slice(-50)));
  } catch {
    /* ignore quota / private mode */
  }
}

// ---------------------------------------------------------------------------
// Architecture: Single Source of Truth for buildSteps
//
// During generation (SSE stream active):
//   SSE is the SOLE source of step data. No DB polling, no DB reads.
//   The backend does NOT write intermediate steps to DB — only the final
//   result is persisted via updateProjectStatus when generation completes.
//
// After generation / page reload:
//   DB is the SOLE source. If the project status is "ready" or "failed",
//   we load once from DB. If "generating" (another tab is running it),
//   we poll DB every 3s until it finishes.
//
// This eliminates the dual-source race condition that caused steps to
// flip back to "active" after reaching "ok".
// ---------------------------------------------------------------------------

export function useBuildStudio(initialProjectId?: string | null, initialPrompt?: string | null): BuildStudioState {
  const [input, setInput] = useState(initialPrompt ?? "");
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [response, setResponse] = useState<AiResponse | null>(null);
  const [intentAgent, setIntentAgent] = useState<IntentAgentTurn | null>(null);
  const [mergedBrief, setMergedBrief] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [intentProgressLog, setIntentProgressLog] = useState<IntentProgressEvent[]>([]);
  const intentProgressLogRef = useRef<IntentProgressEvent[]>([]);
  const [userInputScrollNonce, setUserInputScrollNonce] = useState(0);
  const [lastRunInput, setLastRunInput] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [selectedModel, setSelectedModel] = useState("gemini-3-flash-preview");
  const [selectedEffortTier, setSelectedEffortTier] = useState<"fast" | "balanced" | "deep">(
    "balanced"
  );

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
  const [projectNotFound, setProjectNotFound] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<StudioProjectLifecycleStatus | null>(null);
  const [hasStaticPreview, setHasStaticPreview] = useState(false);
  const [remixedFromTitle, setRemixedFromTitle] = useState<string | null>(null);
  const [remixedFromOwnerUsername, setRemixedFromOwnerUsername] = useState<string | null>(null);
  const [confirmedVibe, setConfirmedVibe] = useState<VibeDirection | null>(null);
  const [vibeResolved, setVibeResolved] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>("topology");

  const [autoPreviewAfterBuild, setAutoPreviewAfterBuildState] = useState(true);
  const autoPreviewAfterBuildRef = useRef(true);

  useEffect(() => {
    const v = readAutoPreviewAfterBuild();
    autoPreviewAfterBuildRef.current = v;
    setAutoPreviewAfterBuildState(v);
  }, []);

  const setAutoPreviewAfterBuild = useCallback((next: boolean) => {
    autoPreviewAfterBuildRef.current = next;
    setAutoPreviewAfterBuildState(next);
    try {
      localStorage.setItem(AUTO_PREVIEW_STORAGE_KEY, next ? "true" : "false");
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "starting" | "ready" | "error">("idle");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [previewBackend, setPreviewBackend] = useState<"local" | "storage" | "e2b" | null>(null);
  const [directEditCapable, setDirectEditCapable] = useState(false);

  const [modifyInstruction, setModifyInstruction] = useState("");
  const [modifyImage, setModifyImage] = useState<string | null>(null);
  const [intentImage, setIntentImage] = useState<string | null>(null);
  const [modifying, setModifying] = useState(false);
  const [codeWorkspaceEpoch, setCodeWorkspaceEpoch] = useState(0);
  const [modifySteps, setModifySteps] = useState<ModifyStep[]>([]);
  const [modifyPlan, setModifyPlan] = useState<ModifyPlan | null>(null);
  const [modifyDiffs, setModifyDiffs] = useState<ModifyDiff[]>([]);
  const [modifyToolCalls, setModifyToolCalls] = useState<ModifyToolCall[]>([]);
  const [modifyThinking, setModifyThinking] = useState<string[]>([]);
  const [modifyIntentLabel, setModifyIntentLabel] = useState("修改");
  const [modifyError, setModifyError] = useState<string | null>(null);
  const [modifyHistory, setModifyHistory] = useState<ModifyRecord[]>([]);
  const [proposedBoardRun, setProposedBoardRun] = useState<BoardRun | null>(null);
  const [boardRunBusy, setBoardRunBusy] = useState(false);
  const [boardDraining, setBoardDraining] = useState(false);
  const modifyForceBoardRef = useRef(false);
  const modifyForceSingleRef = useRef(false);
  const boardDrainAbortRef = useRef(false);
  const [contextCleared, setContextCleared] = useState(false);
  const [pendingModifyInstruction, setPendingModifyInstruction] = useState<string | null>(null);
  const [pendingModifyImage, setPendingModifyImage] = useState<string | null>(null);
  const [generationSeemsStuck, setGenerationSeemsStuck] = useState(false);
  const [recoveryUnlocking, setRecoveryUnlocking] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const onBeforeModifySendRef = useRef<(() => string | null) | null>(null);
  const onAfterModifySendRef = useRef<(() => void) | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewStateRef = useRef<"idle" | "starting" | "ready" | "error">("idle");
  const rightPanelRef = useRef<RightPanel>("topology");
  const ensureAliveSeqRef = useRef(0);
  /** Monotonic id: responses from older preview fetches are ignored (avoids overlapping POST/PUT races). */
  const previewSessionRef = useRef(0);
  /** Throttle GET /preview health checks when switching back to the Preview tab. */
  const lastEnsureAliveAtRef = useRef(0);
  const projectIdFromGenerationRef = useRef<string | null>(null);
  const autoStartedRef = useRef(false);
  /** Mirrors `startedAt` for use inside SSE callbacks without stale closure gaps. */
  const startedAtRef = useRef<number | null>(null);
  const modifyStepsRef = useRef<ModifyStep[]>([]);
  const modifyPlanRef = useRef<ModifyPlan | null>(null);
  const modifyDiffsRef = useRef<ModifyDiff[]>([]);
  const modifyThinkingRef = useRef<string[]>([]);
  const modifyIntentLabelRef = useRef("修改");
  const modifyToolCallsRef = useRef<ModifyToolCall[]>([]);

  const finishBuildLiveState = useCallback((totalDuration?: number) => {
    if (typeof totalDuration === "number" && Number.isFinite(totalDuration) && totalDuration >= 0) {
      setElapsed(totalDuration);
    } else {
      const t0 = startedAtRef.current;
      if (typeof t0 === "number" && Number.isFinite(t0)) {
        const approx = Math.max(0, Date.now() - t0);
        setElapsed(approx);
      }
    }
    setLoading(false);
  }, []);

  const appendConversationMessage = useCallback(
    (message: Omit<ConversationMessage, "id">) => {
      setConversationMessages((prev) => {
        const last = prev[prev.length - 1];
        const sameActivity =
          JSON.stringify(last?.activityLog ?? []) === JSON.stringify(message.activityLog ?? []);
        const sameImage = (last?.imageDataUrl ?? null) === (message.imageDataUrl ?? null);
        if (
          last?.role === message.role &&
          last.content === message.content &&
          sameActivity &&
          sameImage
        ) {
          return prev;
        }
        return [
          ...prev,
          {
          ...message,
          id: `${Date.now()}-${prev.length}-${message.role}`,
          },
        ];
      });
    },
    []
  );

  useEffect(() => {
    if (!projectId || conversationMessages.length === 0) return;
    writeStoredConversationMessages(projectId, conversationMessages);
  }, [projectId, conversationMessages]);

  useEffect(() => {
    startedAtRef.current = startedAt;
  }, [startedAt]);

  // ── Elapsed timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (loading && startedAt) {
      timerRef.current = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading, startedAt]);

  useEffect(() => { return () => abortRef.current?.abort(); }, []);
  useEffect(() => { previewUrlRef.current = previewUrl; }, [previewUrl]);
  useEffect(() => { previewStateRef.current = previewState; }, [previewState]);
  useEffect(() => { rightPanelRef.current = rightPanel; }, [rightPanel]);

  // ── DB polling (only for "another tab is generating" scenario) ─────────
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generatingPollStartedAtRef = useRef<number | null>(null);
  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    generatingPollStartedAtRef.current = null;
  }, []);

  type ProjectData = {
    id: string; status: string; name?: string; userPrompt: string; modelId?: string;
    referenceImageDataUrl?: string | null;
    buildSteps?: unknown[]; generatedFiles?: string[]; blueprint?: unknown;
    verificationStatus?: string; logDirectory?: string; error?: string;
    totalDuration?: number;
    staticPreviewSyncedAt?: string | null;
    remixedFromTitle?: string | null;
    remixedFromOwnerUsername?: string | null;
    modificationHistory?: Array<{
      instruction: string; modifiedAt: string;
      intentCategory?: "conversation" | "read_only" | "plan_only" | "code_change";
      plan?: { analysis: string; changes: Array<{ path: string; action: string; reasoning: string }> };
      diffs?: Array<{ file: string; reasoning: string; patch: string; stats: { additions: number; deletions: number } }>;
      toolCalls?: Array<{ tool: string; args: Record<string, unknown>; result: string }>;
      thinking?: string[];
      image?: string | null;
      error?: string;
    }>;
  };

  function conversationFallbackFromDb(
    project: ProjectData,
    stored: ConversationMessage[]
  ): ConversationMessage[] {
    if (stored.length > 0) return stored;
    const steps = (project.buildSteps ?? []) as BuildStep[];
    const intentSteps = steps.filter((s) => s.step === "intent_agent");
    const messages: ConversationMessage[] = [];
    const up = project.userPrompt?.trim();
    const heroImage = project.referenceImageDataUrl?.trim() || null;
    if (up) {
      messages.push({
        id: `${project.id}-initial-user`,
        role: "user",
        content: project.userPrompt,
        ...(heroImage ? { imageDataUrl: heroImage } : {}),
      });
    } else if (heroImage) {
      messages.push({
        id: `${project.id}-initial-user-image`,
        role: "user",
        content: "（参考截图）",
        imageDataUrl: heroImage,
      });
    }
    intentSteps.forEach((step, i) => {
      const d = typeof step.detail === "string" ? step.detail.trim() : "";
      if (d) {
        messages.push({
          id: `${project.id}-ia-${typeof step.timestamp === "number" ? step.timestamp : i}`,
          role: "assistant",
          content: d,
        });
      }
    });
    if (intentSteps.length > 0 && project.status === "ready") {
      messages.push({
        id: `${project.id}-committed-line`,
        role: "assistant",
        content: "需求已确认，开始生成项目...",
      });
    }
    return messages;
  }

  const applyProjectData = useCallback((project: ProjectData) => {
    setLastRunInput(project.userPrompt ?? null);
    setProjectName(
      typeof project.name === "string" && project.name.trim() ? project.name.trim() : null
    );
    const lifecycle = project.status as StudioProjectLifecycleStatus;
    if (
      lifecycle === "awaiting_input" ||
      lifecycle === "generating" ||
      lifecycle === "ready" ||
      lifecycle === "failed"
    ) {
      setProjectStatus(lifecycle);
    }
    setHasStaticPreview(
      typeof project.staticPreviewSyncedAt === "string" &&
        project.staticPreviewSyncedAt.trim().length > 0
    );
    setRemixedFromTitle(
      typeof project.remixedFromTitle === "string" && project.remixedFromTitle.trim()
        ? project.remixedFromTitle.trim()
        : null
    );
    setRemixedFromOwnerUsername(
      typeof project.remixedFromOwnerUsername === "string" && project.remixedFromOwnerUsername.trim()
        ? project.remixedFromOwnerUsername.trim()
        : null
    );
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
        intentLabel: modifyIntentCategoryToLabel(r.intentCategory),
      })));
    }
    const restoredBuildSteps = (project.buildSteps ?? []) as import("../types/build-studio").BuildStep[];
    const restoredIntentStep = restoredBuildSteps.find((step) => step.step === "intent_agent");
    const storedConversation = readStoredConversationMessages(project.id);
    if (project.status === "awaiting_input" && restoredIntentStep) {
      const yieldFromStep = yieldPayloadFromIntentBuildStep(restoredIntentStep);
      const fallbackMessage =
        intentDetailUserFacing(restoredIntentStep.detail) ||
        "我还需要你补充或确认需求，然后再开始生成。";
      const restoredIntent: IntentAgentTurn = {
        status: restoredIntentStep.status === "error" ? "error" : "yield",
        yieldPayload: restoredIntentStep.status === "error"
          ? undefined
          : yieldFromStep ?? {
            kind: "clarify",
            message: fallbackMessage,
            suggestedReplies: [],
            options: [],
          },
        errorMessage: restoredIntentStep.status === "error" ? restoredIntentStep.detail : undefined,
      };
      setIntentAgent(restoredIntent);
      setConversationMessages(
        storedConversation.length > 0
          ? storedConversation
          : [
            ...(project.userPrompt?.trim() || project.referenceImageDataUrl?.trim()
              ? [
                  {
                    id: `${project.id}-initial-user`,
                    role: "user" as const,
                    content: project.userPrompt?.trim() ? project.userPrompt : "（参考截图）",
                    ...(project.referenceImageDataUrl?.trim()
                      ? { imageDataUrl: project.referenceImageDataUrl.trim() }
                      : {}),
                  },
                ]
              : []),
            {
              id: `${project.id}-awaiting-assistant`,
              role: "assistant" as const,
              content:
                restoredIntent.yieldPayload?.message ??
                restoredIntent.errorMessage ??
                "我还需要你补充或确认需求，然后再开始生成。",
              intentPayload: restoredIntent.yieldPayload,
            },
          ]
      );
    } else if (project.status !== "awaiting_input") {
      setIntentAgent(null);
      setConversationMessages(conversationFallbackFromDb(project, storedConversation));
    }
    setResponse({
      content: project.status === "ready"
        ? `项目已生成完成。${project.verificationStatus === "passed" ? "构建验证通过。" : ""}`
        : project.status === "failed"
          ? `项目生成失败：${(() => {
              const raw = project.error ?? "未知错误";
              return stripRecoverablePrefixForDisplay(raw) || raw;
            })()}`
          : project.status === "awaiting_input"
            ? "我还需要你补充或确认需求，然后再开始生成。"
            : "项目生成中...",
      projectId: project.id,
      verificationStatus: project.verificationStatus as "passed" | "failed" | undefined,
      blueprint: project.blueprint as import("../types/build-studio").AiResponse["blueprint"],
      buildSteps: restoredBuildSteps,
      generatedFiles: project.generatedFiles ?? [],
      logDirectory: project.logDirectory,
      buildTotalDuration: project.totalDuration,
      error: project.status === "failed" ? (project.error ?? "Generation failed") : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track whether this hook instance owns a live SSE stream.
  // When true, DB loads/polls must NOT overwrite response.buildSteps.
  const sseActiveRef = useRef(false);

  // ── Load project data on projectId change ──────────────────────────────
  useEffect(() => {
    setModifySteps([]);
    setModifyPlan(null);
    setModifyDiffs([]);
    setModifyError(null);
    stopPolling();

    if (!projectId) {
      setResponse(null);
      setLastRunInput(null);
      setProjectName(null);
      setProjectStatus(null);
      setHasStaticPreview(false);
      setIntentAgent(null);
      setConversationMessages([]);
      setConfirmedVibe(null);
      setVibeResolved(false);
      setPreviewUrl(null);
      setPreviewState("idle");
      setPreviewError(null);
      setGenerationSeemsStuck(false);
      setProjectNotFound(false);
      return;
    }

    setGenerationSeemsStuck(false);
    setProjectNotFound(false);
    setConfirmedVibe(null);
    setVibeResolved(false);

    // Same-tick handoff from SSE onDone: keep preview state — openPreviewAfterBuild is starting the dev server.
    if (projectIdFromGenerationRef.current === projectId) {
      projectIdFromGenerationRef.current = null;
      setProjectLoading(false);
      return;
    }

    setPreviewUrl(null);
    setPreviewState("idle");
    setPreviewError(null);

    fetch(`/api/projects/${projectId}`)
      .then((r) => {
        if (r.status === 404) {
          setProjectNotFound(true);
          setProjectLoading(false);
          setLoading(false);
          setResponse({
            content: "",
            error: "项目不存在或已删除",
            projectId,
          });
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((project: ProjectData | null) => {
        if (!project) { setProjectLoading(false); return; }

        // If SSE is actively streaming steps, don't overwrite with stale DB data
        if (sseActiveRef.current) {
          // Still apply non-step metadata (prompt, model, history)
          setLastRunInput(project.userPrompt ?? null);
          setProjectName(
            typeof project.name === "string" && project.name.trim() ? project.name.trim() : null
          );
          setRemixedFromTitle(
            typeof project.remixedFromTitle === "string" && project.remixedFromTitle.trim()
              ? project.remixedFromTitle.trim()
              : null
          );
          setRemixedFromOwnerUsername(
            typeof project.remixedFromOwnerUsername === "string" && project.remixedFromOwnerUsername.trim()
              ? project.remixedFromOwnerUsername.trim()
              : null
          );
          if (project.modelId) setSelectedModel(project.modelId);
          setProjectLoading(false);
          return;
        }

        applyProjectData(project);
        setProjectLoading(false);

        if (project.status === "generating") {
          // Another tab/session is generating this project.
          // Only poll if we don't own the SSE stream.
          if (!sseActiveRef.current) {
            setStartedAt((prev) => {
              if (prev != null) return prev;
              const tWatch = Date.now();
              startedAtRef.current = tWatch;
              return tWatch;
            });
            setElapsed(0);
            setLoading(true);
            generatingPollStartedAtRef.current = Date.now();
            setGenerationSeemsStuck(false);
            pollingRef.current = setInterval(async () => {
              // If SSE became active while polling, stop immediately
              if (sseActiveRef.current) { stopPolling(); setGenerationSeemsStuck(false); return; }
              const r2 = await fetch(`/api/projects/${projectId}`);
              if (!r2.ok) {
                // Project deleted / inaccessible — stop hammering the API
                stopPolling();
                setLoading(false);
                setGenerationSeemsStuck(false);
                setProjectLoading(false);
                if (r2.status === 404) {
                  setProjectNotFound(true);
                  setResponse({
                    content: "",
                    error: "项目不存在或已删除",
                    projectId,
                  });
                }
                return;
              }
              const updated: ProjectData = await r2.json();
              if (sseActiveRef.current) { stopPolling(); setGenerationSeemsStuck(false); return; }
              applyProjectData(updated);
              if (updated.status !== "generating") {
                stopPolling();
                setLoading(false);
                setGenerationSeemsStuck(false);
              } else if (!sseActiveRef.current) {
                const t0 = generatingPollStartedAtRef.current;
                if (t0 != null && Date.now() - t0 >= GENERATION_POLL_STUCK_MS) {
                  setGenerationSeemsStuck(true);
                  setLoading(false);
                }
              }
            }, 3000);
          }
        }
      })
      .catch(() => { setProjectLoading(false); });

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ── Auto-run on first visit to a freshly created project ───────────────
  useEffect(() => {
    if (initialProjectId && !autoStartedRef.current) {
      autoStartedRef.current = true;
      fetch(`/api/projects/${initialProjectId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((project: ProjectData | null) => {
          if (project?.status === "generating" && !(project.buildSteps?.length)) {
            void handleRun();
          }
        })
        .catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── SSE step handler ────────────────────────────────────────────────────
  // Simple upsert by step name. No anti-downgrade guards needed because
  // the SSE stream is the sole data source during generation — there's
  // nothing else writing to response.buildSteps concurrently.
  const handleStepEvent = useCallback((step: BuildStep) => {
    setResponse((prev) => {
      const existing = prev?.buildSteps ?? [];
      const idx = existing.findIndex((s) => s.step === step.step);
      const updated = idx >= 0
        ? [...existing.slice(0, idx), step, ...existing.slice(idx + 1)]
        : [...existing, step];
      return {
        content: prev?.content ?? "",
        projectId: prev?.projectId,
        intentAgent: prev?.intentAgent,
        mergedBrief: prev?.mergedBrief,
        generatedFiles: prev?.generatedFiles,
        verificationStatus: prev?.verificationStatus,
        unvalidatedFiles: prev?.unvalidatedFiles,
        installedDependencies: prev?.installedDependencies,
        dependencyInstallFailures: prev?.dependencyInstallFailures,
        buildTotalDuration: prev?.buildTotalDuration,
        logDirectory: prev?.logDirectory,
        buildSteps: updated,
      };
    });
  }, []);

  // ── handleRun ──────────────────────────────────────────────────────────
  async function handleRun(messageOverride?: string, vibe?: VibeDirection | null) {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    stopPolling(); // kill any leftover polling from a previous page-load
    sseActiveRef.current = true;

    const effectiveVibe = vibe ?? confirmedVibe;

    const t0 = Date.now();
    startedAtRef.current = t0;
    setStartedAt(t0);
    setElapsed(0);
    setLoading(true);
    setProjectStatus("generating");
    intentProgressLogRef.current = [];
    setIntentProgressLog([]);
    // Preserve existing buildSteps to avoid topology flash.
    // New SSE steps will upsert into the existing array.
    setResponse((prev) => prev
      ? { ...prev, content: "", error: undefined, verificationStatus: undefined }
      : null
    );
    setRightPanel("topology");
    setPreviewUrl(null);
    setPreviewState("idle");

    const capturedIntentImage = intentImage;
    const explicitInput = (messageOverride ?? input).trim();
    let textForApi = explicitInput;
    let displayPrompt = explicitInput;
    if (!textForApi && !capturedIntentImage && projectId) {
      try {
        const r = await fetch(`/api/projects/${projectId}`);
        if (r.ok) {
          const p = await r.json();
          const fromDb = (p.userPrompt ?? "").trim();
          textForApi = fromDb;
          displayPrompt = fromDb;
        }
      } catch {
        /* ignore */
      }
    }
    setLastRunInput(displayPrompt || (capturedIntentImage ? "（参考截图）" : null));
    if (explicitInput) {
      appendConversationMessage({
        role: "user",
        content: explicitInput,
        imageDataUrl: capturedIntentImage ?? undefined,
      });
      setInput("");
      setUserInputScrollNonce((nonce) => nonce + 1);
    } else if (displayPrompt && textForApi === displayPrompt) {
      // Hero → Studio auto-run: no typed input, but we still show the stored prompt in chat.
      appendConversationMessage({
        role: "user",
        content: displayPrompt,
        imageDataUrl: capturedIntentImage ?? undefined,
      });
      setUserInputScrollNonce((nonce) => nonce + 1);
    } else if (capturedIntentImage) {
      appendConversationMessage({
        role: "user",
        content: "（参考截图）",
        imageDataUrl: capturedIntentImage,
      });
      setUserInputScrollNonce((nonce) => nonce + 1);
    }

    try {
      // Guards against layered SSE fallbacks appending the same assistant bubble twice
      // (live `intent_agent_turn` vs `done`/`onDone` hydrate). activityLog often differs
      // across those paths, so content-only dedupe in appendConversationMessage is not enough.
      let intentAssistantAppended = false;
      await runBuildSite(
        textForApi,
        {
          onIntentProgress: (event) => {
            intentProgressLogRef.current = [...intentProgressLogRef.current, event];
            setIntentProgressLog(intentProgressLogRef.current);
          },
          onIntentTurn: (turn) => {
            setIntentAgent(turn);
            const activitySnapshot = intentProgressLogRef.current;
            intentProgressLogRef.current = [];
            setIntentProgressLog([]);
            // commit_generate: `onIntentCommit` appends the confirmation line.
            if (shouldAppendIntentAssistant(turn)) {
              intentAssistantAppended = true;
              appendConversationMessage({
                role: "assistant",
                content: intentAssistantContent(turn),
                intentPayload: turn.yieldPayload,
                activityLog: activitySnapshot.length > 0 ? activitySnapshot : undefined,
              });
            }
            setResponse((prev) => ({
              content:
                turn.yieldPayload?.message ??
                turn.assistantText ??
                turn.errorMessage ??
                prev?.content ??
                "",
              projectId: projectId ?? prev?.projectId ?? undefined,
              intentAgent: turn,
              mergedBrief: prev?.mergedBrief,
              buildSteps: prev?.buildSteps,
              generatedFiles: prev?.generatedFiles,
              verificationStatus: prev?.verificationStatus,
              logDirectory: prev?.logDirectory,
              error: turn.status === "error" ? turn.errorMessage : prev?.error,
            }));
          },
          onIntentCommit: (brief) => {
            const cleanBrief = brief.trim();
            setMergedBrief(cleanBrief || null);
            intentProgressLogRef.current = [];
            setIntentProgressLog([]);
            const commitLine = effectiveVibe
              ? `需求已确认，按「${effectiveVibe.label}」气质开始生成项目...`
              : "需求已确认，开始生成项目...";
            appendConversationMessage({
              role: "assistant",
              content: commitLine,
            });
            const queuedStep: BuildStep = {
              step: "generation_queued",
              status: "ok",
              detail: effectiveVibe
                ? `生成任务已排队（气质：${effectiveVibe.label}）…`
                : "生成任务已排队，正在启动分析…",
              timestamp: Date.now(),
              duration: 0,
            };
            setResponse((prev) => ({
              content: commitLine,
              projectId: projectId ?? prev?.projectId ?? undefined,
              intentAgent: prev?.intentAgent,
              mergedBrief: cleanBrief || prev?.mergedBrief,
              buildSteps: [...(prev?.buildSteps ?? []).filter((s) => s.step !== "generation_queued"), queuedStep],
            }));
          },
          onStep: handleStepEvent,
          onDone: (result) => {
            const turn = result.intentAgent ?? null;
            // Last-resort hydrate only if neither live turn nor done→onIntentTurn appended.
            if (!intentAssistantAppended && shouldAppendIntentAssistant(turn)) {
              appendConversationMessage({
                role: "assistant",
                content: intentAssistantContent(turn),
                intentPayload: turn?.yieldPayload,
              });
            }
            finishBuildLiveState(result.buildTotalDuration);
            setIntentAgent(turn);
            setMergedBrief(result.mergedBriefFromAgent ?? result.mergedBrief ?? null);
            setProjectStatus(lifecycleFromBuildResult(result));
            // done payload carries the authoritative final buildSteps from the server.
            // This replaces whatever the SSE stream built up, ensuring consistency.
            setResponse((prev) => ({ ...result, buildSteps: result.buildSteps ?? prev?.buildSteps }));
            if (result.intentAgent && !result.buildSteps?.length) {
              setInput("");
            }
            const titled = projectNameFromBuildResult(result);
            if (titled) setProjectName(titled);
            const nextProjectId = result.projectId ?? projectId ?? null;
            if (nextProjectId) {
              projectIdFromGenerationRef.current = nextProjectId;
              setProjectId(nextProjectId);
              if (autoPreviewAfterBuildRef.current && result.verificationStatus === "passed") {
                // force: avoid joining a mid-gen stub static sync (default page.tsx export).
                void openPreviewAfterBuild(nextProjectId, true);
              }
            }
          },
          onNotice: (msg) => {
            appendConversationMessage({ role: "assistant", content: msg });
          },
          onError: (msg) => {
            finishBuildLiveState();
            if (msg === "已取消" || msg === "Aborted") {
              return;
            }
            setProjectStatus("failed");
            appendConversationMessage({ role: "assistant", content: `流程出错：${msg}` });
            setResponse({ content: "", error: msg });
          },
        },
        abortRef.current.signal,
        {
          model: selectedModel,
          effortTier: selectedEffortTier,
          ...(projectId ? { projectId } : {}),
          ...(capturedIntentImage ? { imageBase64: capturedIntentImage } : {}),
          ...(effectiveVibe
            ? {
                styleGuide: effectiveVibe.styleGuide,
                confirmedDesignDirectionMarkdown: effectiveVibe.designIntentMarkdown,
                confirmedDesignDirectionKeywords: effectiveVibe.technicalKeywords,
              }
            : {}),
        }
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const message = err instanceof Error ? err.message : String(err);
        appendConversationMessage({ role: "assistant", content: `流程出错：${message}` });
        setResponse({ content: "", error: message });
      }
    } finally {
      sseActiveRef.current = false;
      if (capturedIntentImage) setIntentImage(null);
      // Loading is usually stopped by onDone/onError to avoid UI lag after final SSE event.
      setLoading(false);
    }
  }

  async function handleConfirmVibe(vibe: VibeDirection) {
    setConfirmedVibe(vibe);
    setVibeResolved(true);
    await handleRun(buildVibeSelectUserMessage(vibe), vibe);
  }

  async function handleSkipVibe() {
    setConfirmedVibe(null);
    setVibeResolved(true);
    await handleRun("跳过气质选择，视觉方向由系统根据需求推断。");
  }

  async function handleConfirmDirection(payload: {
    vibe: VibeDirection;
    outline: import("@/lib/studio/siteOutline").SiteOutline;
    briefMarkdown?: string;
  }) {
    const { vibe, outline, briefMarkdown } = payload;
    setConfirmedVibe(vibe);
    setVibeResolved(true);
    if (!projectId || loading) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    stopPolling();
    sseActiveRef.current = true;

    const t0 = Date.now();
    startedAtRef.current = t0;
    setStartedAt(t0);
    setElapsed(0);
    setLoading(true);
    setProjectStatus("generating");
    setRightPanel("topology");
    setPreviewUrl(null);
    setPreviewState("idle");
    appendConversationMessage({
      role: "user",
      content: `确认气质与结构并生成：${vibe.label}；${outline.modules.length} 个模块。`,
    });

    const mergedBrief =
      (briefMarkdown && briefMarkdown.trim()) ||
      lastRunInput?.trim() ||
      `单页站点：${vibe.label}。模块：${outline.modules.map((m) => m.title).join("、")}。`;

    try {
      await runBuildSite(
        "确认气质与结构并生成",
        {
          onStep: (step) => {
            setResponse((prev) => ({
              content: prev?.content ?? "",
              buildSteps: [...(prev?.buildSteps ?? []), step],
              generatedFiles: prev?.generatedFiles,
            }));
          },
          onIntentCommit: () => {
            appendConversationMessage({
              role: "assistant",
              content: "气质与结构已确认，开始生成。",
            });
          },
          onDone: (result) => {
            finishBuildLiveState();
            setProjectStatus(
              result.verificationStatus === "passed" ? "ready" : result.error ? "failed" : "ready"
            );
            setResponse((prev) => ({
              ...prev,
              content: result.content ?? prev?.content ?? "",
              projectId: result.projectId ?? projectId ?? undefined,
              verificationStatus: result.verificationStatus,
              generatedFiles: result.generatedFiles ?? prev?.generatedFiles,
              error: result.error,
            }));
            const nextProjectId = result.projectId ?? projectId ?? null;
            if (nextProjectId) {
              projectIdFromGenerationRef.current = nextProjectId;
              setProjectId(nextProjectId);
              if (autoPreviewAfterBuildRef.current && result.verificationStatus === "passed") {
                void openPreviewAfterBuild(nextProjectId, true);
              }
            }
          },
          onNotice: (msg) => {
            appendConversationMessage({ role: "assistant", content: msg });
          },
          onError: (msg) => {
            finishBuildLiveState();
            if (msg === "已取消" || msg === "Aborted") return;
            setProjectStatus("failed");
            appendConversationMessage({ role: "assistant", content: `流程出错：${msg}` });
            setResponse({ content: "", error: msg });
          },
        },
        abortRef.current.signal,
        {
          model: selectedModel,
          effortTier: selectedEffortTier,
          projectId,
          styleGuide: vibe.styleGuide,
          confirmedDesignDirectionMarkdown: vibe.designIntentMarkdown,
          confirmedDesignDirectionKeywords: vibe.technicalKeywords,
          confirmedSiteOutline: outline,
          confirmedLayoutVariantId: vibe.layoutVariantId,
          forceDirectionLockCommit: true,
          mergedBrief,
        }
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const message = err instanceof Error ? err.message : String(err);
        appendConversationMessage({ role: "assistant", content: `流程出错：${message}` });
        setResponse({ content: "", error: message });
      }
    } finally {
      sseActiveRef.current = false;
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

  // ── handleRetry ────────────────────────────────────────────────────────
  async function handleRetry() {
    if (!projectId || loading || recoveryUnlocking) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    stopPolling();
    sseActiveRef.current = true;

    const t0 = Date.now();
    startedAtRef.current = t0;
    setStartedAt(t0);
    setElapsed(0);
    setLoading(true);
    setProjectStatus("generating");
    // Clear steps for retry — user explicitly wants a fresh run
    setResponse((prev) => ({
      content: "",
      buildSteps: [],
      generatedFiles: prev?.generatedFiles,
      verificationStatus: undefined,
      logDirectory: undefined,
    }));
    setRightPanel("topology");
    setPreviewUrl(null);
    setPreviewState("idle");

    const retryId = projectId;

    try {
      await runBuildSite(
        "",
        {
          onStep: handleStepEvent,
          onDone: (result) => {
            finishBuildLiveState(result.buildTotalDuration);
            setProjectStatus(lifecycleFromBuildResult(result));
            setResponse((prev) => ({ ...result, buildSteps: result.buildSteps ?? prev?.buildSteps }));
            const titled = projectNameFromBuildResult(result);
            if (titled) setProjectName(titled);
            const nextProjectId = result.projectId ?? retryId;
            if (nextProjectId) {
              projectIdFromGenerationRef.current = nextProjectId;
              setProjectId(nextProjectId);
              if (autoPreviewAfterBuildRef.current && result.verificationStatus === "passed") {
                // force: avoid joining a mid-gen stub static sync (default page.tsx export).
                void openPreviewAfterBuild(nextProjectId, true);
              }
            }
          },
          onNotice: (msg) => {
            appendConversationMessage({ role: "assistant", content: msg });
          },
          onError: (msg) => {
            finishBuildLiveState();
            if (msg === "已取消" || msg === "Aborted") {
              return;
            }
            setProjectStatus("failed");
            setResponse({ content: "", error: msg });
          },
        },
        abortRef.current.signal,
        {
          model: selectedModel,
          effortTier: selectedEffortTier,
          retryProjectId: retryId,
        }
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setResponse({ content: "", error: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      sseActiveRef.current = false;
      // Loading is usually stopped by onDone/onError to avoid UI lag after final SSE event.
      setLoading(false);
    }
  }

  async function handleUnlockInterruptedGeneration() {
    if (!projectId || recoveryUnlocking || !generationSeemsStuck) return;
    setRecoveryUnlocking(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/recovery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock_stuck" }),
      });
      const payload = (await res.json().catch(() => ({}))) as ProjectData & { error?: string };
      if (!res.ok) {
        const msg =
          typeof payload.error === "string" ? payload.error : `HTTP ${res.status}`;
        appendConversationMessage({
          role: "assistant",
          content: `无法标记中断：${msg}`,
        });
        return;
      }
      stopPolling();
      setGenerationSeemsStuck(false);
      setLoading(false);
      applyProjectData(payload as ProjectData);
      appendConversationMessage({
        role: "assistant",
        content:
          "已标记为中断。可选「继续生成」从检查点恢复，或「重新生成」从头开始（会清空当前构建进度）。",
      });
    } finally {
      setRecoveryUnlocking(false);
    }
  }

  async function handleContinueFromCheckpoint() {
    if (!projectId || loading || recoveryUnlocking) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    stopPolling();
    sseActiveRef.current = true;

    const t0 = Date.now();
    startedAtRef.current = t0;
    setStartedAt(t0);
    setElapsed(0);
    setLoading(true);
    setProjectStatus("generating");
    setGenerationSeemsStuck(false);
    setResponse((prev) =>
      prev
        ? {
            ...prev,
            content: "",
            error: undefined,
            verificationStatus: undefined,
          }
        : null
    );
    setRightPanel("topology");
    setPreviewUrl(null);
    setPreviewState("idle");

    const retryId = projectId;

    try {
      await runBuildSite(
        "",
        {
          onStep: handleStepEvent,
          onDone: (result) => {
            finishBuildLiveState(result.buildTotalDuration);
            setProjectStatus(lifecycleFromBuildResult(result));
            setResponse((prev) => ({ ...result, buildSteps: result.buildSteps ?? prev?.buildSteps }));
            const titled = projectNameFromBuildResult(result);
            if (titled) setProjectName(titled);
            const nextProjectId = result.projectId ?? retryId;
            if (nextProjectId) {
              projectIdFromGenerationRef.current = nextProjectId;
              setProjectId(nextProjectId);
              if (autoPreviewAfterBuildRef.current && result.verificationStatus === "passed") {
                // force: avoid joining a mid-gen stub static sync (default page.tsx export).
                void openPreviewAfterBuild(nextProjectId, true);
              }
            }
          },
          onNotice: (msg) => {
            appendConversationMessage({ role: "assistant", content: msg });
          },
          onError: (msg) => {
            finishBuildLiveState();
            if (msg === "已取消" || msg === "Aborted") {
              return;
            }
            setProjectStatus("failed");
            appendConversationMessage({ role: "assistant", content: `流程出错：${msg}` });
            setResponse({ content: "", error: msg });
          },
        },
        abortRef.current.signal,
        {
          model: selectedModel,
          effortTier: selectedEffortTier,
          retryProjectId: retryId,
          resumeFromCheckpoint: true,
        }
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const message = err instanceof Error ? err.message : String(err);
        appendConversationMessage({ role: "assistant", content: `流程出错：${message}` });
        setResponse({ content: "", error: message });
      }
    } finally {
      sseActiveRef.current = false;
      setLoading(false);
    }
  }

  const applyPreviewMeta = useCallback((data: {
    url?: string;
    previewBackend?: string;
    directEditCapable?: boolean;
  }) => {
    if (data.previewBackend === "local" || data.previewBackend === "storage" || data.previewBackend === "e2b") {
      setPreviewBackend(data.previewBackend);
    }
    if (typeof data.directEditCapable === "boolean") {
      setDirectEditCapable(data.directEditCapable);
    }
  }, []);

  const setOnBeforeModifySend = useCallback((fn: (() => string | null) | null) => {
    onBeforeModifySendRef.current = fn;
  }, []);

  const setOnAfterModifySend = useCallback((fn: (() => void) | null) => {
    onAfterModifySendRef.current = fn;
  }, []);

  // ── Preview ──────────────────────────────────────────────────────────
  const startPreview = useCallback(async () => {
    if (!projectId) return;
    const session = ++previewSessionRef.current;
    lastEnsureAliveAtRef.current = 0;
    setPreviewUrl(null);
    setPreviewState("starting");
    setPreviewError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/preview`, { method: "POST" });
      if (session !== previewSessionRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (session !== previewSessionRef.current) return;
        applyPreviewMeta(data);
        setPreviewUrl(data.url);
        setPreviewVersion((v) => v + 1);
        setPreviewState("ready");
        trackPreviewOpen(projectId);
      } else {
        const err = await res.json().catch(() => ({}));
        if (session !== previewSessionRef.current) return;
        setPreviewError(err.error ?? `HTTP ${res.status}`);
        setPreviewState("error");
      }
    } catch (e) {
      if (session !== previewSessionRef.current) return;
      setPreviewError(e instanceof Error ? e.message : "Network error");
      setPreviewState("error");
    }
  }, [applyPreviewMeta, projectId]);

  const rebuildPreview = useCallback(async () => {
    if (!projectId) return;
    const session = ++previewSessionRef.current;
    lastEnsureAliveAtRef.current = 0;
    setPreviewUrl(null);
    setPreviewState("starting");
    setPreviewError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/preview`, { method: "PUT" });
      if (session !== previewSessionRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (session !== previewSessionRef.current) return;
        applyPreviewMeta(data);
        setPreviewUrl(data.url);
        setPreviewVersion((v) => v + 1);
        setPreviewState("ready");
        trackPreviewOpen(projectId);
      } else {
        const err = await res.json().catch(() => ({}));
        if (session !== previewSessionRef.current) return;
        setPreviewError(err.error ?? `HTTP ${res.status}`);
        setPreviewState("error");
      }
    } catch (e) {
      if (session !== previewSessionRef.current) return;
      setPreviewError(e instanceof Error ? e.message : "Network error");
      setPreviewState("error");
    }
  }, [applyPreviewMeta, projectId]);

  const bumpPreviewAfterDirectPatch = useCallback((url?: string | null) => {
    if (url) {
      setPreviewUrl((prev) => (prev === url ? prev : url));
    }
    // Do not bump previewVersion here. Remounting the iframe races next compile and
    // flashes the pre-edit UI (looks like Apply failed). Design Mode COMMIT_PREVIEW
    // keeps the live DOM correct; local next HMR applies the written source in place.
  }, []);

  const openPreviewAfterBuild = useCallback(
    async (targetProjectId: string, forceRebuild = false) => {
      const session = ++previewSessionRef.current;
      lastEnsureAliveAtRef.current = 0;
      setRightPanel("preview");
      setPreviewState("starting");
      setPreviewError(null);
      setPreviewUrl(null);

      // First auto-preview can race the last home-page write / Storage restore.
      // Retry quietly when the server soft-skips because page.tsx is still the stub.
      const maxAttempts = forceRebuild ? 4 : 1;
      try {
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          if (session !== previewSessionRef.current) return;
          const method: "POST" | "PUT" = forceRebuild ? "PUT" : "POST";
          const res = await fetch(`/api/projects/${targetProjectId}/preview`, { method });
          if (session !== previewSessionRef.current) return;
          if (res.ok) {
            const data = (await res.json()) as {
              url?: string;
              skipped?: boolean;
              skippedReason?: string;
              previewBackend?: string;
              directEditCapable?: boolean;
            };
            if (session !== previewSessionRef.current) return;
            if (
              forceRebuild &&
              data.skipped &&
              data.skippedReason === "preparing_stub" &&
              attempt < maxAttempts - 1
            ) {
              await new Promise((r) => setTimeout(r, 1200));
              continue;
            }
            applyPreviewMeta(data);
            setPreviewUrl(data.url ?? null);
            setPreviewVersion((v) => v + 1);
            setPreviewState("ready");
            trackPreviewOpen(targetProjectId);
            return;
          }
          const err = await res.json().catch(() => ({}));
          if (session !== previewSessionRef.current) return;
          // Legacy servers threw on stub; retry a couple times on first auto-preview.
          const errMsg = typeof err.error === "string" ? err.error : "";
          if (
            forceRebuild &&
            /Preparing your site|default stub/i.test(errMsg) &&
            attempt < maxAttempts - 1
          ) {
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }
          setPreviewError(errMsg || `HTTP ${res.status}`);
          setPreviewState("error");
          return;
        }
      } catch (e) {
        if (session !== previewSessionRef.current) return;
        setPreviewError(e instanceof Error ? e.message : "Network error");
        setPreviewState("error");
      }
    },
    [applyPreviewMeta]
  );

  /**
   * Health-check: when the user switches back to the Preview tab while
   * previewState is already "ready", verify the sandbox serve is still alive.
   * If it crashed, auto-recover (restart serve or fall back to full start).
   * This prevents the "sandbox is running but no service on port 3000" error.
   */
  const ensurePreviewAlive = useCallback(async () => {
    if (!projectId || !previewUrlRef.current) return;

    const now = Date.now();
    if (now - lastEnsureAliveAtRef.current < 25_000) {
      return;
    }

    const requestSeq = ++ensureAliveSeqRef.current;
    const expectedUrl = previewUrlRef.current;
    try {
      const res = await fetch(`/api/projects/${projectId}/preview`);
      // Ignore stale responses from older tab switches
      if (requestSeq !== ensureAliveSeqRef.current) return;
      if (rightPanelRef.current !== "preview") return;
      if (previewUrlRef.current !== expectedUrl || previewStateRef.current !== "ready") return;
      if (!res.ok) {
        // Treat transient health-check failures as non-fatal.
        console.warn("[ensurePreviewAlive] Health check API error, keeping current preview state");
        return;
      }
      const data = await res.json();
      lastEnsureAliveAtRef.current = Date.now();
      applyPreviewMeta(data);
      if (data.status === "ok" && data.url) {
        // Serve is alive — update URL in case it changed (sandbox reconnect)
        if (data.url !== previewUrlRef.current) {
          setPreviewUrl(data.url);
          setPreviewVersion((v) => v + 1);
        }
        return; // all good
      }
      // Serve is down — only clear after a confirmed failure. Tab-switch health
      // checks must not flash the preview black on a single flake.
      console.warn("[ensurePreviewAlive] Serve is down, restarting preview");
      setPreviewUrl(null);
      setPreviewState("idle"); // will trigger startPreview via the effect below
    } catch (e) {
      console.warn("[ensurePreviewAlive] Network error:", e);
      // Network blips are common; don't force restart from a single failed check.
      return;
    }
  }, [projectId, applyPreviewMeta]);

  // Track the previous rightPanel value to detect tab switches
  const prevRightPanelRef = useRef<RightPanel>(rightPanel);

  useEffect(() => {
    const prevPanel = prevRightPanelRef.current;
    prevRightPanelRef.current = rightPanel;

    if (rightPanel === "preview" && projectId) {
      if (previewState === "idle") {
        // Normal case: no preview yet, start one
        startPreview();
      } else if (
        previewState === "ready" &&
        previewUrl &&
        prevPanel !== "preview"
      ) {
        // Switching BACK to preview tab — soft health check only (iframe stays mounted).
        ensurePreviewAlive();
      }
    }
  }, [rightPanel, projectId, previewState, previewUrl, startPreview, ensurePreviewAlive]);

  // ── Modify ───────────────────────────────────────────────────────────
  const handleModify = useCallback(async (instructionOverride?: string) => {
    const baseInstruction = (instructionOverride ?? modifyInstruction).trim();
    if (!baseInstruction || modifying || !projectId) return;

    const forceBoard = modifyForceBoardRef.current;
    const forceSingleModify = modifyForceSingleRef.current;
    if (
      isBoardRunBlocking(proposedBoardRun) &&
      !(forceBoard && proposedBoardRun?.status === "proposed") &&
      !forceSingleModify
    ) {
      setModifyError("任务板进行中：请先确认/继续/取消剩余，或完成后的任务板，再发送普通 Modify。");
      return;
    }

    const selectionPrefix = onBeforeModifySendRef.current?.() ?? null;
    const instructionToSend = selectionPrefix
      ? `${selectionPrefix}\n\nUser request:\n${baseInstruction}`
      : baseInstruction;
    onAfterModifySendRef.current?.();

    const capturedImage = modifyImage;
    setModifyImage(null);
    setPendingModifyInstruction(instructionToSend);
    setPendingModifyImage(capturedImage);
    setModifying(true);
    setUserInputScrollNonce((nonce) => nonce + 1);
    setModifySteps([]);
    setModifyPlan(null);
    setModifyDiffs([]);
    setModifyToolCalls([]);
    setModifyThinking([]);
    setModifyIntentLabel("修改");
    setModifyError(null);
    modifyStepsRef.current = [];
    modifyPlanRef.current = null;
    modifyDiffsRef.current = [];
    modifyThinkingRef.current = [];
    modifyIntentLabelRef.current = "修改";
    modifyToolCallsRef.current = [];

    // Track whether the done event was received (for history saving)
    let receivedDone = false;
    let receivedBoardProposed = false;

    async function processModifySSE(
      raw: string,
      secureSession: AgentStreamClientSession | null
    ) {
      const line = parseSseDataLine(raw);
      if (!line) return;
      let event: Record<string, unknown> | null;
      try {
        event = await decodeAgentSseJsonLine(secureSession, line);
      } catch (e) {
        console.warn("[modify] SSE decode error:", e);
        return;
      }
      if (!event) return;
      try {
        const e = event as {
          type: string;
          label?: string;
          name?: string;
          status?: ModifyStep["status"];
          message?: string;
          plan?: ModifyPlan;
          file?: string;
          reasoning?: string;
          patch?: string;
          stats?: ModifyDiff["stats"];
          tool?: string;
          args?: Record<string, unknown>;
          result?: string;
          content?: string;
          boardRun?: BoardRun;
        };
        if (e.type === "intent") {
          const label = typeof e.label === "string" ? e.label : "修改";
          setModifyIntentLabel(label);
          modifyIntentLabelRef.current = label;
        } else if (e.type === "step" && e.name && e.status) {
          setModifySteps((prev) => {
            const idx = prev.findIndex((s: ModifyStep) => s.name === e.name);
            let next: ModifyStep[];
            if (idx >= 0) { next = [...prev]; next[idx] = { name: e.name!, status: e.status!, message: e.message }; }
            else { next = [...prev, { name: e.name!, status: e.status!, message: e.message }]; }
            modifyStepsRef.current = next;
            return next;
          });
        } else if (e.type === "plan" && e.plan) {
          setModifyPlan(e.plan);
          modifyPlanRef.current = e.plan;
        } else if (e.type === "diff" && e.file && e.patch && e.stats) {
          setModifyDiffs((prev) => {
            const next = [...prev, { file: e.file!, reasoning: e.reasoning ?? "", patch: e.patch!, stats: e.stats! }];
            modifyDiffsRef.current = next;
            return next;
          });
        } else if (e.type === "tool_call" && e.tool) {
          const tc = { tool: e.tool, args: e.args ?? {}, result: e.result ?? "" };
          setModifyToolCalls((prev) => [...prev, tc]);
          modifyToolCallsRef.current = [...modifyToolCallsRef.current, tc];
        } else if (e.type === "thinking" && typeof e.content === "string") {
          setModifyThinking((prev) => [...prev, e.content!]);
          modifyThinkingRef.current = [...modifyThinkingRef.current, e.content!];
        } else if (e.type === "board_proposed" && e.boardRun) {
          receivedBoardProposed = true;
          setProposedBoardRun(e.boardRun);
          setModifyIntentLabel("任务板");
          modifyIntentLabelRef.current = "任务板";
        } else if (e.type === "error") {
          setModifyError(typeof e.message === "string" ? e.message : "Unknown error");
        } else if (e.type === "done") {
          receivedDone = true;
          setModifyInstruction("");
          setModifyImage(null);
          if (!receivedBoardProposed) {
            setModifyHistory((prev) => [...prev, {
              instruction: instructionToSend,
              image: capturedImage ?? null,
              plan: modifyPlanRef.current,
              steps: modifyStepsRef.current,
              diffs: modifyDiffsRef.current,
              toolCalls: modifyToolCallsRef.current,
              thinking: modifyThinkingRef.current,
              intentLabel: modifyIntentLabelRef.current,
              error: null,
              completedAt: new Date().toISOString(),
            }]);
          } else {
            setModifyHistory((prev) => [...prev, {
              instruction: instructionToSend,
              image: capturedImage ?? null,
              plan: {
                analysis: "已建议拆成任务板（未改代码）。请确认任务或改回单条 Modify。",
                changes: [],
              },
              steps: modifyStepsRef.current,
              diffs: [],
              toolCalls: [],
              thinking: modifyThinkingRef.current,
              intentLabel: "任务板",
              error: null,
              completedAt: new Date().toISOString(),
            }]);
          }
        }
      } catch (e) { console.warn("[modify] SSE parse error:", e); }
    }

    try {
      const secureSession = isSecureAgentStreamSupported()
        ? await createAgentStreamClientSession()
        : null;

      modifyForceBoardRef.current = false;
      modifyForceSingleRef.current = false;

      const res = await fetch(`/api/projects/${projectId}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInstruction: instructionToSend,
          clearContext: contextCleared,
          preferBoardSuggest: true,
          ...(forceBoard ? { forceBoard: true } : {}),
          ...(forceSingleModify ? { forceSingleModify: true } : {}),
          ...(secureSession ? { clientPublicKey: secureSession.clientPublicKeySpki } : {}),
          ...(capturedImage ? { imageBase64: capturedImage } : {}),
          conversationHistory: contextCleared
            ? []
            : modifyHistory
                .filter((r) => !r.isSystemMessage)
                .map((r) =>
                  toClientHistoryPayload({
                    instruction: r.instruction,
                    analysis: r.plan?.analysis,
                    error: r.error,
                    touchedFiles: r.diffs.map((d) => d.file),
                    intentCategory: modifyIntentLabelToCategory(r.intentLabel),
                  })
                ),
        }),
      });

      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as {
          code?: string;
          error?: string;
          pricingPath?: string;
        };
        if (res.status === 402 || body.code === "INSUFFICIENT_CREDITS") {
          const pricingPath =
            typeof body.pricingPath === "string" && body.pricingPath.startsWith("/")
              ? body.pricingPath
              : "/pricing";
          if (typeof window !== "undefined") {
            window.location.href = pricingPath;
          }
          setModifyError("积分不足，请充值或升级后继续");
          return;
        }
        if (body.code === "BOARD_RUN_ACTIVE") {
          setModifyError(body.error ?? "任务板进行中，请先处理任务板");
          return;
        }
        setModifyError(body.error ?? "Failed to start modification");
        return;
      }
      setContextCleared(false);

      // ── Read SSE stream ──────────────────────────────────────────────
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
          await processModifySSE(line, secureSession);
        }
      }
      // Flush remaining buffer (same fix as generate flow)
      if (buffer.trim()) {
        await processModifySSE(buffer, secureSession);
      }

      // ── Stream ended — trigger preview rebuild if there were changes ──
      // This runs AFTER the SSE stream is fully consumed, so it doesn't
      // depend on the "done" event being parsed (buffer flush handles that).
      // Even if "done" was somehow lost, diffs were already collected via
      // individual "diff" events during the stream.
      if (modifyDiffsRef.current.length > 0) {
        // Save history if done event was missed
        if (!receivedDone) {
          setModifyInstruction("");
          setModifyImage(null);
          setModifyHistory((prev) => [...prev, {
            instruction: instructionToSend,
            image: capturedImage ?? null,
            plan: modifyPlanRef.current,
            steps: modifyStepsRef.current,
            diffs: modifyDiffsRef.current,
            toolCalls: modifyToolCallsRef.current,
            thinking: modifyThinkingRef.current,
            intentLabel: modifyIntentLabelRef.current,
            error: null,
            completedAt: new Date().toISOString(),
          }]);
        }

        setCodeWorkspaceEpoch((n) => n + 1);

        if (autoPreviewAfterBuildRef.current) {
          // Storage backend: share in-flight sync with post-modify pipeline (no force).
          // Forced rebuild doubled next build cost on every modify.
          void openPreviewAfterBuild(projectId, false);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setModifyError(msg);
      setModifyHistory((prev) => [...prev, {
        instruction: instructionToSend,
        image: capturedImage ?? null,
        plan: modifyPlanRef.current,
        steps: modifyStepsRef.current,
        diffs: modifyDiffsRef.current,
        toolCalls: modifyToolCallsRef.current,
        thinking: modifyThinkingRef.current,
        intentLabel: modifyIntentLabelRef.current,
        error: msg,
        completedAt: new Date().toISOString(),
      }]);
    } finally {
      setModifying(false);
      setPendingModifyInstruction(null);
      setPendingModifyImage(null);
    }
  }, [modifyInstruction, modifyImage, modifying, projectId, selectedModel, modifyHistory, openPreviewAfterBuild, contextCleared, proposedBoardRun]);

  const appendBoardCardHistory = useCallback(
    (instruction: string, modify: {
      ok: boolean;
      assistantText?: string;
      touchedFiles?: string[];
      message?: string;
    }) => {
      setModifyHistory((prev) => [
        ...prev,
        {
          instruction,
          plan: {
            analysis: modify.ok
              ? (modify.assistantText ?? "任务卡已完成")
              : (modify.message ?? "任务卡失败"),
            changes: [],
          },
          steps: [],
          diffs: (modify.touchedFiles ?? []).map((file) => ({
            file,
            reasoning: "board card",
            patch: "",
            stats: { additions: 0, deletions: 0 },
          })),
          toolCalls: [],
          thinking: [],
          intentLabel: "任务板",
          error: modify.ok ? null : (modify.message ?? "任务卡失败"),
          completedAt: new Date().toISOString(),
        },
      ]);
      if (modify.ok && (modify.touchedFiles?.length ?? 0) > 0) {
        setCodeWorkspaceEpoch((n) => n + 1);
        if (projectId && autoPreviewAfterBuildRef.current) {
          void openPreviewAfterBuild(projectId, false);
        }
      }
    },
    [projectId, openPreviewAfterBuild]
  );

  const drainBoardQueue = useCallback(async () => {
    if (!projectId) return;
    boardDrainAbortRef.current = false;
    setBoardDraining(true);
    setModifyError(null);
    try {
      while (!boardDrainAbortRef.current) {
        // Phase 1: mark card in_flight so UI shows progress immediately.
        const prepRes = await fetch(`/api/projects/${projectId}/board-run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "prepare_next" }),
        });
        const prep = (await prepRes.json().catch(() => ({}))) as {
          boardRun?: BoardRun;
          dispatch?: { taskId: string; instruction: string } | null;
          error?: string;
          code?: string;
        };
        if (!prepRes.ok) {
          setModifyError(prep.error ?? "任务板调度失败");
          break;
        }
        if (prep.boardRun) setProposedBoardRun(prep.boardRun);
        if (!prep.dispatch) {
          break;
        }

        if (boardDrainAbortRef.current) break;

        // Phase 2: run Modify for the in_flight card (may take a while).
        const execRes = await fetch(`/api/projects/${projectId}/board-run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "execute_current" }),
        });
        const body = (await execRes.json().catch(() => ({}))) as {
          boardRun?: BoardRun;
          dispatch?: { taskId: string; instruction: string } | null;
          modify?: {
            ok: boolean;
            assistantText?: string;
            touchedFiles?: string[];
            message?: string;
          } | null;
          error?: string;
        };
        if (!execRes.ok) {
          setModifyError(body.error ?? "任务卡执行失败");
          // Refresh board state if server returned it
          if (body.boardRun) setProposedBoardRun(body.boardRun);
          break;
        }
        if (body.boardRun) setProposedBoardRun(body.boardRun);
        if (body.dispatch && body.modify) {
          appendBoardCardHistory(body.dispatch.instruction, body.modify);
          if (!body.modify.ok) {
            setModifyError(body.modify.message ?? "任务卡失败，队列已停止");
          }
        }
        const status = body.boardRun?.status;
        if (
          !body.boardRun ||
          status === "failed" ||
          status === "paused" ||
          status === "completed" ||
          status === "cancelled" ||
          !body.modify?.ok
        ) {
          break;
        }
      }
    } finally {
      setBoardDraining(false);
    }
  }, [projectId, appendBoardCardHistory]);

  const reviseProposedBoard = useCallback(async (tasks: BoardTaskInput[]) => {
    if (!projectId) return;
    setBoardRunBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/board-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revise", tasks }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        boardRun?: BoardRun;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Failed to revise board");
      if (body.boardRun) setProposedBoardRun(body.boardRun);
    } finally {
      setBoardRunBusy(false);
    }
  }, [projectId]);

  const confirmProposedBoard = useCallback(async (tasks: BoardTaskInput[]) => {
    if (!projectId) return;
    setBoardRunBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/board-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", tasks }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        boardRun?: BoardRun;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? "Failed to confirm board");
      if (body.boardRun) setProposedBoardRun(body.boardRun);
    } finally {
      setBoardRunBusy(false);
    }
    await drainBoardQueue();
  }, [projectId, drainBoardQueue]);

  const declineProposedBoard = useCallback(async () => {
    if (!projectId || !proposedBoardRun) return;
    const goal = proposedBoardRun.goal;
    setBoardRunBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/board-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to decline board");
      }
      setProposedBoardRun(null);
      modifyForceSingleRef.current = true;
      await handleModify(goal);
    } finally {
      setBoardRunBusy(false);
    }
  }, [projectId, proposedBoardRun, handleModify]);

  const forceSplitIntoTasks = useCallback(async () => {
    if (!modifyInstruction.trim() || modifying || !projectId) return;
    if (isBoardRunBlocking(proposedBoardRun) && proposedBoardRun?.status !== "proposed") {
      setModifyError("已有进行中的任务板，请先处理完再拆板。");
      return;
    }
    modifyForceBoardRef.current = true;
    await handleModify();
  }, [modifyInstruction, modifying, projectId, handleModify, proposedBoardRun]);

  const pauseBoardQueue = useCallback(async () => {
    if (!projectId) return;
    boardDrainAbortRef.current = true;
    setBoardRunBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/board-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });
      const body = (await res.json().catch(() => ({}))) as { boardRun?: BoardRun; error?: string };
      if (!res.ok) throw new Error(body.error ?? "暂停失败");
      if (body.boardRun) setProposedBoardRun(body.boardRun);
    } finally {
      setBoardRunBusy(false);
    }
  }, [projectId]);

  const continueBoardQueue = useCallback(async () => {
    await drainBoardQueue();
  }, [drainBoardQueue]);

  const cancelBoardRemaining = useCallback(async () => {
    if (!projectId) return;
    boardDrainAbortRef.current = true;
    setBoardRunBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/board-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_remaining" }),
      });
      const body = (await res.json().catch(() => ({}))) as { boardRun?: BoardRun; error?: string };
      if (!res.ok) throw new Error(body.error ?? "取消失败");
      if (body.boardRun) setProposedBoardRun(body.boardRun);
    } finally {
      setBoardRunBusy(false);
    }
  }, [projectId]);

  const retryBoardTask = useCallback(async (taskId: string) => {
    if (!projectId) return;
    setBoardRunBusy(true);
    boardDrainAbortRef.current = false;
    try {
      const prepRes = await fetch(`/api/projects/${projectId}/board-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare_retry", taskId }),
      });
      const prep = (await prepRes.json().catch(() => ({}))) as {
        boardRun?: BoardRun;
        error?: string;
      };
      if (!prepRes.ok) throw new Error(prep.error ?? "重试调度失败");
      if (prep.boardRun) setProposedBoardRun(prep.boardRun);
    } finally {
      setBoardRunBusy(false);
    }
    await drainBoardQueue();
  }, [projectId, drainBoardQueue]);

  const skipBoardTask = useCallback(async (taskId: string) => {
    if (!projectId) return;
    setBoardRunBusy(true);
    boardDrainAbortRef.current = false;
    try {
      const prepRes = await fetch(`/api/projects/${projectId}/board-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare_skip", taskId }),
      });
      const prep = (await prepRes.json().catch(() => ({}))) as {
        boardRun?: BoardRun;
        dispatch?: { instruction: string } | null;
        error?: string;
      };
      if (!prepRes.ok) throw new Error(prep.error ?? "跳过调度失败");
      if (prep.boardRun) setProposedBoardRun(prep.boardRun);
      // Skip may immediately dispatch the next card; execute via drain.
    } finally {
      setBoardRunBusy(false);
    }
    await drainBoardQueue();
  }, [projectId, drainBoardQueue]);

  // Hydrate BoardRun after project load; abort drain on unmount.
  // If a board was left mid-run (refresh / stuck client), offer resume via continue — do not auto-drain on hydrate
  // (online-only contract). User clicks「继续」.
  useEffect(() => {
    if (!projectId) {
      setProposedBoardRun(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/board-run`);
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { boardRun?: BoardRun | null };
        if (cancelled || !body.boardRun) return;
        if (
          body.boardRun.status === "proposed" ||
          body.boardRun.status === "running" ||
          body.boardRun.status === "paused" ||
          body.boardRun.status === "failed"
        ) {
          setProposedBoardRun(body.boardRun);
        }
      } catch {
        /* ignore hydrate errors */
      }
    })();
    return () => {
      cancelled = true;
      boardDrainAbortRef.current = true;
    };
  }, [projectId]);

  // ── Computed ─────────────────────────────────────────────────────────
  const flowStart =
    response?.buildSteps?.[0]?.timestamp != null
      ? response.buildSteps[0].timestamp - response.buildSteps[0].duration
      : startedAt ?? 0;

  const effectiveProjectStatus: StudioProjectLifecycleStatus | null =
    projectStatus ?? (loading ? "generating" : null);

  const capabilities = evaluateStudioCapabilities(
    !projectId || projectNotFound
      ? null
      : {
          status: effectiveProjectStatus ?? "awaiting_input",
          verificationStatus:
            response?.verificationStatus === "passed" ||
            response?.verificationStatus === "failed"
              ? response.verificationStatus
              : undefined,
          hydration: projectLoading ? "loading" : "ready",
          hasStaticPreview,
          hasOperableArtifact: hasOperableArtifactFromResponse(response),
        }
  );

  return {
    input, setInput, loading, clearing, response, intentAgent, mergedBrief, conversationMessages, intentProgressLog, userInputScrollNonce, lastRunInput, elapsed, flowStart,
    handleRun, handleConfirmVibe, handleSkipVibe, handleConfirmDirection, handleClear, handleRetry,
    vibeResolved, confirmedVibe,
    generationSeemsStuck,
    recoveryUnlocking,
    handleUnlockInterruptedGeneration,
    handleContinueFromCheckpoint,
    intentImage, setIntentImage,
    selectedModel, setSelectedModel, selectedEffortTier, setSelectedEffortTier, availableModels,
    projectId, setProjectId, projectLoading, projectNotFound,
    projectName,
    remixedFromTitle, remixedFromOwnerUsername,
    rightPanel, setRightPanel,
    previewUrl, previewState, previewError, previewVersion, previewBackend, directEditCapable,
    startPreview, rebuildPreview, bumpPreviewAfterDirectPatch,
    autoPreviewAfterBuild, setAutoPreviewAfterBuild,
    modifyInstruction, setModifyInstruction, modifyImage, setModifyImage, modifying,
    modifySteps, modifyPlan, modifyDiffs, modifyToolCalls, modifyThinking, modifyError, modifyIntentLabel, handleModify,
    setOnBeforeModifySend, setOnAfterModifySend,
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
    proposedBoardRun,
    boardRunBusy,
    boardDraining,
    reviseProposedBoard,
    confirmProposedBoard,
    declineProposedBoard,
    forceSplitIntoTasks,
    pauseBoardQueue,
    continueBoardQueue,
    cancelBoardRemaining,
    retryBoardTask,
    skipBoardTask,
    iframeRef,
    codeWorkspaceEpoch,
    projectStatus: effectiveProjectStatus,
    capabilities,
  };
}
