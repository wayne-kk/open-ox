import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModifyHistoryTurn } from "@/ai/flows/modify_project/history/modifyHistoryTurn";
import {
  computeAwaitingReply,
  fromModificationRecord,
} from "@/ai/flows/modify_project/history/modifyHistoryTurn";
import type { ModifyIntentCategory } from "@/ai/flows/modify_project/intent/modifyIntentRouter";
import {
  runModifyProject,
  type ModifySSEEvent,
} from "@/ai/flows/modify_project/runModifyProject";
import { canAfford } from "@/lib/billing/account";
import { chargeUsageForRun } from "@/lib/billing/chargeRun";
import { isCreditsEnabled, MIN_MODIFY_CREDITS } from "@/lib/billing/credits";
import { runWithUsageAccounting, type AccumulatedUsage } from "@/lib/billing/usageContext";
import { MODIFY_DEFAULT_MODEL } from "@/lib/config/models";
import { getProject } from "@/lib/projectManager";
import {
  releaseModifyInFlight,
  tryAcquireModifyInFlight,
} from "./modifyInFlight";

export type HeadlessModifyErrorCode =
  | "MODIFY_IN_FLIGHT"
  | "INSUFFICIENT_CREDITS"
  | "PROJECT_NOT_FOUND"
  | "MODIFY_FAILED";

export type HeadlessModifyOk = {
  ok: true;
  assistantText: string;
  touchedFiles: string[];
  intentCategory?: ModifyIntentCategory;
  awaitingReply: boolean;
  charged: number;
  balanceAfter: number;
};

export type HeadlessModifyErr = {
  ok: false;
  code: HeadlessModifyErrorCode;
  message: string;
  balance?: number;
  required?: number;
};

export type HeadlessModifyResult = HeadlessModifyOk | HeadlessModifyErr;

export type HeadlessModifyTurnInput = {
  userId: string;
  projectId: string;
  instruction: string;
  /** When true, ignore DB history for this turn (same as Studio clearContext). */
  clearContext?: boolean;
  /** When true, do not treat as continuation of awaitingReply. */
  forceFreshInstruction?: boolean;
  /**
   * Optional model override. Headless / Feishu callers leave unset to use product default.
   */
  modelOverride?: string;
  /** Board card execution: block board suggestion + inject summary. */
  forceSingleModify?: boolean;
  boardSummaryBlock?: string;
  onEvent?: (event: ModifySSEEvent) => void;
};

export type HeadlessModifyTurnDeps = {
  tryAcquire: (projectId: string) => boolean;
  release: (projectId: string) => void;
  creditsEnabled: () => boolean;
  canAfford: (
    db: SupabaseClient,
    userId: string,
    min: number
  ) => Promise<{ ok: boolean; balance: number }>;
  minModifyCredits: number;
  defaultModel: string;
  getProject: typeof getProject;
  runModify: typeof runModifyProject;
  runWithUsage: typeof runWithUsageAccounting;
  charge: typeof chargeUsageForRun;
};

const defaultDeps: HeadlessModifyTurnDeps = {
  tryAcquire: tryAcquireModifyInFlight,
  release: releaseModifyInFlight,
  creditsEnabled: isCreditsEnabled,
  canAfford,
  minModifyCredits: MIN_MODIFY_CREDITS,
  defaultModel: MODIFY_DEFAULT_MODEL,
  getProject,
  runModify: runModifyProject,
  runWithUsage: runWithUsageAccounting,
  charge: chargeUsageForRun,
};

