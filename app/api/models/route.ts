import { NextRequest, NextResponse } from "next/server";
import { getAllModels, DEFAULT_MODEL, GENERATION_STEPS, setStepModel, getStepModel, type ModelConfig } from "@/lib/config/models";
import { supabase } from "@/lib/supabase";

/** GET /api/models — list all models + step config */
export async function GET() {
  // Load custom models from DB
  const { data: customRows } = await supabase
    .from("model_configs")
    .select("*")
    .order("created_at", { ascending: true });

  const customModels: ModelConfig[] = (customRows ?? []).map((r: { id: string; display_name: string; context_window: number }) => ({
    id: r.id,
    displayName: r.display_name,
    contextWindow: r.context_window,
  }));

  // Load step model assignments
  const { data: stepRows } = await supabase
    .from("step_model_configs")
    .select("*");

  const stepModels: Record<string, string> = {};
  for (const row of stepRows ?? []) {
    stepModels[(row as { step_name: string; model_id: string }).step_name] = (row as { step_name: string; model_id: string }).model_id;
    setStepModel((row as { step_name: string; model_id: string }).step_name, (row as { step_name: string; model_id: string }).model_id);
  }

  const allModels = [...getAllModels(), ...customModels];
  // Deduplicate by id
  const seen = new Set<string>();
  const models = allModels.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });

  return NextResponse.json({
    models: models.map((m) => ({ id: m.id, displayName: m.displayName, contextWindow: m.contextWindow })),
    default: DEFAULT_MODEL,
    steps: GENERATION_STEPS,
    stepModels,
  });
}

/** POST /api/models — add a custom model */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, displayName, contextWindow } = body;

  if (!id || !displayName) {
    return NextResponse.json({ error: "id and displayName are required" }, { status: 400 });
  }

  const { error } = await supabase.from("model_configs").upsert({
    id,
    display_name: displayName,
    context_window: contextWindow ?? 128_000,
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
  const { stepName, modelId } = await req.json();
  if (!stepName) return NextResponse.json({ error: "stepName required" }, { status: 400 });

  if (modelId) {
    await supabase.from("step_model_configs").upsert({
      step_name: stepName,
      model_id: modelId,
      updated_at: new Date().toISOString(),
    });
    setStepModel(stepName, modelId);
  } else {
    await supabase.from("step_model_configs").delete().eq("step_name", stepName);
  }

  return NextResponse.json({ ok: true });
}
