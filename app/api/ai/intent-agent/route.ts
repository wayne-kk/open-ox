/**
 * POST /api/ai/intent-agent
 *
 * Task Agent：可多轮 yield / resume；commit 后入队后台生成（由 generation worker 执行）。
 */
import {
  getProject,
  initProjectDir,
  getSiteRoot as projectManagerGetSiteRoot,
  updateProjectStatus,
} from "@/lib/projectManager";
import { setRuntimeModelId, type ModelId } from "@/lib/config/models";
import { loadStepModelsFromDB } from "@/lib/config/models";
import { SSE_RESPONSE_HEADERS } from "@/lib/sse-headers";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { runWithSiteRoot } from "@/ai/tools/system/common";
import { appendTrajectoryEvent, createRunEndEvent, createTrajectoryRun } from "@/lib/trajectory/store";
import {
  flushLangfuse,
  resolveLangfuseSessionId,
  runWithLangfuseTraceRoot,
  withLangfuseSpan,
} from "@/lib/observability/langfuseTracing";
import { LfSpanIntent, LfTrace } from "@/lib/observability/langfuseTraceCatalog";
import { executeWebSearch, webSearchTool } from "@/ai/tools/system/webSearchTool";
import {
  coerceAdditionalToolsFromJson,
  intentAgentFunctionName,
  type IntentAgentToolHandler,
  runIntentAgentTurn,
  isSafeProjectId,
} from "@/ai/flows/generate_project/intentAgent";
import type { GenerationRunPayloadBody } from "@/lib/generation/types";
import {
  enqueueGenerationJob,
  getActiveQueuedOrRunningRunId,
} from "@/lib/generation/enqueueGenerationJob";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

function serializeIntentTurn(
  turn: Awaited<ReturnType<typeof runIntentAgentTurn>>
): Record<string, unknown> {
  return {
    status: turn.status,
    turnCounter: turn.turnCounter,
    mergedBrief: turn.mergedBrief,
    errorMessage: turn.errorMessage,
    assistantText: turn.assistantText,
    yieldPayload: turn.yieldPayload
      ? {
          kind: turn.yieldPayload.kind,
          message: turn.yieldPayload.message,
          suggestedReplies: turn.yieldPayload.suggestedReplies,
          options: turn.yieldPayload.options,
          briefDraftMarkdown: turn.yieldPayload.briefDraftMarkdown,
        }
      : undefined,
    toolCallNames: turn.toolCalls.map((t) => t.name),
  };
}

