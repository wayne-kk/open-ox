/**
 * POST /api/projects/[id]/modify
 *
 * Accepts { userInstruction } and streams SSE events from runModifyProject.
 * Returns 404 if the project is not found.
 *
 * SSE format (same as Generate_Flow):
 *   data: {"type":"step", "name": string, "status": "running"|"done"|"error"}\n\n
 *   data: {"type":"done"}\n\n
 *   data: {"type":"error", "message": string}\n\n
 */

import { NextResponse } from "next/server";
import { SSE_RESPONSE_HEADERS } from "@/lib/sse-headers";
import { getProject } from "@/lib/projectManager";
import { runModifyProject } from "@/ai/flows/modify_project/runModifyProject";
import type { ModifySSEEvent } from "@/ai/flows/modify_project/runModifyProject";
import { uploadGeneratedFiles } from "@/lib/storage";
import { classifyModificationScope } from "@/lib/devServerManager";
import { getSessionUser } from "@/lib/auth/session";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { supabase: db } = session;

  const { id } = await params;

  // Validate project exists before streaming
  const project = await getProject(db, id);
  if (!project) {
    return NextResponse.json({ error: "Project not found", code: "NOT_FOUND" }, { status: 404 });
  }

  let userInstruction: string;
  let modelOverride: string | undefined;
  let conversationHistory: Array<{ instruction: string; summary: string }> | undefined;
  let clearContext = false;
  let imageBase64: string | undefined;
  try {
    const body = await req.json();
    userInstruction = body.userInstruction;
    modelOverride = body.model;
    conversationHistory = body.conversationHistory;
    clearContext = body.clearContext === true;
    imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : undefined;
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

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: ModifySSEEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const collectedDiffs: Array<{ file: string; reasoning: string; patch: string; stats: { additions: number; deletions: number } }> = [];
      let buildPassed = false;

      try {
        await runModifyProject(
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
        );

        const touchedFiles = collectedDiffs.map((d) => d.file);
        if (touchedFiles.length > 0) {
          uploadGeneratedFiles(id, touchedFiles).catch((err) =>
            console.error("[modify] Storage upload failed:", err)
          );
        }

        const refreshMode = classifyModificationScope(collectedDiffs);

        send({
          type: "done",
          refreshMode,
          changedFiles: touchedFiles,
          diffs: collectedDiffs,
          buildPassed,
        } as ModifySSEEvent & { refreshMode: string; changedFiles: string[]; diffs: typeof collectedDiffs; buildPassed: boolean });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error";
        send({ type: "error", message });
      } finally {
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
