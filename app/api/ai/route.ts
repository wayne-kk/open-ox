/**
 * POST /api/ai — enqueue background generation (worker executes runGenerateProject).
 *
 * Returns JSON: { ok, async, projectId, runId, attached }
 *
 * Clients poll GET /api/projects/:id — buildSteps merge live steps from generation_events while status=generating.
 */
import {
  createProject,
  updateProjectStatus,
} from "@/lib/projectManager";
import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";
import { getUserDisplayName } from "@/lib/auth/display-name";
import type { GenerationRunPayloadBody } from "@/lib/generation/types";
import { parseSelectedDesignSystemSkill } from "@/lib/generation/selectedDesignSystemSkill";
import {
  enqueueGenerationJob,
  getActiveQueuedOrRunningRunId,
} from "@/lib/generation/enqueueGenerationJob";
import { scheduleInlineGenerationRun } from "@/lib/generation/inlineGeneration";
import {
  selectEffectiveGenerationPrompt,
  selectPreviousCommittedGenerationPrompt,
  shouldEnableIntentGuideForGeneration,
} from "@/lib/generation/intentGuideLifecycle";
import { canAfford } from "@/lib/billing/account";
import { isCreditsEnabled, MIN_GENERATE_CREDITS } from "@/lib/billing/credits";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    const { supabase: db, user } = session;

    const body = await req.json();
    const userPrompt: unknown = body.userPrompt ?? body.input;
    const modelOverride: string | undefined = body.model;
    const retryProjectId: string | undefined = body.retryProjectId;
    const resumeFromCheckpoint =
      retryProjectId != null &&
      typeof body.resumeFromCheckpoint === "boolean" &&
      body.resumeFromCheckpoint;
    const preCreatedProjectId: string | undefined = body.projectId;
    const enableIntentGuide = shouldEnableIntentGuideForGeneration({
      retryProjectId,
      requested:
        typeof body.enableIntentGuide === "boolean"
          ? body.enableIntentGuide
          : undefined,
    });
    const folderId: string | null | undefined =
      typeof body.folderId === "string" ? body.folderId : body.folderId === null ? null : undefined;
    const requestGenerationMode: string | undefined = body.generationMode;
    if (requestGenerationMode !== undefined && requestGenerationMode !== "web") {
      return NextResponse.json({ error: "Invalid generationMode" }, { status: 400 });
    }

    let effectivePrompt: string | undefined;
    let effectiveModel = modelOverride;
    let effectiveGenerationMode = requestGenerationMode ?? "web";
    if (retryProjectId || preCreatedProjectId) {
      const lookupId = retryProjectId ?? preCreatedProjectId!;
      const access = await requireOwnedProject(session, lookupId);
      if ("error" in access) return access.error;
      const existing = access.project;
      let previousRunPrompt: string | undefined;
      if (retryProjectId && !(typeof userPrompt === "string" && userPrompt.trim())) {
        const { data: previousRuns } = await db
          .from("generation_runs")
          .select("payload")
          .eq("project_id", retryProjectId)
          .contains("payload", { enableIntentGuide: false })
          .order("created_at", { ascending: false })
          .limit(1);
        const previousPayloads = (previousRuns ?? []).map(
          (run) => run.payload as Partial<GenerationRunPayloadBody>,
        );
        previousRunPrompt =
          selectPreviousCommittedGenerationPrompt(previousPayloads);
      }
      effectivePrompt = selectEffectiveGenerationPrompt({
        retryProjectId,
        requestPrompt: userPrompt,
        previousRunPrompt,
        projectPrompt: existing.userPrompt,
      });
      if (!effectiveModel && existing.modelId) effectiveModel = existing.modelId;
      effectiveGenerationMode = existing.generationMode ?? "web";
    } else {
      effectivePrompt = selectEffectiveGenerationPrompt({
        requestPrompt: userPrompt,
      });
    }

    if (!effectivePrompt || typeof effectivePrompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'userPrompt' field" },
        { status: 400 }
      );
    }

    if (isCreditsEnabled()) {
      const afford = await canAfford(db, user.id, MIN_GENERATE_CREDITS);
      if (!afford.ok) {
        return NextResponse.json(
          {
            error: "Insufficient credits",
            code: "INSUFFICIENT_CREDITS",
            balance: afford.balance,
            required: MIN_GENERATE_CREDITS,
            pricingPath: "/pricing",
          },
          { status: 402 }
        );
      }
    }

    let projectId: string;

    if (retryProjectId) {
      projectId = retryProjectId;
      const alive = await getActiveQueuedOrRunningRunId(db, projectId);
      if (alive) {
        return NextResponse.json({
          ok: true,
          async: true,
          projectId,
          runId: alive,
          attached: true,
        });
      }
      await updateProjectStatus(db, projectId, "generating", {
        error: undefined,
        ...(resumeFromCheckpoint ? {} : { buildSteps: [] }),
      });
    } else if (preCreatedProjectId) {
      projectId = preCreatedProjectId;
    } else {
      const project = await createProject(db, {
        userPrompt: effectivePrompt,
        userId: user.id,
        ownerUsername: getUserDisplayName(user),
        modelId: effectiveModel,
        folderId: folderId ?? null,
      });
      projectId = project.id;
    }

    const kind: "new" | "retry" | "resume" =
      retryProjectId != null ? (resumeFromCheckpoint ? "resume" : "retry") : "new";

    const initialImage =
      typeof body.imageBase64 === "string" && body.imageBase64.trim()
        ? body.imageBase64.trim()
        : undefined;
    const selectedDesignSystemSkill = parseSelectedDesignSystemSkill(
      body.selectedDesignSystemSkill
    );
    const styleGuide =
      typeof body.styleGuide === "string" && body.styleGuide.trim()
        ? body.styleGuide.trim()
        : undefined;

    const payload: GenerationRunPayloadBody = {
      requestingUserId: user.id,
      effectivePrompt,
      effectiveModel,
      ...(typeof body.effortTier === "string" ? { effortTier: body.effortTier } : {}),
      effectiveGenerationMode,
      ...(retryProjectId ? { retryProjectId } : {}),
      ...(!retryProjectId && preCreatedProjectId ? { preCreatedProjectId } : {}),
      resumeFromCheckpoint,
      enableSkills: true,
      enableIntentGuide,
      ...(styleGuide ? { styleGuide } : {}),
      ...(selectedDesignSystemSkill ? { selectedDesignSystemSkill } : {}),
      ...(typeof body.langfuseSessionId === "string"
        ? { langfuseSessionId: body.langfuseSessionId }
        : {}),
      useDatabasePrompts: false,
      ...(initialImage ? { initialImageBase64: initialImage } : {}),
    };

    const { runId, attached, shouldScheduleInline } =
      await enqueueGenerationJob({
        db,
        projectId,
        ownerUserId: user.id,
        kind,
        resumeFromCheckpoint,
        payload,
      });

    if (shouldScheduleInline) {
      scheduleInlineGenerationRun(runId);
    }

    return NextResponse.json({
      ok: true,
      async: true,
      projectId,
      runId,
      attached,
    });
  } catch (err) {
    console.error("[AI API]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
