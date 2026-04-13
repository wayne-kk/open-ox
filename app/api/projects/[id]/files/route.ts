import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/projectManager";
import { restoreProjectFiles, uploadGeneratedFiles, listProjectFiles } from "@/lib/storage";
import fs from "fs/promises";
import path from "path";
import { getSiteRoot } from "@/lib/projectManager";
import { getSessionUser } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

/** GET /api/projects/[id]/files — list files in Storage */
export async function GET(_req: NextRequest, { params }: Params) {
    const session = await getSessionUser();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    const { id } = await params;
    const project = await getProject(session.supabase, id);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const files = await listProjectFiles(id);
    return NextResponse.json({ files, count: files.length });
}

/** POST /api/projects/[id]/files — restore files from Storage to local */
export async function POST(_req: NextRequest, { params }: Params) {
    const session = await getSessionUser();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    const { id } = await params;
    const project = await getProject(session.supabase, id);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const restored = await restoreProjectFiles(id);
    return NextResponse.json({ restored, count: restored.length });
}

/** PUT /api/projects/[id]/files — upload all local files to Storage */
export async function PUT(_req: NextRequest, { params }: Params) {
    const session = await getSessionUser();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    const { id } = await params;
    const project = await getProject(session.supabase, id);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Collect all files in the project directory
    const projectDir = getSiteRoot(id);
    const files = await collectFiles(projectDir, projectDir);
    await uploadGeneratedFiles(id, files);
    return NextResponse.json({ uploaded: files, count: files.length });
}

const EXCLUDE = new Set(["node_modules", ".next", ".git", "out"]);

async function collectFiles(dir: string, base: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
        if (EXCLUDE.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) {
            files.push(...(await collectFiles(full, base)));
        } else if (entry.isFile()) {
            files.push(path.relative(base, full));
        }
    }
    return files;
}
