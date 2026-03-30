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
  try {
    const body = await req.json();
    userInstruction = body.userInstruction;
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
      const send = (event: ModifySSEEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        await runModifyProject(id, userInstruction, send);
        send({ type: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Internal error";
        send({ type: "error", message });
      } finally {
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
