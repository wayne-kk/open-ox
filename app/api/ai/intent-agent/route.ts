/**
 * POST /api/ai/intent-agent
 *
 * Task Agent：可多轮 yield / resume；commit 后可在同一条 SSE 中衔接 `runGenerateProject`。
 *
 * Body JSON:
 *   - projectId: string (required)
 *   - message: string (required)
 *   - resetSession?: boolean
 *   - additionalTools?: OpenAI-format function tool array (merged server-side)
 *   - enableIntentAgentWebSearch?: boolean
 *   - styleGuide?, enableSkills?, enableIntentGuide?, model? — applied only when committing and running generation
 *   - runGenerateOnCommit?: boolean (default true)
 *   - langfuseSessionId?: string — optional override for Langfuse Session grouping; default
 *     is one Session per `projectId` (all intent / generate / modify traces for the site
 *     aggregate under the same Session row).
 */

import { runGenerateProject } from "@/ai/flows";
import {
  detectCheckpoint,
  type CheckpointResult,
} from "@/ai/flows/generate_project/shared/checkpoint";
import {
  getProject,
  initProjectDir,
  getSiteRoot as projectManagerGetSiteRoot,
  updateProjectStatus,
  renameProject,
} from "@/lib/projectManager";
import { scheduleUploadFullProject } from "@/lib/storage";
import { setRuntimeModelId, type ModelId } from "@/lib/config/models";
import { loadStepModelsFromDB } from "@/lib/config/models";
import {
  loadCoreStepPromptsFromDB,
  normalizePromptProfile,
  withCorePromptRuntime,
} from "@/lib/config/corePrompts";
import type { BuildStep } from "@/ai/flows";
import { redactBuildStepForTransport } from "@/ai/flows/generate_project/shared/buildStepPayload";
import { shouldSkipNamingFromBlueprintTitle } from "@/ai/flows/generate_project/intentAgent/commitMergeBrief";
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
    const styleGuide: string | undefined =
      typeof body.styleGuide === "string" ? body.styleGuide : undefined;
    // Default ON — matches runGenerateProject's `options.enableSkills !== false`
    // contract so resume / modify flows get skill matching unless they
    // explicitly opt out with `enableSkills: false`.
    const enableSkills: boolean = body.enableSkills !== false;
    const enableIntentGuide: boolean = body.enableIntentGuide !== false;
    const runGenerateOnCommit: boolean = body.runGenerateOnCommit !== false;
    const modelOverride: string | undefined = typeof body.model === "string" ? body.model : undefined;
    const enableIntentAgentWebSearch: boolean = body.enableIntentAgentWebSearch === true;

    const useDatabasePrompts = false;
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
    const promptProfile = normalizePromptProfile("web");
    const corePromptOverrides = useDatabasePrompts
      ? await loadCoreStepPromptsFromDB(promptProfile)
      : new Map();

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
            () =>
              runWithSiteRoot(projectManagerGetSiteRoot(projectId), async () => {
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

          let checkpoint: CheckpointResult | undefined;
          const existing = await getProject(db, projectId);
          if (existing?.buildSteps && existing.buildSteps.length > 0) {
            checkpoint = detectCheckpoint(existing);
          }

          const onStep = (step: BuildStep) => {
            send({ type: "step", ...redactBuildStepForTransport(step) });
          };

          const genResult = await withCorePromptRuntime(
            {
              promptProfile,
              useDatabasePrompts,
              dbPromptByStepId: corePromptOverrides,
            },
            () =>
              withLangfuseSpan(LfSpanIntent.mergedBriefGeneration, () =>
                runGenerateProject(
                  intentResult.mergedBrief!,
                  onStep,
                  {
                    projectId,
                    styleGuide,
                    enableSkills,
                    useDatabasePrompts,
                    checkpoint,
                    enableIntentGuide,
                    langfuseUserId: user.id,
                    langfuseSessionId: langfuseSessionKey,
                  }
                )
              )
          );

          const fileSummary = `生成了 ${genResult.generatedFiles.length} 个文件：\n${genResult.generatedFiles.join("\n")}`;
          const logSummary = genResult.logDirectory ? `\n\n日志目录：${genResult.logDirectory}` : "";
          const content = genResult.intentGuideDeferred && genResult.intentGuide
            ? genResult.intentGuide.assistantMessage
            : genResult.success
              ? genResult.verificationStatus === "passed"
                ? `项目构建完成并通过校验。\n${fileSummary}${logSummary}`
                : `项目文件已写入正式目录，但当前未通过校验，相关生成文件已标记。\n${fileSummary}${logSummary}`
              : `项目生成失败：${genResult.error}`;

          if (genResult.success) {
            await updateProjectStatus(db, projectId, "ready", {
              completedAt: new Date().toISOString(),
              verificationStatus: genResult.verificationStatus,
              blueprint: genResult.blueprint,
              buildSteps: genResult.steps.map(redactBuildStepForTransport),
              generatedFiles: genResult.generatedFiles,
              logDirectory: genResult.logDirectory,
              totalDuration: genResult.totalDuration,
            });
            const projectTitle = (genResult.blueprint as { brief?: { projectTitle?: string } })?.brief
              ?.projectTitle;
            if (
              projectTitle &&
              projectTitle.trim() &&
              !shouldSkipNamingFromBlueprintTitle(projectTitle)
            ) {
              await renameProject(db, projectId, projectTitle.trim());
            }
            scheduleUploadFullProject(projectId);
          } else if (genResult.intentGuideDeferred && genResult.intentGuide) {
            await updateProjectStatus(db, projectId, "failed", {
              error: `[intent_guide] ${genResult.intentGuide.assistantMessage.slice(0, 480)}`,
              buildSteps: genResult.steps.map(redactBuildStepForTransport),
            });
          } else {
            await updateProjectStatus(db, projectId, "failed", {
              error: genResult.error ?? "Generation failed",
              buildSteps: genResult.steps.map(redactBuildStepForTransport),
            });
          }

          send({
            type: "done",
            phase: "full_pipeline",
            result: {
              content,
              projectId,
              mergedBriefFromAgent: intentResult.mergedBrief,
              generatedFiles: genResult.generatedFiles,
              blueprint: genResult.blueprint,
              verificationStatus: genResult.verificationStatus,
              unvalidatedFiles: genResult.unvalidatedFiles,
              installedDependencies: genResult.installedDependencies,
              dependencyInstallFailures: genResult.dependencyInstallFailures,
              buildSteps: genResult.steps.map(redactBuildStepForTransport),
              logDirectory: genResult.logDirectory,
              buildTotalDuration: genResult.totalDuration,
              intentGuideDeferred: genResult.intentGuideDeferred === true,
              intentGuide: genResult.intentGuide
                ? {
                    outcome: genResult.intentGuide.outcome,
                    phase: genResult.intentGuide.phase,
                    assistantMessage: genResult.intentGuide.assistantMessage,
                    suggestedReplies: genResult.intentGuide.suggestedReplies,
                    choiceOptions: genResult.intentGuide.choiceOptions,
                    buildPromptAppendix: genResult.intentGuide.buildPromptAppendix,
                  }
                : undefined,
              intentAgent: serializeIntentTurn(intentResult),
            },
          });
          })
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
