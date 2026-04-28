import archiver from "archiver";
import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { getProject, getSiteRoot } from "@/lib/projectManager";
import { collectFiles } from "@/lib/previewShared";
import { restoreProjectFiles } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/export — ZIP local workspace (`sites/{id}`).
 *
 * Fast path (default): no Storage round-trip if `package.json` already exists — ZIPs what's on disk
 * (open CODE preview once to hydrate, or edits you made locally).
 * Force sync first: `?sync=1` — runs full `restoreProjectFiles` then ZIP (slow, matches Storage).
 *
 * Excludes node_modules / .next / .git via collectFiles rules.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const project = await getProject(session.supabase, id);
  if (!project) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  const projectDir = getSiteRoot(id);
  const forceSync = new URL(req.url).searchParams.get("sync") === "1";

  let pkgMissing = false;
  try {
    await fs.access(path.join(projectDir, "package.json"));
  } catch {
    pkgMissing = true;
  }

  if (forceSync || pkgMissing) {
    await restoreProjectFiles(id);
  }


  try {
    await fs.access(path.join(projectDir, "package.json"));
  } catch {
    return NextResponse.json(
      {
        error: "Project scaffold incomplete — missing package.json after restore",
        code: "WORKSPACE_INCOMPLETE",
      },
      { status: 409 }
    );
  }

  const relativePaths = await collectFiles(projectDir, projectDir);
  relativePaths.sort((a, b) => a.localeCompare(b));

  /** Level 6 balances size vs CPU; level 9 was noticeably slower on multi-hundred-file sites. */
  const archive = archiver("zip", { zlib: { level: 6 } });
  const chunks: Buffer[] = [];
  archive.on("data", (chunk: Buffer) => chunks.push(chunk));

  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);
  });

  for (const rel of relativePaths) {
    const safeRel = rel.split(path.sep).join("/");
    const fullPath = path.join(projectDir, rel);
    archive.file(fullPath, { name: `${id}/${safeRel}` });
  }

  await archive.finalize();
  const buf = await bufferPromise;

  const safeName = `${id.replace(/[^\w.-]+/g, "_")}.zip`;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
    },
  });
}
