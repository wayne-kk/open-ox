/**
 * GET /api/projects/[id]/memory
 *
 * Returns the three-layer conversation memory for a project:
 * - Layer 1 (DB): modificationHistory from database
 * - Layer 2 (Session): passed via query param (for display only)
 * - Layer 3 (Prompt): the merged + formatted string that gets injected into the LLM
 */

import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/projectManager";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
    const { id } = await params;

    const project = await getProject(id);
    if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const dbHistory = (project.modificationHistory ?? []).map((r) => ({
        instruction: r.instruction,
        modifiedAt: r.modifiedAt,
        touchedFiles: r.touchedFiles,
        summary: r.plan?.analysis
            ? `${r.plan.analysis} Files: ${r.touchedFiles.join(", ")}`
            : `Modified ${r.touchedFiles.length} file(s): ${r.touchedFiles.join(", ")}`,
        diffs: (r.diffs ?? []).map((d) => ({
            file: d.file,
            additions: d.stats.additions,
            deletions: d.stats.deletions,
        })),
    }));

    // Build the prompt injection preview (what the LLM actually sees)
    const MAX_HISTORY_TURNS = 10;
    const recentHistory = dbHistory.slice(-MAX_HISTORY_TURNS);
    const promptPreview = recentHistory.length > 0
        ? `## Previous Modifications (conversation memory)\n${recentHistory.map((h, i) => `${i + 1}. User: "${h.instruction}"\n   Result: ${h.summary}`).join("\n")}`
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
            activeCount: recentHistory.length,
            preview: promptPreview,
        },
    });
}
