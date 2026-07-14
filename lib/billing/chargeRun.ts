import type { SupabaseClient } from "@supabase/supabase-js";
import { spendCredits } from "./account";
import type { AccumulatedUsage } from "./usageContext";
import { isCreditsEnabled } from "./credits";

/**
 * Generate is billable only when the run left a Studio-usable / previewable deliverable.
 * Intent-guide-only or hard failures are not billable (trial-safe).
 */
export function isGenerateRunBillable(result: {
  success: boolean;
}): boolean {
  return result.success === true;
}

/**
 * Charge credits for a completed LLM run. No-op when disabled or zero usage.
 * Never throws — logs and returns the spend result.
 */
export async function chargeUsageForRun(
  db: SupabaseClient,
  params: {
    userId: string;
    usage: AccumulatedUsage;
    kind: "spend_generate" | "spend_modify";
    projectId?: string | null;
    reason?: string;
  }
): Promise<{ charged: number; balance: number }> {
  if (!isCreditsEnabled() || params.usage.totalCredits <= 0) {
    return { charged: 0, balance: 0 };
  }

  const result = await spendCredits(db, {
    userId: params.userId,
    amount: params.usage.totalCredits,
    kind: params.kind,
    reason: params.reason,
    projectId: params.projectId,
    metadata: {
      totalUsd: params.usage.totalUsd,
      inputTokens: params.usage.totalInputTokens,
      outputTokens: params.usage.totalOutputTokens,
      calls: params.usage.events.length,
    },
  });

  if (result.ok === false) {
    console.warn(
      `[credits] charge failed user=${params.userId} kind=${params.kind}: ${result.message}`
    );
    return { charged: 0, balance: result.balance };
  }

  return { charged: result.charged, balance: result.balance };
}
