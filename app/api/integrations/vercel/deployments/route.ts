import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isVercelDeployConfigured } from "@/lib/vercel/env";
import { listUserProjectDeployments } from "@/lib/vercel/deploy";

/** GET /api/integrations/vercel/deployments — owner's latest deploy per project. */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  if (!isVercelDeployConfigured()) {
    return NextResponse.json({ configured: false, deployments: [] });
  }

  try {
    const deployments = await listUserProjectDeployments(session.user.id);
    return NextResponse.json({ configured: true, deployments });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, code: "DEPLOY_LIST_FAILED" }, { status: 500 });
  }
}
