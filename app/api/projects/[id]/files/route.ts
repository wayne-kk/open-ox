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

    const requestUrl = new URL(_req.url);
    const requestedPath = requestUrl.searchParams.get("path");
    const listSource = requestUrl.searchParams.get("source");
    if (requestedPath) {
        const projectDir = getSiteRoot(id);
        const normalizedPath = path.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, "");
        const filePath = path.resolve(projectDir, normalizedPath);
        const isInsideProject = filePath === projectDir || filePath.startsWith(`${projectDir}${path.sep}`);
        if (!isInsideProject) {
            return NextResponse.json({ error: "Invalid file path", code: "INVALID_FILE_PATH" }, { status: 400 });
        }
        try {
            const stat = await fs.stat(filePath);
            if (!stat.isFile()) {
                return NextResponse.json({ error: "Not a file", code: "NOT_A_FILE" }, { status: 400 });
            }
            const content = await fs.readFile(filePath, "utf8");
            return NextResponse.json({ path: normalizedPath, content });
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                return NextResponse.json({ error: "File not found", code: "FILE_NOT_FOUND" }, { status: 404 });
            }
            return NextResponse.json({ error: "Failed to read file", code: "FILE_READ_FAILED" }, { status: 500 });
        }
    }

    /** Workspace listing matches local reads (`path` query); default remains Storage for API compat. */
    if (listSource === "workspace") {
        const projectDir = getSiteRoot(id);
        const files = await collectFiles(projectDir, projectDir);
        files.sort((a, b) => a.localeCompare(b));
        return NextResponse.json({ files, count: files.length, source: "workspace" });
    }

    const files = await listProjectFiles(id);
    return NextResponse.json({ files, count: files.length });
}

/** PATCH /api/projects/[id]/files — write text file in workspace (body: { path, content }) */
export async function PATCH(req: NextRequest, { params }: Params) {
    const session = await getSessionUser();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }
    const { id } = await params;
    const project = await getProject(session.supabase, id);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let body: { path?: string; content?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
    }
    if (typeof body.path !== "string" || !body.path.trim()) {
        return NextResponse.json({ error: "Missing path", code: "MISSING_PATH" }, { status: 400 });
    }
    if (typeof body.content !== "string") {
        return NextResponse.json({ error: "Missing content", code: "MISSING_CONTENT" }, { status: 400 });
    }

    const projectDir = getSiteRoot(id);
    const normalizedPath = path.normalize(body.path).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = path.resolve(projectDir, normalizedPath);
    const isInsideProject = filePath === projectDir || filePath.startsWith(`${projectDir}${path.sep}`);
    if (!isInsideProject) {
        return NextResponse.json({ error: "Invalid file path", code: "INVALID_FILE_PATH" }, { status: 400 });
    }

    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, body.content, "utf8");
        return NextResponse.json({ ok: true, path: normalizedPath });
    } catch (error) {
        console.error("[PATCH /api/projects/:id/files]", error);
        return NextResponse.json({ error: "Failed to write file", code: "FILE_WRITE_FAILED" }, { status: 500 });
    }
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
