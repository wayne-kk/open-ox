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
import { getProject } from "@/lib/projectManager";
import { runModifyProject } from "@/ai/flows/modify_project/runModifyProject";
import type { ModifySSEEvent } from "@/ai/flows/modify_project/runModifyProject";
import { uploadGeneratedFiles } from "@/lib/storage";
import { classifyModificationScope } from "@/lib/devServerManager";
import { setRuntimeModelId, type ModelId } from "@/lib/config/models";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Validate project exists before streaming
  const project = await getProject(id);
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

  // Set model override for this request
  if (modelOverride) setRuntimeModelId(modelOverride as ModelId);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ModifySSEEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Collect plan and diffs for persistence
      let collectedPlan: { analysis: string; changes: Array<{ path: string; action: string; reasoning: string }> } | null = null;
      const collectedDiffs: Array<{ file: string; reasoning: string; patch: string; stats: { additions: number; deletions: number } }> = [];
      let buildPassed = false;

      try {
        await runModifyProject(id, userInstruction, (event) => {
          send(event);
          if (event.type === "plan") {
            collectedPlan = event.plan as typeof collectedPlan;
          } else if (event.type === "diff") {
            collectedDiffs.push({
              file: (event as { file: string }).file,
              reasoning: (event as { reasoning: string }).reasoning,
              patch: (event as { patch: string }).patch,
              stats: (event as { stats: { additions: number; deletions: number } }).stats,
            });
          } else if (event.type === "step" && event.name === "agent_loop") {
            // Capture build status from agent_loop completion
            if (event.message?.includes("build=passed")) buildPassed = true;
          }
        }, conversationHistory, clearContext, imageBase64);

        // Upload modified files to Storage (non-blocking)
        const touchedFiles = collectedDiffs.map((d) => d.file);
        if (touchedFiles.length > 0) {
          uploadGeneratedFiles(id, touchedFiles).catch((err) =>
            console.error("[modify] Storage upload failed:", err)
          );
        }

        // Classify modification scope for preview optimization
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
        setRuntimeModelId(null);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
