/**
 * POST /api/projects/[id]/board-run
 *
 * BoardRun propose edits / confirm / decline / queue control / run cards (two-phase).
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";
import {
  AdvanceBoardRunError,
  advanceBoardRun,
} from "@/lib/modify/boardRun/advanceBoardRun";
import { getBoardRunStore } from "@/lib/modify/boardRun/fileBoardRunStore";
import {
  executeBoardCardTurn,
  prepareBoardCardTurn,
} from "@/lib/modify/boardRun/runBoardCardTurn";
import type { BoardTaskInput } from "@/lib/modify/boardRun/boardRunTypes";

export const runtime = "nodejs";

function parseTasks(raw: unknown): BoardTaskInput[] | null {
  if (!Array.isArray(raw)) return null;
  const tasks: BoardTaskInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const title = typeof (item as { title?: unknown }).title === "string"
      ? (item as { title: string }).title.trim()
      : "";
    const instruction =
      typeof (item as { instruction?: unknown }).instruction === "string"
        ? (item as { instruction: string }).instruction.trim()
        : "";
    if (!title || !instruction) return null;
    tasks.push({ title, instruction });
  }
  return tasks;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await params;
  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;

  const run = await getBoardRunStore().loadActive(id);
  return NextResponse.json({ boardRun: run });
}

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
  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;
  const { db } = access;

  let body: {
    action?: string;
    tasks?: unknown;
    taskId?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "BAD_REQUEST" }, { status: 400 });
  }

  const action = body.action;
  const store = getBoardRunStore();
  const current = await store.loadActive(id);

  try {
    if (action === "revise") {
      if (!current || current.status !== "proposed") {
        return NextResponse.json(
          { error: "No proposed BoardRun to revise", code: "NO_PROPOSED_BOARD" },
          { status: 409 }
        );
      }
      const tasks = parseTasks(body.tasks);
      if (!tasks) {
        return NextResponse.json({ error: "Invalid tasks", code: "BAD_REQUEST" }, { status: 400 });
      }
      const { run } = advanceBoardRun(current, { type: "revise", tasks }, { online: false });
      await store.save(run);
      return NextResponse.json({ boardRun: run });
    }

    if (action === "confirm") {
      if (!current || current.status !== "proposed") {
        return NextResponse.json(
          { error: "No proposed BoardRun to confirm", code: "NO_PROPOSED_BOARD" },
          { status: 409 }
        );
      }
      const tasks = parseTasks(body.tasks);
      if (!tasks) {
        return NextResponse.json({ error: "Invalid tasks", code: "BAD_REQUEST" }, { status: 400 });
      }
      const { run } = advanceBoardRun(
        current,
        { type: "confirm", tasks },
        { online: false }
      );
      await store.save(run);
      return NextResponse.json({ boardRun: run, dispatch: null });
    }

    if (action === "decline") {
      if (current) {
        if (current.status === "proposed") {
          const { run } = advanceBoardRun(current, { type: "cancelRemaining" }, { online: false });
          await store.save(run);
        }
        await store.clear(id);
      }
      return NextResponse.json({
        boardRun: null,
        forceSingleModify: true,
        goal: current?.goal ?? null,
      });
    }

    if (action === "pause") {
      if (!current) {
        return NextResponse.json({ error: "No active BoardRun", code: "NO_BOARD" }, { status: 409 });
      }
      const { run } = advanceBoardRun(current, { type: "pause" }, { online: false });
      await store.save(run);
      return NextResponse.json({ boardRun: run });
    }

    if (action === "cancel_remaining") {
      if (!current) {
        return NextResponse.json({ error: "No active BoardRun", code: "NO_BOARD" }, { status: 409 });
      }
      const { run } = advanceBoardRun(current, { type: "cancelRemaining" }, { online: false });
      await store.save(run);
      return NextResponse.json({ boardRun: run });
    }

    // Phase 1: mark next card in_flight (fast) so UI can show progress.
    if (action === "prepare_next" || action === "run_next" || action === "continue") {
      const prepared = await prepareBoardCardTurn({
        projectId: id,
        command: { type: "continue" },
      });
      // Back-compat: legacy `run_next` still means prepare+execute in one call.
      if (action === "run_next") {
        if (!prepared.dispatch) {
          return NextResponse.json(prepared);
        }
        const executed = await executeBoardCardTurn(db, {
          userId: user.id,
          projectId: id,
        });
        return NextResponse.json(executed);
      }
      return NextResponse.json(prepared);
    }

    if (action === "execute_current") {
      const executed = await executeBoardCardTurn(db, {
        userId: user.id,
        projectId: id,
      });
      return NextResponse.json(executed);
    }

    if (action === "retry") {
      const taskId = typeof body.taskId === "string" ? body.taskId : "";
      if (!taskId) {
        return NextResponse.json({ error: "Missing taskId", code: "BAD_REQUEST" }, { status: 400 });
      }
      const prepared = await prepareBoardCardTurn({
        projectId: id,
        command: { type: "retry", taskId },
      });
      if (!prepared.dispatch) {
        return NextResponse.json(prepared);
      }
      // Return prepared first? Client uses prepare+execute for retry via two calls.
      // For simple retry button we still do both; client should use two-phase for UI.
      const executed = await executeBoardCardTurn(db, {
        userId: user.id,
        projectId: id,
      });
      return NextResponse.json(executed);
    }

    if (action === "skip") {
      const taskId = typeof body.taskId === "string" ? body.taskId : "";
      if (!taskId) {
        return NextResponse.json({ error: "Missing taskId", code: "BAD_REQUEST" }, { status: 400 });
      }
      const prepared = await prepareBoardCardTurn({
        projectId: id,
        command: { type: "skip", taskId },
      });
      if (!prepared.dispatch) {
        return NextResponse.json(prepared);
      }
      const executed = await executeBoardCardTurn(db, {
        userId: user.id,
        projectId: id,
      });
      return NextResponse.json(executed);
    }

    if (action === "prepare_retry") {
      const taskId = typeof body.taskId === "string" ? body.taskId : "";
      if (!taskId) {
        return NextResponse.json({ error: "Missing taskId", code: "BAD_REQUEST" }, { status: 400 });
      }
      const prepared = await prepareBoardCardTurn({
        projectId: id,
        command: { type: "retry", taskId },
      });
      return NextResponse.json(prepared);
    }

    if (action === "prepare_skip") {
      const taskId = typeof body.taskId === "string" ? body.taskId : "";
      if (!taskId) {
        return NextResponse.json({ error: "Missing taskId", code: "BAD_REQUEST" }, { status: 400 });
      }
      const prepared = await prepareBoardCardTurn({
        projectId: id,
        command: { type: "skip", taskId },
      });
      return NextResponse.json(prepared);
    }

    return NextResponse.json({ error: "Unknown action", code: "BAD_REQUEST" }, { status: 400 });
  } catch (err) {
    if (err instanceof AdvanceBoardRunError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message, code: "BOARD_RUN_ERROR" }, { status: 500 });
  }
}
