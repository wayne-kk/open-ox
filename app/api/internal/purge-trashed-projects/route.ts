import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { deleteProject, listDueTrashProjectIds } from "@/lib/projectManager";
import { deleteProjectFiles } from "@/lib/storage";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * GET|POST /api/internal/purge-trashed-projects
 * Permanently deletes Recycle Bin projects whose purge_after is due.
 * Auth: Authorization: Bearer <OPEN_OX_CRON_SECRET> (or CRON_SECRET).
 * Vercel Cron invokes GET daily (see vercel.json).
 */
function cronSecretMatches(provided: string | null): boolean {
  const expected =
    process.env.OPEN_OX_CRON_SECRET?.trim() || process.env.CRON_SECRET?.trim() || "";
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function runPurge(req: Request): Promise<NextResponse> {
  const auth = req.headers.get("authorization");
  const bearer =
    auth && auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : null;
  if (!cronSecretMatches(bearer)) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  let db;
  try {
    db = createSupabaseServiceRoleClient();
  } catch {
    return NextResponse.json(
      { error: "Service role not configured", code: "MISCONFIGURED" },
      { status: 503 }
    );
  }

  const ids = await listDueTrashProjectIds(db, { limit: 50 });
  const purged: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const id of ids) {
    try {
      await deleteProject(db, id);
      await deleteProjectFiles(id).catch((err) => {
        console.error(
          `[purge-trashed-projects] storage cleanup failed id=${id}:`,
          err
        );
      });
      purged.push(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ id, error: message });
      console.error(`[purge-trashed-projects] failed id=${id}:`, message);
    }
  }

  return NextResponse.json({
    examined: ids.length,
    purged: purged.length,
    failed: failed.length,
    ids: purged,
    errors: failed,
  });
}

export async function GET(req: Request) {
  return runPurge(req);
}

export async function POST(req: Request) {
  return runPurge(req);
}
