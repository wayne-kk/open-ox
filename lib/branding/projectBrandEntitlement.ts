import type { SupabaseClient } from "@supabase/supabase-js";

export const BRAND_REMOVAL_PRICE_CREDITS = 80;

export type BrandRemovalPurchaseResult =
  | { ok: true; charged: number; balance: number; purchased: boolean }
  | {
      ok: false;
      code: "INSUFFICIENT_CREDITS" | "PURCHASE_FAILED";
      message: string;
    };

function parseRpcNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function purchaseProjectBrandRemoval(
  db: Pick<SupabaseClient, "rpc">,
  input: { projectId: string; userId: string; idempotencyKey: string },
): Promise<BrandRemovalPurchaseResult> {
  const { data, error } = await db.rpc("purchase_project_brand_removal", {
    target_project_id: input.projectId,
    target_user_id: input.userId,
    purchase_idempotency_key: input.idempotencyKey,
    price_credits: BRAND_REMOVAL_PRICE_CREDITS,
  });

  if (error) {
    if (error.message?.includes("INSUFFICIENT_CREDITS")) {
      return {
        ok: false,
        code: "INSUFFICIENT_CREDITS",
        message: "Insufficient credits",
      };
    }
    return { ok: false, code: "PURCHASE_FAILED", message: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return {
      ok: false,
      code: "PURCHASE_FAILED",
      message: "Purchase returned no result",
    };
  }
  const value = row as Record<string, unknown>;
  const charged = parseRpcNumber(value.charged);
  const balance = parseRpcNumber(value.balance);
  if (charged === null || balance === null) {
    return {
      ok: false,
      code: "PURCHASE_FAILED",
      message: "Purchase returned invalid amounts",
    };
  }
  return {
    ok: true,
    charged,
    balance,
    purchased: value.purchased === true,
  };
}

export async function hasProjectBrandRemoval(
  db: SupabaseClient,
  projectId: string,
): Promise<boolean> {
  const { data, error } = await db
    .from("project_brand_entitlements")
    .select("project_id")
    .eq("project_id", projectId)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw new Error(`brand entitlement read failed: ${error.message}`);
  return Boolean(data);
}

export async function getProjectBrandingAttributionToken(
  db: SupabaseClient,
  projectId: string,
): Promise<string> {
  const { data, error } = await db
    .from("projects")
    .select("branding_attribution_token")
    .eq("id", projectId)
    .single();
  if (error) throw new Error(`branding attribution token read failed: ${error.message}`);
  const token = (data as { branding_attribution_token?: unknown }).branding_attribution_token;
  if (typeof token !== "string" || !token) {
    throw new Error("Project has no branding attribution token");
  }
  return token;
}
