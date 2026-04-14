import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { getSessionUser } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/roles";
import {
  CORE_STEP_PROMPTS,
  getPromptOverrideByStepId,
  loadCoreStepPromptsFromDB,
  resolvePromptKindByStepId,
  resolvePromptIdByStepId,
} from "@/lib/config/corePrompts";
import { resolvePromptPath } from "@/ai/prompts/core";

function readLocalPrompt(kind: "step" | "section", promptId: string): string {
  const fullPath = resolvePromptPath(kind, promptId);
  if (!existsSync(fullPath)) {
    return "";
  }
  return readFileSync(fullPath, "utf-8");
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { supabase, user } = session;
  const canEdit = await isAdminUser({ supabase, userId: user.id });
  const overrides = await loadCoreStepPromptsFromDB();

  return NextResponse.json({
    canEdit,
    prompts: CORE_STEP_PROMPTS.map((item) => {
      const localPrompt = readLocalPrompt(item.kind, item.promptId);
      const dbPrompt = getPromptOverrideByStepId(overrides, item.stepId);
      return {
        stepId: item.stepId,
        kind: item.kind,
        promptId: item.promptId,
        label: item.label,
        localPrompt,
        dbPrompt,
        effectivePrompt: dbPrompt ?? localPrompt,
      };
    }),
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { supabase, user } = session;
  const canEdit = await isAdminUser({ supabase, userId: user.id });
  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json();
  const stepId = typeof body.stepId === "string" ? body.stepId : "";
  const promptContent = typeof body.promptContent === "string" ? body.promptContent : null;
  const promptId = resolvePromptIdByStepId(stepId);
  const kind = resolvePromptKindByStepId(stepId);
  if (!promptId || !kind) {
    return NextResponse.json({ error: "Invalid stepId" }, { status: 400 });
  }

  if (!promptContent || !promptContent.trim()) {
    const { error: deleteError } = await supabase
      .from("core_step_prompt_configs")
      .delete()
      .eq("step_id", stepId);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, stepId, kind, promptId, mode: "local" });
  }

  const { error: upsertError } = await supabase.from("core_step_prompt_configs").upsert({
    step_id: stepId,
    prompt_content: promptContent,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, stepId, kind, promptId, mode: "db" });
}
