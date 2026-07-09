/**
 * GET /api/projects/[id]/memory
 *
 * Returns the three-layer conversation memory for a project:
 * - Layer 1 (DB): modificationHistory from database
 * - Layer 2 (Session): passed via query param (for display only)
 * - Layer 3 (Prompt): the merged + formatted string that gets injected into the LLM
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";
import {
  buildHistoryContext,
  fromModificationRecord,
} from "@/ai/flows/modify_project/history/modifyHistoryTurn";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    const session = await getSessionUser();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    const { id } = await params;

    const access = await requireOwnedProject(session, id);
    if ("error" in access) return access.error;
    const { project } = access;

    const turns = (project.modificationHistory ?? []).map(fromModificationRecord);
    const dbHistory = (project.modificationHistory ?? []).map((r, i) => {
        const turn = turns[i];
        return {
            instruction: r.instruction,
            modifiedAt: r.modifiedAt,
            touchedFiles: turn.touchedFiles,
            assistantText: turn.assistantText,
            intentCategory: turn.intentCategory,
            awaitingReply: turn.awaitingReply,
            diffs: (r.diffs ?? []).map((d) => ({
                file: d.file,
                additions: d.stats.additions,
                deletions: d.stats.deletions,
            })),
        };
    });

    const MAX_HISTORY_TURNS = 10;
    const promptPreview =
        turns.length > 0
            ? buildHistoryContext(turns, [], MAX_HISTORY_TURNS).trim() ||
              "(empty — no previous modifications)"
            : "(empty — no previous modifications)";

    return NextResponse.json({
        projectId: id,
        projectName: project.name,
        layer1_db: {
            label: "Layer 1: DB Persistent History",
            count: dbHistory.length,
            records: dbHistory,
        },
        layer2_session: {
            label: "Layer 2: Session History",
            note: "Session data lives in browser memory (modifyHistory state). It is sent as conversationHistory in each modify request and deduplicated against DB history.",
        },
        layer3_prompt: {
            label: "Layer 3: LLM Prompt Injection",
            maxTurns: MAX_HISTORY_TURNS,
            activeCount: Math.min(turns.length, MAX_HISTORY_TURNS),
            preview: promptPreview,
        },
    });
}
