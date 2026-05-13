/**
 * POST /api/ai — enqueue background generation (worker executes runGenerateProject).
 *
 * Returns JSON: { ok, async, projectId, runId, attached }
 *
 * Clients poll GET /api/projects/:id — buildSteps merge live steps from generation_events while status=generating.
 */
import {
  createProject,
  getProject,
  updateProjectStatus,
} from "@/lib/projectManager";
import { getSessionUser } from "@/lib/auth/session";
import { getUserDisplayName } from "@/lib/auth/display-name";
import type { GenerationRunPayloadBody } from "@/lib/generation/types";
import {
  enqueueGenerationJob,
  getActiveQueuedOrRunningRunId,
} from "@/lib/generation/enqueueGenerationJob";
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
    const styleGuide: string | undefined = body.styleGuide;
    const enableSkills: boolean = body.enableSkills !== false;
    const enableIntentGuide: boolean = body.enableIntentGuide !== false;
    const folderId: string | null | undefined =
      typeof body.folderId === "string" ? body.folderId : body.folderId === null ? null : undefined;
    const requestGenerationMode: string | undefined = body.generationMode;
    if (requestGenerationMode !== undefined && requestGenerationMode !== "web") {
      return NextResponse.json({ error: "Invalid generationMode" }, { status: 400 });
    }

    let effectivePrompt = userPrompt as string | undefined;
    let effectiveModel = modelOverride;
    let effectiveGenerationMode = requestGenerationMode ?? "web";
    if (retryProjectId || preCreatedProjectId) {
      const lookupId = retryProjectId ?? preCreatedProjectId!;
      const existing = await getProject(db, lookupId);
      if (!existing) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }
      if (!effectivePrompt) effectivePrompt = existing.userPrompt;
      if (!effectiveModel && existing.modelId) effectiveModel = existing.modelId;
      effectiveGenerationMode = existing.generationMode ?? "web";
    }

    if (!effectivePrompt || typeof effectivePrompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'userPrompt' field" },
        { status: 400 }
      );
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

    const payload: GenerationRunPayloadBody = {
      requestingUserId: user.id,
      effectivePrompt,
      effectiveModel,
      effectiveGenerationMode,
      ...(retryProjectId ? { retryProjectId } : {}),
      ...(!retryProjectId && preCreatedProjectId ? { preCreatedProjectId } : {}),
      resumeFromCheckpoint,
      ...(styleGuide !== undefined ? { styleGuide } : {}),
      enableSkills,
      enableIntentGuide,
      ...(typeof body.langfuseSessionId === "string"
        ? { langfuseSessionId: body.langfuseSessionId }
        : {}),
      useDatabasePrompts: false,
    };

    const { runId, attached } = await enqueueGenerationJob({
      db,
      projectId,
      ownerUserId: user.id,
      kind,
      resumeFromCheckpoint,
      payload,
    });

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
