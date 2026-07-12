import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { isVercelDeployConfigured } from "@/lib/vercel/env";
import { getVercelAccessToken } from "@/lib/vercel/connections";
import { listAccessibleVercelTeams } from "@/lib/vercel/oauth";

/** GET — teams visible to the connected Integration token (usually one install team). */
export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isVercelDeployConfigured()) {
    return NextResponse.json({ error: "Not configured", code: "VERCEL_NOT_CONFIGURED" }, { status: 503 });
  }

  const creds = await getVercelAccessToken(session.user.id);
  if (!creds) {
    return NextResponse.json({ error: "Not connected", code: "VERCEL_NOT_CONNECTED" }, { status: 400 });
  }

  try {
    const teams = await listAccessibleVercelTeams({
      accessToken: creds.accessToken,
      teamId: creds.teamId,
      teamName: creds.teamName,
    });
    return NextResponse.json({
      teams,
      defaultTeamId: creds.teamId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[vercel/teams] list failed:", msg);
    return NextResponse.json({ error: msg, code: "TEAMS_LIST_FAILED" }, { status: 502 });
  }
}