function collectFromEvents(events: ModifySSEEvent[]): {
  assistantText: string;
  touchedFiles: string[];
  intentCategory?: ModifyIntentCategory;
} {
  let assistantText = "";
  let intentCategory: ModifyIntentCategory | undefined;
  const touchedFiles: string[] = [];

  for (const event of events) {
    if (event.type === "intent") {
      intentCategory = event.category;
    } else if (event.type === "plan") {
      assistantText = event.plan.analysis?.trim() || assistantText;
      if (event.intentCategory) intentCategory = event.intentCategory;
    } else if (event.type === "diff") {
      if (!touchedFiles.includes(event.file)) touchedFiles.push(event.file);
    } else if (event.type === "error") {
      assistantText = event.message || assistantText;
    }
  }

  return { assistantText, touchedFiles, intentCategory };
}

/**
 * Run one Modify turn using DB modification history only (no Studio client history).
 * Acquires project in-flight lock; applies Credits gate + charge like the HTTP route.
 */
export async function runHeadlessModifyTurn(
  db: SupabaseClient,
  input: HeadlessModifyTurnInput,
  deps: HeadlessModifyTurnDeps = defaultDeps
): Promise<HeadlessModifyResult> {
  const { userId, projectId, instruction } = input;
  const clearContext = input.clearContext === true;
  const modelOverride = input.modelOverride ?? deps.defaultModel;

  if (!deps.tryAcquire(projectId)) {
    return {
      ok: false,
      code: "MODIFY_IN_FLIGHT",
      message: "This project already has a Modify in progress. Try again shortly.",
    };
  }

  try {
    if (deps.creditsEnabled()) {
      const afford = await deps.canAfford(db, userId, deps.minModifyCredits);
      if (!afford.ok) {
        return {
          ok: false,
          code: "INSUFFICIENT_CREDITS",
          message: "Insufficient credits",
          balance: afford.balance,
          required: deps.minModifyCredits,
        };
      }
    }

    const project = await deps.getProject(db, projectId);
    if (!project) {
      return {
        ok: false,
        code: "PROJECT_NOT_FOUND",
        message: `Project not found: ${projectId}`,
      };
    }

    const events: ModifySSEEvent[] = [];
    let usage: AccumulatedUsage = {
      events: [],
      totalUsd: 0,
      totalCredits: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    };

    try {
      const accounted = await deps.runWithUsage(async () => {
        await deps.runModify(
          db,
          projectId,
          instruction,
          (event) => {
            events.push(event);
            input.onEvent?.(event);
          },
          undefined,
          clearContext,
          undefined,
          modelOverride,
          input.forceFreshInstruction === true,
          {
            forceSingleModify: input.forceSingleModify === true,
            boardSummaryBlock: input.boardSummaryBlock,
          }
        );
      });
      usage = accounted.usage;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Modify failed";
      return { ok: false, code: "MODIFY_FAILED", message };
    }

    const charge = await deps.charge(db, {
      userId,
      usage,
      kind: "spend_modify",
      projectId,
      reason: "modify turn",
    });

    const collected = collectFromEvents(events);
    let assistantText = collected.assistantText;
    let touchedFiles = collected.touchedFiles;
    let intentCategory = collected.intentCategory;

    // Prefer freshly persisted history when events were sparse
    const refreshed = await deps.getProject(db, projectId);
    const lastRecord = refreshed?.modificationHistory?.at(-1);
    if (lastRecord && lastRecord.instruction === instruction) {
      const turn: ModifyHistoryTurn = fromModificationRecord(lastRecord);
      assistantText = turn.assistantText || assistantText;
      touchedFiles = turn.touchedFiles.length > 0 ? turn.touchedFiles : touchedFiles;
      intentCategory = turn.intentCategory ?? intentCategory;
    }

    if (!assistantText.trim()) {
      assistantText =
        touchedFiles.length > 0
          ? `Modified ${touchedFiles.length} file(s)`
          : "Modify completed.";
    }

    return {
      ok: true,
      assistantText,
      touchedFiles,
      intentCategory,
      awaitingReply: computeAwaitingReply(assistantText, touchedFiles),
      charged: charge.charged,
      balanceAfter: charge.balance,
    };
  } finally {
    deps.release(projectId);
  }
}
