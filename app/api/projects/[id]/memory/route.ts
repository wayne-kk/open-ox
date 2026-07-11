/**
 * GET /api/projects/[id]/memory
 *
 * Returns modify conversation memory for a project:
 * - Layer 1 (DB): modificationHistory from database
 * - Layer 2 (Session): note only (lives in browser; sent as conversationHistory)
 * - Working memory: deterministic projection (state card)
 * - Layer 3 (Prompt): agent + router injection previews
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";
import { fromModificationRecord } from "@/ai/flows/modify_project/history/modifyHistoryTurn";
import {
  RECENT_RAW_TURNS,
  buildModifyWorkingMemoryContext,
} from "@/ai/flows/modify_project/history/modifyWorkingMemory";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
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
        const turn = turns[i]!;
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

    const working = buildModifyWorkingMemoryContext(turns, []);
    const agentPreview =
        working.agentPromptBlock.trim() || "(empty — no previous modifications)";
    const routerPreview =
        working.routerPromptBlock.trim() || "(empty — no working memory card)";

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
        workingMemory: {
            label: "Working memory (projected)",
            ...working.memory,
        },
        layer3_prompt: {
            label: "Layer 3: LLM Prompt Injection",
            maxRecentTurns: RECENT_RAW_TURNS,
            activeCount: working.recentTurns.length,
            preview: agentPreview,
            routerPreview,
        },
    });
}
