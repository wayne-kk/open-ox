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
import { createAgentSseSender } from "@/lib/transport/agentStreamSse";
import { tryCreateAgentStreamServerSession } from "@/lib/transport/agentStream.server";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";
import { runWithSiteRoot } from "@/ai/tools/system/common";
import {
  flushLangfuse,
  getLangfuseTraceId,
  resolveLangfuseSessionId,
  runWithLangfuseTraceRoot,
  updateLangfuseActiveTrace,
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
import { normalizeReferenceImageDataUrl } from "@/ai/flows/generate_project/shared/userVisionContent";
import type { GenerationRunPayloadBody } from "@/lib/generation/types";
import { enqueueGenerationJob } from "@/lib/generation/enqueueGenerationJob";
import { scheduleInlineGenerationRun } from "@/lib/generation/inlineGeneration";
import fs from "fs/promises";
import path from "path";
import { formatIntentAgentTraceSummary } from "@/ai/flows/generate_project/intentAgent/formatIntentAgentTrace";
import { trackServerAnalyticsEventFireAndForget } from "@/lib/analytics/serverEvents";

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
    inputProfile: turn.inputProfile,
    llmRoundCount: turn.llmRoundCount,
    trace: turn.trace,
    traceSummary: formatIntentAgentTraceSummary(turn.trace),
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
    const imageBase64Raw: unknown = body.imageBase64;
    const clientPublicKey: string | undefined =
      typeof body.clientPublicKey === "string" && body.clientPublicKey.trim()
        ? body.clientPublicKey.trim()
        : undefined;
    const resetSession: boolean = body.resetSession === true;
    /** Intent Agent already converged the brief — skip duplicate `project_intent_guide` in worker. */
    const enableIntentGuide: boolean = body.enableIntentGuide === true;
    const runGenerateOnCommit: boolean = body.runGenerateOnCommit !== false;
    const modelOverride: string | undefined = typeof body.model === "string" ? body.model : undefined;
    const enableIntentAgentWebSearch: boolean = body.enableIntentAgentWebSearch === true;
    const styleGuide: string | undefined =
      typeof body.styleGuide === "string" && body.styleGuide.trim()
        ? body.styleGuide.trim()
        : undefined;
    const confirmedDesignDirectionMarkdown: string | undefined =
      typeof body.confirmedDesignDirectionMarkdown === "string" &&
      body.confirmedDesignDirectionMarkdown.trim()
        ? body.confirmedDesignDirectionMarkdown.trim()
        : undefined;
    const confirmedDesignDirectionKeywords: string[] | undefined = Array.isArray(
      body.confirmedDesignDirectionKeywords
    )
      ? body.confirmedDesignDirectionKeywords
          .filter((k: unknown): k is string => typeof k === "string" && k.trim().length > 0)
          .map((k: string) => k.trim())
      : undefined;

    if (!projectId || typeof projectId !== "string" || !isSafeProjectId(projectId)) {
      return NextResponse.json({ error: "Missing or invalid projectId" }, { status: 400 });
    }

    const access = await requireOwnedProject(session, projectId);
    if ("error" in access) return access.error;
    const meta = access.project;

    const messageText = typeof message === "string" ? message : "";
    let clientImage: string | null = null;
    if (typeof imageBase64Raw === "string" && imageBase64Raw.trim()) {
      const raw = imageBase64Raw.trim();
      clientImage = raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
    }
    const storedImage = meta.referenceImageDataUrl?.trim() || null;
    const imageForTurn = clientImage || storedImage;

    if (!messageText.trim() && !imageForTurn) {
      return NextResponse.json(
        { error: "Missing or invalid message (or paste an image)" },
        { status: 400 }
      );
    }

    if (modelOverride) {
      setRuntimeModelId(modelOverride as ModelId);
    }

    await loadStepModelsFromDB();

    const encoder = new TextEncoder();
    const secureSession = tryCreateAgentStreamServerSession(clientPublicKey);

    const stream = new ReadableStream({
      async start(controller) {
        const send = createAgentSseSender({
          controller,
          encoder,
          secureSession,
        });

        try {
          const projectRoot = path.join(process.cwd(), "sites", projectId);
          await fs.mkdir(projectRoot, { recursive: true });

          try {
            await fs.access(path.join(projectRoot, "package.json"));
          } catch {
            await initProjectDir(db, projectId);
          }

          const langfuseSessionKey = resolveLangfuseSessionId({
            projectId,
            clientSessionId:
              typeof body.langfuseSessionId === "string" ? body.langfuseSessionId : undefined,
          });

          trackServerAnalyticsEventFireAndForget({
            userId: user.id,
            eventName: "intent_agent_start",
            properties: { projectId },
            sessionId: langfuseSessionKey,
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
              input: { message: messageText, hasReferenceImage: Boolean(imageForTurn) },
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
              userMessage: messageText,
              userImageBase64: imageForTurn,
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

          trackServerAnalyticsEventFireAndForget({
            userId: user.id,
            eventName: "intent_turn",
            properties: { projectId, status: intentResult.status },
            sessionId: langfuseSessionKey,
          });

          if (intentResult.status !== "commit_generate") {
            const traceBlock = formatIntentAgentTraceSummary(intentResult.trace);
            const userFacing =
              intentResult.yieldPayload?.message ??
              intentResult.assistantText ??
              intentResult.errorMessage ??
              "awaiting user input";

            await updateProjectStatus(db, projectId, "awaiting_input", {
              error: intentResult.status === "error" ? intentResult.errorMessage : undefined,
              buildSteps: [
                {
                  step: "intent_agent",
                  status: intentResult.status === "error" ? "error" : "ok",
                  detail: userFacing,
                  timestamp: Date.now(),
                  duration: 0,
                  ...(intentResult.yieldPayload || traceBlock
                    ? {
                        trace: {
                          output: {
                            status: intentResult.status,
                            ...(intentResult.yieldPayload
                              ? {
                                  yieldPayload: {
                                    kind: intentResult.yieldPayload.kind,
                                    message: intentResult.yieldPayload.message,
                                    suggestedReplies: intentResult.yieldPayload.suggestedReplies,
                                    options: intentResult.yieldPayload.options,
                                    briefDraftMarkdown: intentResult.yieldPayload.briefDraftMarkdown,
                                  },
                                }
                              : {}),
                            ...(traceBlock ? { traceSummary: traceBlock } : {}),
                          },
                        },
                      }
                    : {}),
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
          let referenceForGeneration =
            typeof imageForTurn === "string" && imageForTurn.trim() ? imageForTurn.trim() : null;
          if (!referenceForGeneration) {
            const row = await getProject(db, projectId);
            referenceForGeneration = row?.referenceImageDataUrl?.trim() || null;
          }
          const intentRunPayload: GenerationRunPayloadBody = {
            requestingUserId: user.id,
            effectivePrompt: mergedBrief,
            ...(intentResult.imageSourceTexts?.length
              ? { userImageSourceTexts: intentResult.imageSourceTexts }
              : {}),
            effectiveModel: modelOverride ?? meta.modelId ?? undefined,
            ...(typeof body.effortTier === "string" ? { effortTier: body.effortTier } : {}),
            effectiveGenerationMode: meta.generationMode ?? "web",
            preCreatedProjectId: projectId,
            resumeFromCheckpoint: false,
            enableSkills: true,
            enableIntentGuide,
            ...(styleGuide ? { styleGuide } : {}),
            ...(confirmedDesignDirectionMarkdown
              ? { confirmedDesignDirectionMarkdown }
              : {}),
            ...(confirmedDesignDirectionKeywords?.length
              ? { confirmedDesignDirectionKeywords }
              : {}),
            ...(typeof body.langfuseSessionId === "string"
              ? { langfuseSessionId: body.langfuseSessionId }
              : {}),
            useDatabasePrompts: false,
            ...(referenceForGeneration
              ? { initialImageBase64: normalizeReferenceImageDataUrl(referenceForGeneration) }
              : {}),
          };

          // T1: promote intent root → project_build and hand the same trace id to the worker.
          const activeTraceId = getLangfuseTraceId();
          if (activeTraceId) {
            updateLangfuseActiveTrace({
              name: LfTrace.projectBuild,
              tags: ["flow:project_build", "route:api_intent_agent", "phase:generation_queued"],
              metadata: {
                projectId,
                status: "generation_queued",
                resetSession,
                runGenerateOnCommit,
              },
            });
            intentRunPayload.langfuseTraceId = activeTraceId;
          }

          const { runId, attached } = await enqueueGenerationJob({
            db,
            projectId,
            ownerUserId: user.id,
            kind: "new",
            resumeFromCheckpoint: false,
            payload: intentRunPayload,
          });

          if (activeTraceId) {
            updateLangfuseActiveTrace({
              metadata: {
                projectId,
                status: "generation_queued",
                generationRunId: runId,
                resetSession,
                runGenerateOnCommit,
              },
            });
          }

          scheduleInlineGenerationRun(runId);

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
