import { NextRequest, NextResponse } from "next/server";
import {
  getAllModels,
  DEFAULT_MODEL,
  GENERATION_STEPS,
  setConfiguredStepModel,
  setConfiguredStepThinkingLevel,
  clearStepConfig,
  isStepThinkingLevel,
  modelConfigFromRow,
  removeModelConfig,
  type ModelConfig,
  type ModelConfigRow,
  type StepThinkingLevel,
} from "@/lib/config/models";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createResilientFetch } from "@/lib/supabase/resilientFetch";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

function createModelConfigDatabase() {
  try {
    return {
      db: createSupabaseServiceRoleClient({ global: { fetch: createResilientFetch() } }),
    } as const;
  } catch {
    return {
      error: NextResponse.json(
        { error: "Server misconfigured", code: "SERVICE_ROLE" },
        { status: 503 },
      ),
    } as const;
  }
}

async function requireAdminDatabase() {
  const auth = await requireAdmin();
  if ("error" in auth) return { error: auth.error } as const;
  return createModelConfigDatabase();
}

function isGeminiModelId(modelId: string): boolean {
  return modelId.toLowerCase().includes("gemini");
}

/** GET /api/models — list all models + step config */
export async function GET() {
  const database = createModelConfigDatabase();
  if ("error" in database) return database.error;

  // Load custom models from DB
  const { data: customRows, error: customModelsError } = await database.db
    .from("model_configs")
    .select("*")
    .order("created_at", { ascending: true });
  if (customModelsError) {
    return NextResponse.json({ error: customModelsError.message }, { status: 500 });
  }

  const customModels: ModelConfig[] = (customRows ?? []).map((row) =>
    modelConfigFromRow(row as ModelConfigRow),
  );

  // Load step model assignments (+ optional thinking_level)
  const { data: stepRows, error: stepRowsError } = await database.db
    .from("step_model_configs")
    .select("*");
  if (stepRowsError) {
    return NextResponse.json({ error: stepRowsError.message }, { status: 500 });
  }

  const stepModels: Record<string, string> = {};
  const stepThinkingLevels: Record<string, string | null> = {};
  for (const row of stepRows ?? []) {
    const r = row as { step_name: string; model_id: string; thinking_level?: string | null };
    stepModels[r.step_name] = r.model_id;
    if (r.thinking_level && isStepThinkingLevel(r.thinking_level)) {
      stepThinkingLevels[r.step_name] = r.thinking_level;
    } else {
      stepThinkingLevels[r.step_name] = null;
    }
  }

  const allModels = [...getAllModels(), ...customModels];
  // Deduplicate by id
  const seen = new Set<string>();
  const models = allModels.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });

  return NextResponse.json({
    models: models.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      contextWindow: m.contextWindow,
      supportsThinking: m.supportsThinking ?? false,
      tokenPrice: m.tokenPrice ?? null,
    })),
    default: DEFAULT_MODEL,
    steps: GENERATION_STEPS,
    stepModels,
    stepThinkingLevels,
  });
}