export async function POST(req: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    const { supabase: db, user } = session;

    const body = await req.json().catch(() => ({}));
    const projectId: unknown = body.projectId;
    const message: unknown = body.message;
    const resetSession: boolean = body.resetSession === true;
    const enableIntentGuide: boolean = body.enableIntentGuide !== false;
    const runGenerateOnCommit: boolean = body.runGenerateOnCommit !== false;
    const modelOverride: string | undefined = typeof body.model === "string" ? body.model : undefined;
    const enableIntentAgentWebSearch: boolean = body.enableIntentAgentWebSearch === true;

    if (!projectId || typeof projectId !== "string" || !isSafeProjectId(projectId)) {
      return NextResponse.json({ error: "Missing or invalid projectId" }, { status: 400 });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Missing or invalid message" }, { status: 400 });
    }

    const meta = await getProject(db, projectId);
    if (!meta) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (meta.ownerUserId && meta.ownerUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (modelOverride) {
      setRuntimeModelId(modelOverride as ModelId);
    }

    await loadStepModelsFromDB();

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        };

        let trajectory: { runId: string; taskId: string } | null = null;
        try {
          const projectRoot = path.join(process.cwd(), "sites", projectId);
          await fs.mkdir(projectRoot, { recursive: true });

          try {
            await fs.access(path.join(projectRoot, "package.json"));
          } catch {
            await initProjectDir(db, projectId);
          }

          try {
            const taskId = `intent_agent:${projectId}`;
            const run = await createTrajectoryRun({
              task_id: taskId,
              goal: `[intent-agent] ${String(message).trim()}`,
              task_spec_ref: "open-ox.intent-agent",
              environment: {
                route: "/api/ai/intent-agent",
                project_id: projectId,
              },
              success_criteria: [
                "intent agent turn completed or generation handed off",
                "session state persisted on yield",
              ],
            }).catch(() => null);
            if (run) {
              trajectory = { runId: run.runId, taskId };
            }
          } catch {
            trajectory = null;
          }

          const langfuseSessionKey = resolveLangfuseSessionId({
            projectId,
            clientSessionId:
              typeof body.langfuseSessionId === "string" ? body.langfuseSessionId : undefined,
            trajectoryRunId: trajectory?.runId,
          });

          await runWithLangfuseTraceRoot(
            {
              name: LfTrace.intentAgent,
              userId: user.id,
              sessionId: langfuseSessionKey,
              tags: ["flow:intent_agent", "route:api_intent_agent"],
              metadata: {
                projectId,
                resetSession,
                runGenerateOnCommit,
              },
              input: { message: message.trim() },
            },
            async () => {
              await runWithSiteRoot(projectManagerGetSiteRoot(projectId), async () => {
          const additionalParsed = coerceAdditionalToolsFromJson(body.additionalTools);
          const mergedExtraTools = [...additionalParsed];
          if (
            enableIntentAgentWebSearch &&
            !mergedExtraTools.some((t) => intentAgentFunctionName(t) === "web_search")
          ) {
            mergedExtraTools.unshift(webSearchTool);
          }

          const toolHandlers: Record<string, IntentAgentToolHandler> = {};
          if (enableIntentAgentWebSearch) {
            toolHandlers.web_search = executeWebSearch;
          }

          const intentToolExtensions =
            mergedExtraTools.length > 0 || Object.keys(toolHandlers).length > 0
              ? {
                  tools: mergedExtraTools.length > 0 ? mergedExtraTools : undefined,
                  toolHandlers: Object.keys(toolHandlers).length > 0 ? toolHandlers : undefined,
                }
              : undefined;

          const intentResult = await withLangfuseSpan(LfSpanIntent.agentTurn, () =>
            runIntentAgentTurn({
              projectId,
              userMessage: message.trim(),
              bootstrapUserPrompt: meta.userPrompt ?? null,
              resetSession,
              toolExtensions: intentToolExtensions,
              onIntentProgress: (evt) => {
                send({
                  type: "intent_progress",
                  ...evt,
                });
              },
            })
          );

          send({ type: "intent_agent_turn", turn: serializeIntentTurn(intentResult) });

          if (intentResult.status !== "commit_generate") {
            await updateProjectStatus(db, projectId, "awaiting_input", {
              error: intentResult.status === "error" ? intentResult.errorMessage : undefined,
              buildSteps: [
                {
                  step: "intent_agent",
                  status: intentResult.status === "error" ? "error" : "ok",
                  detail:
                    intentResult.yieldPayload?.message ??
                    intentResult.assistantText ??
                    intentResult.errorMessage ??
                    "awaiting user input",
                  timestamp: Date.now(),
                  duration: 0,
                },
              ],
            });
            send({
              type: "done",
              phase: "intent_only",
              result: {
                projectId,
                intentAgent: serializeIntentTurn(intentResult),
                content:
                  intentResult.yieldPayload?.message ??
                  intentResult.assistantText ??
                  intentResult.errorMessage ??
                  "",
              },
            });
            if (trajectory) {
              await appendTrajectoryEvent(trajectory.runId, {
                task_id: trajectory.taskId,
                phase: "planning",
                event_type: "checkpoint",
                actor: "agent",
                payload: { intent_status: intentResult.status },
                meta: { source: "intent_agent" },
              }).catch(() => null);
              await createRunEndEvent(trajectory.runId, trajectory.taskId, "system", {
                success: intentResult.status !== "error",
                intent_status: intentResult.status,
              }).catch(() => null);
            }
            return;
          }

          send({
            type: "intent_agent_commit",
            mergedBrief: intentResult.mergedBrief,
          });

          if (!runGenerateOnCommit) {
            send({
              type: "done",
              phase: "commit_only",
              result: {
                projectId,
                mergedBrief: intentResult.mergedBrief,
                intentAgent: serializeIntentTurn(intentResult),
              },
            });
            return;
          }

          if (!intentResult.mergedBrief?.trim()) {
            throw new Error("commit_generate invoked without a merged brief.");
          }

          const mergedBrief = intentResult.mergedBrief!.trim();
          const intentRunPayload: GenerationRunPayloadBody = {
            requestingUserId: user.id,
            effectivePrompt: mergedBrief,
            effectiveModel: modelOverride ?? meta.modelId ?? undefined,
            effectiveGenerationMode: meta.generationMode ?? "web",
            preCreatedProjectId: projectId,
            resumeFromCheckpoint: false,
            enableSkills: true,
            enableIntentGuide,
            ...(typeof body.langfuseSessionId === "string"
              ? { langfuseSessionId: body.langfuseSessionId }
              : {}),
            useDatabasePrompts: false,
          };

          let runId: string;
          let attached: boolean;
          const aliveRunId = await getActiveQueuedOrRunningRunId(db, projectId);
          if (aliveRunId) {
            runId = aliveRunId;
            attached = true;
          } else {
            const job = await enqueueGenerationJob({
              db,
              projectId,
              ownerUserId: user.id,
              kind: "new",
              resumeFromCheckpoint: false,
              payload: intentRunPayload,
            });
            runId = job.runId;
            attached = job.attached;
          }

          send({
            type: "done",
            phase: "generation_queued",
            result: {
              projectId,
              runId,
              attached,
              mergedBriefFromAgent: mergedBrief,
              intentAgent: serializeIntentTurn(intentResult),
              content:
                "需求已确认，生成任务已进入后台队列。你可关闭页面，稍后刷新查看进度或结果。",
              generationQueued: true,
            },
          });
              });
            }
          );
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          send({ type: "error", message: errMsg });
          try {
            await updateProjectStatus(db, projectId, "failed", { error: errMsg });
          } catch {
            // ignore
          }
        } finally {
          await flushLangfuse();
          setRuntimeModelId(null);
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: SSE_RESPONSE_HEADERS });
  } catch (err) {
    console.error("[intent-agent]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
