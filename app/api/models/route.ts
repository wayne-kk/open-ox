import { NextRequest, NextResponse } from "next/server";
import {
  getAllModels,
  DEFAULT_MODEL,
  GENERATION_STEPS,
  setStepModel,
  clearStepModels,
  setStepThinkingLevel,
  clearStepConfig,
  isStepThinkingLevel,
  type ModelConfig,
  type StepThinkingLevel,
} from "@/lib/config/models";
import { supabase } from "@/lib/supabase";

function isGeminiModelId(modelId: string): boolean {
  return modelId.toLowerCase().includes("gemini");
}

/** GET /api/models — list all models + step config */
export async function GET() {
  // Load custom models from DB
  const { data: customRows } = await supabase
    .from("model_configs")
    .select("*")
    .order("created_at", { ascending: true });

  const customModels: ModelConfig[] = (customRows ?? []).map((r: { id: string; display_name: string; context_window: number; supports_thinking?: boolean }) => ({
    id: r.id,
    displayName: r.display_name,
    contextWindow: r.context_window,
    supportsThinking: r.supports_thinking ?? false,
  }));

  // Load step model assignments (+ optional thinking_level)
  const { data: stepRows, error: stepRowsError } = await supabase
    .from("step_model_configs")
    .select("*");
  if (stepRowsError) {
    return NextResponse.json({ error: stepRowsError.message }, { status: 500 });
  }

  const stepModels: Record<string, string> = {};
  const stepThinkingLevels: Record<string, string | null> = {};
  clearStepModels();
  for (const row of stepRows ?? []) {
    const r = row as { step_name: string; model_id: string; thinking_level?: string | null };
    stepModels[r.step_name] = r.model_id;
    setStepModel(r.step_name, r.model_id);
    if (r.thinking_level && isStepThinkingLevel(r.thinking_level)) {
      setStepThinkingLevel(r.step_name, r.thinking_level);
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
    models: models.map((m) => ({ id: m.id, displayName: m.displayName, contextWindow: m.contextWindow, supportsThinking: m.supportsThinking ?? false })),
    default: DEFAULT_MODEL,
    steps: GENERATION_STEPS,
    stepModels,
    stepThinkingLevels,
  });
}

/** POST /api/models — add a custom model */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, displayName, contextWindow, supportsThinking } = body;

  if (!id || !displayName) {
    return NextResponse.json({ error: "id and displayName are required" }, { status: 400 });
  }

  const { error } = await supabase.from("model_configs").upsert({
    id,
    display_name: displayName,
    context_window: contextWindow ?? 128_000,
    supports_thinking: supportsThinking ?? false,
    created_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/models — remove a custom model */
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await supabase.from("model_configs").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}

/** PUT /api/models — update step model assignment */
export async function PUT(req: NextRequest) {
  const body = await req.json();

  const { stepName, modelId, thinkingLevel } = body;
  if (!stepName) return NextResponse.json({ error: "stepName required" }, { status: 400 });

  if (!modelId) {
    const { error: deleteError } = await supabase.from("step_model_configs").delete().eq("step_name", stepName);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    clearStepConfig(stepName);
    return NextResponse.json({ ok: true });
  }

  const supportsStepThinking = stepName === "generate_section" && isGeminiModelId(modelId);

  let resolvedThinking: StepThinkingLevel | null = null;
  if (thinkingLevel !== undefined) {
    if (!supportsStepThinking && thinkingLevel !== null && thinkingLevel !== "") {
      return NextResponse.json(
        { error: "thinkingLevel is only supported for generate_section with Gemini models" },
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
    const { data: existing, error: existingError } = await supabase
      .from("step_model_configs")
      .select("thinking_level")
      .eq("step_name", stepName)
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

  const upsertWithThinking = await supabase.from("step_model_configs").upsert({
    step_name: stepName,
    model_id: modelId,
    thinking_level: resolvedThinking,
    updated_at: new Date().toISOString(),
  });
  if (upsertWithThinking.error) {
    const needsFallback = upsertWithThinking.error.message?.toLowerCase().includes("thinking_level");
    if (!needsFallback) {
      return NextResponse.json({ error: upsertWithThinking.error.message }, { status: 500 });
    }
    const legacyUpsert = await supabase.from("step_model_configs").upsert({
      step_name: stepName,
      model_id: modelId,
      updated_at: new Date().toISOString(),
    });
    if (legacyUpsert.error) {
      return NextResponse.json({ error: legacyUpsert.error.message }, { status: 500 });
    }
  }
  setStepModel(stepName, modelId);
  setStepThinkingLevel(stepName, resolvedThinking);

  return NextResponse.json({ ok: true });
}
