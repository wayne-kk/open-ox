/**
 * POST /api/projects/[id]/modify
 *
 * Accepts { userInstruction } and streams SSE events from runModifyProject.
 * Optional body.langfuseSessionId — 自定义 Langfuse Session；不传则按路径中的项目 `id` 聚合为一条 Session。
 * Returns 404 if the project is not found.
 *
 * SSE format (same as Generate_Flow):
 *   data: {"type":"step", "name": string, "status": "running"|"done"|"error"}\n\n
 *   data: {"type":"done"}\n\n
 *   data: {"type":"error", "message": string}\n\n
 */

import { NextResponse } from "next/server";
import { SSE_RESPONSE_HEADERS } from "@/lib/sse-headers";
import { createAgentSseSender } from "@/lib/transport/agentStreamSse";
import { tryCreateAgentStreamServerSession } from "@/lib/transport/agentStream.server";
import {
  fromClientPayload,
  type ModifyHistoryTurn,
} from "@/ai/flows/modify_project/history/modifyHistoryTurn";
import { runModifyProject } from "@/ai/flows/modify_project/runModifyProject";
import type { ModifySSEEvent } from "@/ai/flows/modify_project/runModifyProject";
import { schedulePostModifyPreviewPipeline } from "@/lib/postGenerationPreviewPipeline";
import { classifyModificationScope } from "@/lib/devServerManager";
import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";
import { flushLangfuse, resolveLangfuseSessionId, runWithLangfuseTraceRoot } from "@/lib/observability/langfuseTracing";
import { LfTrace } from "@/lib/observability/langfuseTraceCatalog";
import { trackServerAnalyticsEventFireAndForget } from "@/lib/analytics/serverEvents";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { user } = session;

  const { id } = await params;

  // Validate project exists and caller owns it before streaming
  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;
  const { db } = access;

  let userInstruction: string;
  let modelOverride: string | undefined;
  let conversationHistory: ModifyHistoryTurn[] | undefined;
  let clearContext = false;
  let imageBase64: string | undefined;
  let langfuseSessionIdBody: string | undefined;
  let clientPublicKey: string | undefined;
  try {
    const body = await req.json();
    userInstruction = body.userInstruction;
    modelOverride = body.model;
    if (Array.isArray(body.conversationHistory)) {
      const parsed: ModifyHistoryTurn[] = [];
      for (const item of body.conversationHistory as unknown[]) {
        const turn = fromClientPayload(item);
        if (turn) parsed.push(turn);
      }
      conversationHistory = parsed;
    }
    clearContext = body.clearContext === true;
    langfuseSessionIdBody =
      typeof body.langfuseSessionId === "string" && body.langfuseSessionId.trim()
        ? body.langfuseSessionId.trim()
        : undefined;
    imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : undefined;
    clientPublicKey =
      typeof body.clientPublicKey === "string" && body.clientPublicKey.trim()
        ? body.clientPublicKey.trim()
        : undefined;
    if (clearContext) conversationHistory = [];
    if (!userInstruction || typeof userInstruction !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'userInstruction' field", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const secureSession = tryCreateAgentStreamServerSession(clientPublicKey);

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const sendPlain = createAgentSseSender({
        controller,
        encoder,
        secureSession,
      });
      const send = (event: ModifySSEEvent) => {
        if (closed) return;
        try {
          sendPlain(event as Record<string, unknown>);
        } catch {
          closed = true;
        }
      };

      const collectedDiffs: Array<{ file: string; reasoning: string; patch: string; stats: { additions: number; deletions: number } }> = [];
      let buildPassed = false;
      let modifySucceeded = false;

      try {
        const langfuseSessionKey = resolveLangfuseSessionId({
          projectId: id,
          clientSessionId: langfuseSessionIdBody,
        });

        trackServerAnalyticsEventFireAndForget({
          userId: user.id,
          eventName: "modify_start",
          properties: { projectId: id },
          sessionId: langfuseSessionKey,
        });

        await runWithLangfuseTraceRoot(
          {
            name: LfTrace.modifyProject,
            userId: user.id,
            sessionId: langfuseSessionKey,
            tags: ["flow:modify_project", "route:api_modify"],
            input: { userInstruction },
            metadata: { projectId: id, modelOverride: modelOverride ?? null },
          },
          () =>
            runModifyProject(
              db,
              id,
              userInstruction,
              (event) => {
                send(event);
                if (event.type === "diff") {
                  collectedDiffs.push({
                    file: (event as { file: string }).file,
                    reasoning: (event as { reasoning: string }).reasoning,
                    patch: (event as { patch: string }).patch,
                    stats: (event as { stats: { additions: number; deletions: number } }).stats,
                  });
                } else if (event.type === "step" && event.name === "agent_loop") {
                  if (event.message?.includes("build=passed")) buildPassed = true;
                }
              },
              conversationHistory,
              clearContext,
              imageBase64,
              modelOverride
            )
        );

        const touchedFiles = collectedDiffs.map((d) => d.file);
        if (touchedFiles.length > 0) {
          schedulePostModifyPreviewPipeline(db, id, { buildPassed });
        }

        const refreshMode = classifyModificationScope(collectedDiffs);

        send({
          type: "done",
          refreshMode,
          changedFiles: touchedFiles,
          diffs: collectedDiffs,
          buildPassed,
        } as ModifySSEEvent & { refreshMode: string; changedFiles: string[]; diffs: typeof collectedDiffs; buildPassed: boolean });
        modifySucceeded = true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error";
        send({ type: "error", message });
      } finally {
        trackServerAnalyticsEventFireAndForget({
          userId: user.id,
          eventName: "modify_complete",
          properties: { projectId: id, success: modifySucceeded },
          sessionId: resolveLangfuseSessionId({
            projectId: id,
            clientSessionId: langfuseSessionIdBody,
          }),
        });
        await flushLangfuse();
        if (!closed) {
          closed = true;
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    headers: SSE_RESPONSE_HEADERS,
  });
}