/** POST /api/models — add a custom model */
export async function POST(req: NextRequest) {
  const admin = await requireAdminDatabase();
  if ("error" in admin) return admin.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { id, displayName, contextWindow, supportsThinking, tokenPrice } = body;

  if (typeof id !== "string" || !id.trim() || typeof displayName !== "string" || !displayName.trim()) {
    return NextResponse.json({ error: "id and displayName are required" }, { status: 400 });
  }
  const resolvedContextWindow = Number(contextWindow ?? 128_000);
  if (!Number.isInteger(resolvedContextWindow) || resolvedContextWindow <= 0) {
    return NextResponse.json({ error: "contextWindow must be a positive integer" }, { status: 400 });
  }
  const pricing = tokenPrice && typeof tokenPrice === "object"
    ? tokenPrice as Record<string, unknown>
    : {};
  const resolvedInputPrice = Number(pricing.inputPerMTok);
  const resolvedOutputPrice = Number(pricing.outputPerMTok);
  if (!Number.isFinite(resolvedInputPrice) || resolvedInputPrice < 0 || !Number.isFinite(resolvedOutputPrice) || resolvedOutputPrice < 0) {
    return NextResponse.json({ error: "inputPricePerMTok and outputPricePerMTok must be non-negative numbers" }, { status: 400 });
  }

  const { error } = await admin.db.from("model_configs").upsert({
    id: id.trim(),
    display_name: displayName.trim(),
    context_window: resolvedContextWindow,
    supports_thinking: supportsThinking === true,
    input_price_per_mtok: resolvedInputPrice,
    output_price_per_mtok: resolvedOutputPrice,
    created_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/models — remove a custom model */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdminDatabase();
  if ("error" in admin) return admin.error;

  let id: unknown;
  try {
    ({ id } = (await req.json()) as { id?: unknown });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof id !== "string" || !id.trim()) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const normalizedId = id.trim();
  const { error: assignmentsError } = await admin.db
    .from("step_model_configs")
    .delete()
    .eq("model_id", normalizedId);
  if (assignmentsError) {
    return NextResponse.json(
      { error: assignmentsError.message, code: "MODEL_ASSIGNMENTS_DELETE_FAILED" },
      { status: 500 },
    );
  }

  const { error } = await admin.db.from("model_configs").delete().eq("id", normalizedId);
  if (error) {
    return NextResponse.json(
      { error: error.message, code: "MODEL_DELETE_FAILED" },
      { status: 500 },
    );
  }
  removeModelConfig(normalizedId);
  return NextResponse.json({ ok: true });
}

/** PUT /api/models — update step model assignment */
export async function PUT(req: NextRequest) {
  const admin = await requireAdminDatabase();
  if ("error" in admin) return admin.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { stepName, modelId, thinkingLevel } = body;
  if (typeof stepName !== "string" || !stepName.trim()) {
    return NextResponse.json({ error: "stepName required" }, { status: 400 });
  }
  const normalizedStepName = stepName.trim();

  if (modelId == null || modelId === "") {
    const { error: deleteError } = await admin.db
      .from("step_model_configs")
      .delete()
      .eq("step_name", normalizedStepName);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    clearStepConfig(normalizedStepName);
    return NextResponse.json({ ok: true });
  }
  if (typeof modelId !== "string" || !modelId.trim()) {
    return NextResponse.json({ error: "modelId must be a string" }, { status: 400 });
  }
  const normalizedModelId = modelId.trim();

  // thinking_level is supported on any step when the assigned model is a
  // Gemini model that exposes thinking. Server gates only on the model side
  // (Gemini routing) — the step is the user's choice.
  const supportsStepThinking = isGeminiModelId(normalizedModelId);

  let resolvedThinking: StepThinkingLevel | null = null;
  if (thinkingLevel !== undefined) {
    if (!supportsStepThinking && thinkingLevel !== null && thinkingLevel !== "") {
      return NextResponse.json(
        { error: "thinkingLevel is only supported when the step is assigned to a Gemini model" },
        { status: 400 }
      );
    }
    if (thinkingLevel === null || thinkingLevel === "") {
      resolvedThinking = null;
    } else if (typeof thinkingLevel === "string" && isStepThinkingLevel(thinkingLevel)) {
      resolvedThinking = thinkingLevel;
    } else {
      return NextResponse.json({ error: "Invalid thinkingLevel" }, { status: 400 });
    }
  } else if (supportsStepThinking) {
    const { data: existing, error: existingError } = await admin.db
      .from("step_model_configs")
      .select("thinking_level")
      .eq("step_name", normalizedStepName)
      .maybeSingle();
    if (existingError) {
      // Compatible with DBs that have not applied thinking_level migration.
      if (!existingError.message?.toLowerCase().includes("thinking_level")) {
        return NextResponse.json({ error: existingError.message }, { status: 500 });
      }
    }
    const t = existing?.thinking_level;
    resolvedThinking = t && isStepThinkingLevel(t) ? t : null;
  } else {
    resolvedThinking = null;
  }

  const upsertWithThinking = await admin.db.from("step_model_configs").upsert({
    step_name: normalizedStepName,
    model_id: normalizedModelId,
    thinking_level: resolvedThinking,
    updated_at: new Date().toISOString(),
  });
  if (upsertWithThinking.error) {
    const needsFallback = upsertWithThinking.error.message?.toLowerCase().includes("thinking_level");
    if (!needsFallback) {
      return NextResponse.json({ error: upsertWithThinking.error.message }, { status: 500 });
    }
    const legacyUpsert = await admin.db.from("step_model_configs").upsert({
      step_name: normalizedStepName,
      model_id: normalizedModelId,
      updated_at: new Date().toISOString(),
    });
    if (legacyUpsert.error) {
      return NextResponse.json({ error: legacyUpsert.error.message }, { status: 500 });
    }
  }
  setConfiguredStepModel(normalizedStepName, normalizedModelId);
  setConfiguredStepThinkingLevel(normalizedStepName, resolvedThinking);

  return NextResponse.json({ ok: true });
}
