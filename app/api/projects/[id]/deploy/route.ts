import { after, NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { requireOwnedProject } from "@/lib/auth/projectAccess";
import { isVercelDeployConfigured } from "@/lib/vercel/env";
import { enqueueProjectDeploy, getProjectDeployStatus } from "@/lib/vercel/deploy";

type Params = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
/** Static export + Vercel upload can exceed the default serverless limit. */
export const maxDuration = 300;

/** GET /api/projects/[id]/deploy — latest deploy status. */
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;

  if (!isVercelDeployConfigured()) {
    return NextResponse.json({
      configured: false,
      status: null,
      productionUrl: null,
    });
  }

  try {
    const status = await getProjectDeployStatus(id);
    return NextResponse.json({ configured: true, ...status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, code: "DEPLOY_STATUS_FAILED" }, { status: 500 });
  }
}

/** POST /api/projects/[id]/deploy — enqueue deploy. */
export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const { id } = await params;
  const access = await requireOwnedProject(session, id);
  if ("error" in access) return access.error;

  if (!isVercelDeployConfigured()) {
    return NextResponse.json(
      { error: "Vercel deploy is not configured", code: "VERCEL_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  try {
    const { deployId, job } = await enqueueProjectDeploy({
      projectId: id,
      userId: session.user.id,
    });
    // Keep the worker alive after the response — bare fire-and-forget dies in serverless
    // and leaves last_status stuck on "queued" (endless spinner in Studio).
    after(async () => {
      try {
        await job;
      } catch (e) {
        console.error(`[POST /api/projects/${id}/deploy] background job failed:`, e);
      }
    });
    const status = await getProjectDeployStatus(id);
    return NextResponse.json({ ok: true, ...status, deployId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "VERCEL_NOT_CONNECTED") {
      return NextResponse.json(
        { error: "Connect Vercel in Settings → Integrations first", code: "VERCEL_NOT_CONNECTED" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: msg, code: "DEPLOY_ENQUEUE_FAILED" }, { status: 500 });
  }
}
